from datetime import datetime, timezone

import pytest

from app.connectors import FetchedDocument, PublicHttpConnector, SafeHttpTransport
from app.models import SourceRecord


class FakeTransport:
    def fetch(self, url: str, *, allowed_hosts: list[str]) -> FetchedDocument:
        assert allowed_hosts == ["example.org"]
        return FetchedDocument(
            final_url=url,
            content_type="text/html",
            retrieved_at=datetime(2026, 8, 22, 3, 20, tzinfo=timezone.utc),
            title="Public funding notice",
            text="Funding opportunity for Mali is open.",
        )


def source() -> SourceRecord:
    return SourceRecord(
        id="src-http-1",
        name="Public Official Feed",
        source_type="official",
        license_class="public",
        reliability_tier=1,
        active=True,
        allowed_hosts=["example.org"],
    )


def test_safe_transport_rejects_private_dns_resolution():
    transport = SafeHttpTransport()

    transport.validate_resolved_addresses("example.org", ["93.184.216.34"])

    for address in ("127.0.0.1", "10.1.2.3", "169.254.169.254", "::1", "fc00::1"):
        with pytest.raises(ValueError, match="non-public address"):
            transport.validate_resolved_addresses("example.org", [address])


def test_safe_transport_honors_robots_disallow():
    transport = SafeHttpTransport()
    robots = "User-agent: *\nDisallow: /private\nAllow: /public\n"

    assert transport.robots_allows(robots, "https://example.org/public/notice") is True
    assert transport.robots_allows(robots, "https://example.org/private/notice") is False


def test_public_http_connector_builds_bounded_observation_from_transport():
    connector = PublicHttpConnector(transport=FakeTransport())

    item = connector.fetch(
        source=source(),
        url="https://example.org/notices/1",
        country_iso3="MLI",
        event_type_hint="funding",
        sector="humanitarian",
    )

    assert item.source_id == "src-http-1"
    assert item.url == "https://example.org/notices/1"
    assert item.country_iso3 == "MLI"
    assert item.event_type_hint == "funding"
    assert item.title == "Public funding notice"
    assert item.content_text == "Funding opportunity for Mali is open."


def test_public_http_connector_rejects_source_without_crawl_host_before_transport():
    no_host_source = source().model_copy(update={"allowed_hosts": []})
    connector = PublicHttpConnector(transport=FakeTransport())

    with pytest.raises(ValueError, match="source has no registered crawl hosts"):
        connector.fetch(
            source=no_host_source,
            url="https://example.org/notices/1",
            country_iso3="MLI",
            event_type_hint="funding",
        )
