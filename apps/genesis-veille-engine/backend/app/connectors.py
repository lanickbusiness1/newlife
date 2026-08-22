from __future__ import annotations

import hashlib
import ipaddress
from datetime import datetime
from urllib.parse import SplitResult, urlsplit

from pydantic import BaseModel, Field, field_validator

from .models import AcceptedEvent, EventInput
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
