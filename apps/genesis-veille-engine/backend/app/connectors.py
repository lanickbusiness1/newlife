from __future__ import annotations

import hashlib
import ipaddress
import socket
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib import error, request, robotparser
from urllib.parse import SplitResult, urljoin, urlsplit

from pydantic import BaseModel, Field, field_validator

from .models import AcceptedEvent, EventInput, SourceRecord
from .persistence import SQLiteStateRepository
from .provenance import ProvenanceGate
from .source_registry import SourceRegistry
from .world_state import WorldStateStore


CRAWLABLE_LICENSE_CLASSES = frozenset(
    {
        "public",
        "open",
        "open-data",
        "public-domain",
        "official-public",
    }
)

HTTP_USER_AGENT = "AfrIAgenesisGenesisVeille/0.3"
SUPPORTED_CONTENT_TYPES = frozenset(
    {
        "text/html",
        "text/plain",
        "application/json",
        "application/xml",
        "text/xml",
        "application/rss+xml",
        "application/atom+xml",
    }
)


class ConnectorObservation(BaseModel):
    source_id: str = Field(min_length=1, max_length=128)
    url: str = Field(min_length=8, max_length=2048)
    retrieved_at: datetime
    title: str = Field(min_length=1, max_length=512)
    content_text: str = Field(min_length=1, max_length=20000)
    country_iso3: str = Field(min_length=3, max_length=3)
    event_type_hint: str = Field(min_length=1, max_length=64)
    sector: str | None = Field(default=None, max_length=128)
    sensitive: bool = False

    @field_validator("country_iso3")
    @classmethod
    def normalize_iso3(cls, value: str) -> str:
        return value.upper()


class ConnectorIngestRequest(BaseModel):
    source_id: str = Field(min_length=1, max_length=128)
    url: str = Field(min_length=8, max_length=2048)
    country_iso3: str = Field(min_length=3, max_length=3)
    event_type_hint: str = Field(min_length=1, max_length=64)
    sector: str | None = Field(default=None, max_length=128)
    sensitive: bool = False

    @field_validator("country_iso3")
    @classmethod
    def normalize_iso3(cls, value: str) -> str:
        return value.upper()


class FetchedDocument(BaseModel):
    final_url: str = Field(min_length=8, max_length=2048)
    content_type: str = Field(min_length=1, max_length=128)
    retrieved_at: datetime
    title: str = Field(min_length=1, max_length=512)
    text: str = Field(min_length=1, max_length=20000)


class PublicUrlPolicy:
    """Fail-closed URL policy for registered public-source connectors."""

    def validate(self, url: str, *, allowed_hosts: list[str]) -> SplitResult:
        parsed = urlsplit(url)
        if parsed.scheme.lower() != "https":
            raise ValueError("connector URL must use https")
        if parsed.username is not None or parsed.password is not None:
            raise ValueError("connector URL credentials are forbidden")
        if parsed.fragment:
            raise ValueError("connector URL fragments are forbidden")
        if parsed.port not in (None, 443):
            raise ValueError("connector URL must use the default HTTPS port")

        hostname = (parsed.hostname or "").lower().rstrip(".")
        if not hostname:
            raise ValueError("connector URL hostname is required")
        if hostname == "localhost" or hostname.endswith(".localhost"):
            raise ValueError("private or local connector host is forbidden")

        try:
            address = ipaddress.ip_address(hostname)
        except ValueError:
            address = None
        if address is not None and not address.is_global:
            raise ValueError("private or local connector host is forbidden")

        registered_hosts = {item.lower().rstrip(".") for item in allowed_hosts}
        if hostname not in registered_hosts:
            raise ValueError("host is not registered for this source")
        return parsed


class _NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        return None


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._hidden_depth = 0
        self._in_title = False
        self.title_parts: list[str] = []
        self.text_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:  # noqa: ANN001
        lowered = tag.lower()
        if lowered in {"script", "style", "noscript", "svg"}:
            self._hidden_depth += 1
        if lowered == "title":
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        lowered = tag.lower()
        if lowered in {"script", "style", "noscript", "svg"} and self._hidden_depth:
            self._hidden_depth -= 1
        if lowered == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        clean = " ".join(data.split())
        if not clean:
            return
        if self._in_title:
            self.title_parts.append(clean)
        if self._hidden_depth == 0:
            self.text_parts.append(clean)


class SafeHttpTransport:
    """Bounded HTTP GET transport for explicitly registered public hosts."""

    def __init__(
        self,
        *,
        timeout_seconds: float = 8.0,
        max_document_bytes: int = 512_000,
        max_robots_bytes: int = 64_000,
        max_redirects: int = 3,
        url_policy: PublicUrlPolicy | None = None,
    ) -> None:
        self.timeout_seconds = timeout_seconds
        self.max_document_bytes = max_document_bytes
        self.max_robots_bytes = max_robots_bytes
        self.max_redirects = max_redirects
        self.url_policy = url_policy or PublicUrlPolicy()
        self._opener = request.build_opener(_NoRedirect())

    def validate_resolved_addresses(self, hostname: str, addresses: list[str]) -> None:
        if not addresses:
            raise ValueError(f"DNS resolution returned no address for {hostname}")
        for item in addresses:
            address = ipaddress.ip_address(item)
            if not address.is_global:
                raise ValueError(f"non-public address resolved for {hostname}")

    def robots_allows(self, robots_text: str, target_url: str) -> bool:
        parser = robotparser.RobotFileParser()
        parser.parse(robots_text.splitlines())
        return parser.can_fetch(HTTP_USER_AGENT, target_url)

    def fetch(self, url: str, *, allowed_hosts: list[str]) -> FetchedDocument:
        self.url_policy.validate(url, allowed_hosts=allowed_hosts)
        self._validate_dns(url)

        robots_url = self._robots_url(url)
        robots_text = self._fetch_robots(robots_url, allowed_hosts=allowed_hosts)
        if robots_text is not None and not self.robots_allows(robots_text, url):
            raise ValueError("robots policy disallows connector fetch")

        final_url, content_type, charset, payload = self._fetch_bytes(
            url,
            allowed_hosts=allowed_hosts,
            max_bytes=self.max_document_bytes,
            allow_missing=False,
        )
        if content_type not in SUPPORTED_CONTENT_TYPES:
            raise ValueError(f"unsupported connector content type: {content_type}")

        decoded = payload.decode(charset or "utf-8", errors="replace")
        title, text = self._extract(decoded, content_type, final_url)
        return FetchedDocument(
            final_url=final_url,
            content_type=content_type,
            retrieved_at=datetime.now(timezone.utc),
            title=title[:512],
            text=text[:20000],
        )

    def _fetch_robots(self, robots_url: str, *, allowed_hosts: list[str]) -> str | None:
        try:
            _final_url, _content_type, charset, payload = self._fetch_bytes(
                robots_url,
                allowed_hosts=allowed_hosts,
                max_bytes=self.max_robots_bytes,
                allow_missing=True,
            )
        except ValueError as exc:
            if str(exc) == "resource not found":
                return None
            raise
        return payload.decode(charset or "utf-8", errors="replace")

    def _fetch_bytes(
        self,
        url: str,
        *,
        allowed_hosts: list[str],
        max_bytes: int,
        allow_missing: bool,
    ) -> tuple[str, str, str | None, bytes]:
        current = url
        for redirect_count in range(self.max_redirects + 1):
            self.url_policy.validate(current, allowed_hosts=allowed_hosts)
            self._validate_dns(current)
            req = request.Request(
                current,
                headers={
                    "User-Agent": HTTP_USER_AGENT,
                    "Accept": "text/html,text/plain,application/json,application/xml,text/xml,application/rss+xml,application/atom+xml",
                    "Accept-Encoding": "identity",
                },
                method="GET",
            )
            try:
                response = self._opener.open(req, timeout=self.timeout_seconds)
            except error.HTTPError as exc:
                if allow_missing and exc.code == 404:
                    raise ValueError("resource not found") from exc
                if exc.code in {301, 302, 303, 307, 308}:
                    if redirect_count >= self.max_redirects:
                        raise ValueError("connector redirect limit exceeded") from exc
                    location = exc.headers.get("Location")
                    if not location:
                        raise ValueError("connector redirect has no location") from exc
                    current = urljoin(current, location)
                    continue
                raise ValueError(f"connector HTTP status {exc.code}") from exc
            except OSError as exc:
                raise ValueError("connector network request failed") from exc

            with response:
                content_length = response.headers.get("Content-Length")
                if content_length is not None and int(content_length) > max_bytes:
                    raise ValueError("connector response exceeds byte limit")
                payload = response.read(max_bytes + 1)
                if len(payload) > max_bytes:
                    raise ValueError("connector response exceeds byte limit")
                content_type = response.headers.get_content_type().lower()
                charset = response.headers.get_content_charset()
                final_url = response.geturl()
                self.url_policy.validate(final_url, allowed_hosts=allowed_hosts)
                return final_url, content_type, charset, payload

        raise ValueError("connector redirect limit exceeded")

    def _validate_dns(self, url: str) -> None:
        parsed = urlsplit(url)
        hostname = parsed.hostname
        if hostname is None:
            raise ValueError("connector URL hostname is required")
        try:
            literal = ipaddress.ip_address(hostname)
        except ValueError:
            literal = None
        if literal is not None:
            self.validate_resolved_addresses(hostname, [str(literal)])
            return
        try:
            results = socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM)
        except socket.gaierror as exc:
            raise ValueError("connector DNS resolution failed") from exc
        addresses = sorted({item[4][0] for item in results})
        self.validate_resolved_addresses(hostname, addresses)

    @staticmethod
    def _robots_url(url: str) -> str:
        parsed = urlsplit(url)
        return f"https://{parsed.hostname}/robots.txt"

    @staticmethod
    def _extract(document: str, content_type: str, final_url: str) -> tuple[str, str]:
        if content_type == "text/html":
            parser = _TextExtractor()
            parser.feed(document)
            title = " ".join(parser.title_parts).strip()
            text = " ".join(parser.text_parts).strip()
        else:
            title = urlsplit(final_url).path.rsplit("/", 1)[-1] or urlsplit(final_url).hostname or "Public source"
            text = " ".join(document.split())
        if not text:
            raise ValueError("connector document contains no extractable text")
        if not title:
            title = urlsplit(final_url).hostname or "Public source"
        return title, text


class PublicHttpConnector:
    """Fetches one registered public URL and returns a bounded observation."""

    def __init__(
        self,
        *,
        transport: SafeHttpTransport | object | None = None,
        url_policy: PublicUrlPolicy | None = None,
    ) -> None:
        self._url_policy = url_policy or PublicUrlPolicy()
        self._transport = transport or SafeHttpTransport(url_policy=self._url_policy)

    def fetch(
        self,
        *,
        source: SourceRecord,
        url: str,
        country_iso3: str,
        event_type_hint: str,
        sector: str | None = None,
        sensitive: bool = False,
    ) -> ConnectorObservation:
        if not source.active:
            raise ValueError("unknown or inactive source")
        if source.license_class.strip().lower() not in CRAWLABLE_LICENSE_CLASSES:
            raise ValueError("license class is not crawlable")
        if not source.allowed_hosts:
            raise ValueError("source has no registered crawl hosts")
        self._url_policy.validate(url, allowed_hosts=source.allowed_hosts)

        document = self._transport.fetch(url, allowed_hosts=source.allowed_hosts)
        self._url_policy.validate(document.final_url, allowed_hosts=source.allowed_hosts)
        return ConnectorObservation(
            source_id=source.id,
            url=document.final_url,
            retrieved_at=document.retrieved_at,
            title=document.title,
            content_text=document.text,
            country_iso3=country_iso3,
            event_type_hint=event_type_hint,
            sector=sector,
            sensitive=sensitive,
        )


class FixtureConnector:
    """Deterministic connector used to evaluate the full pipeline without network I/O."""

    def __init__(self, observations: list[ConnectorObservation]) -> None:
        self._observations = list(observations)

    def fetch(self) -> list[ConnectorObservation]:
        return list(self._observations)


class ConnectorPipeline:
    """Validator → classifier → provenance → updater for connector observations."""

    def __init__(
        self,
        registry: SourceRegistry,
        gate: ProvenanceGate,
        store: WorldStateStore,
        repository: SQLiteStateRepository | None = None,
        url_policy: PublicUrlPolicy | None = None,
    ) -> None:
        self._registry = registry
        self._gate = gate
        self._store = store
        self._repository = repository
        self._url_policy = url_policy or PublicUrlPolicy()

    def process(self, observation: ConnectorObservation) -> AcceptedEvent:
        source = self._registry.get(observation.source_id)
        if source is None or not source.active:
            raise ValueError("unknown or inactive source")

        if source.license_class.strip().lower() not in CRAWLABLE_LICENSE_CLASSES:
            raise ValueError("license class is not crawlable")
        if not source.allowed_hosts:
            raise ValueError("source has no registered crawl hosts")

        self._url_policy.validate(observation.url, allowed_hosts=source.allowed_hosts)
        event = self._classify(observation, source.reliability_tier)
        decision = self._gate.evaluate(event)
        if not decision.accepted:
            reasons = ",".join(decision.reasons)
            raise ValueError(f"provenance rejected: {reasons}")

        accepted = AcceptedEvent(event=event, provenance=decision)
        if self._repository is not None:
            self._repository.save_event(accepted)
        return self._store.add(event, decision)

    @staticmethod
    def _classify(observation: ConnectorObservation, reliability_tier: int) -> EventInput:
        fingerprint = "\n".join(
            [
                observation.source_id,
                observation.url,
                observation.title,
                observation.content_text,
            ]
        )
        event_id = f"conn-{hashlib.sha256(fingerprint.encode('utf-8')).hexdigest()[:40]}"
        confidence_by_tier = {
            1: 0.90,
            2: 0.82,
            3: 0.70,
            4: 0.55,
            5: 0.40,
        }
        return EventInput(
            id=event_id,
            event_type=observation.event_type_hint,
            title=observation.title,
            country_iso3=observation.country_iso3,
            observed_at=observation.retrieved_at,
            source_ids=[observation.source_id],
            confidence=confidence_by_tier[reliability_tier],
            corroboration_count=1,
            sensitive=observation.sensitive,
            summary=observation.content_text[:4000],
            sector=observation.sector,
        )
