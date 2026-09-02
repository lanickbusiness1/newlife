from datetime import datetime, timezone

import pytest

from app.connectors import (
    ConnectorObservation,
    ConnectorPipeline,
    FixtureConnector,
    PublicUrlPolicy,
)
from app.models import SourceRecord
from app.provenance import ProvenanceGate
from app.source_registry import SourceRegistry
from app.world_state import WorldStateStore


def source(
    source_id: str = "src-official",
    *,
    active: bool = True,
    license_class: str = "public",
    allowed_hosts: list[str] | None = None,
) -> SourceRecord:
    return SourceRecord(
        id=source_id,
        name="Official public source",
        source_type="official",
        license_class=license_class,
        reliability_tier=1,
        active=active,
        allowed_hosts=allowed_hosts or ["example.org"],
    )


def observation(**overrides) -> ConnectorObservation:
    payload = {
        "source_id": "src-official",
        "url": "https://example.org/funding/notice-1",
        "retrieved_at": datetime(2026, 8, 22, 3, 10, tzinfo=timezone.utc),
        "title": "Funding window opened for Mali",
        "content_text": "A verified public funding opportunity is now open.",
        "country_iso3": "MLI",
        "event_type_hint": "funding",
        "sector": "humanitarian",
        "sensitive": False,
    }
    payload.update(overrides)
    return ConnectorObservation(**payload)


def pipeline(registry: SourceRegistry) -> tuple[ConnectorPipeline, WorldStateStore]:
    store = WorldStateStore()
    return ConnectorPipeline(registry, ProvenanceGate(registry), store), store


def test_public_url_policy_rejects_non_https_credentials_and_private_hosts():
    policy = PublicUrlPolicy()

    for url in (
        "http://example.org/news",
        "https://user:pass@example.org/news",
        "https://localhost/news",
        "https://127.0.0.1/news",
        "https://10.0.0.1/news",
        "https://169.254.169.254/latest/meta-data/",
        "https://[::1]/news",
    ):
        with pytest.raises(ValueError):
            policy.validate(url, allowed_hosts=["example.org"])


def test_public_url_policy_requires_exact_registered_host():
    policy = PublicUrlPolicy()

    assert policy.validate(
        "https://example.org/notices/1",
        allowed_hosts=["example.org"],
    ).hostname == "example.org"

    with pytest.raises(ValueError, match="host is not registered"):
        policy.validate(
            "https://other.example.org/notices/1",
            allowed_hosts=["example.org"],
        )


def test_pipeline_rejects_unknown_inactive_or_nonpublic_sources():
    registry = SourceRegistry([source(active=False), source("src-restricted", license_class="restricted")])
    processor, store = pipeline(registry)

    with pytest.raises(ValueError, match="unknown or inactive source"):
        processor.process(observation(source_id="unknown"))
    with pytest.raises(ValueError, match="unknown or inactive source"):
        processor.process(observation())
    with pytest.raises(ValueError, match="license class is not crawlable"):
        processor.process(observation(source_id="src-restricted"))

    assert store.list_events() == []


def test_fixture_connector_flows_through_classifier_provenance_and_world_state():
    registry = SourceRegistry([source()])
    processor, store = pipeline(registry)
    connector = FixtureConnector([observation()])

    accepted = processor.process(connector.fetch()[0])
    state = store.country_state("MLI")

    assert accepted.provenance.status == "VERIFIED"
    assert accepted.event.event_type == "funding"
    assert accepted.event.country_iso3 == "MLI"
    assert accepted.event.source_ids == ["src-official"]
    assert accepted.event.id.startswith("conn-")
    assert state["event_count"] == 1
    assert state["opportunity_score"] == 10.0


def test_sensitive_single_source_connector_observation_is_rejected():
    registry = SourceRegistry([source()])
    processor, store = pipeline(registry)

    with pytest.raises(ValueError, match="provenance rejected"):
        processor.process(observation(sensitive=True))

    assert store.list_events() == []


def test_same_observation_is_idempotent_and_cannot_inflate_state():
    registry = SourceRegistry([source()])
    processor, store = pipeline(registry)
    item = observation()

    processor.process(item)
    with pytest.raises(ValueError, match="duplicate event id"):
        processor.process(item)

    assert store.country_state("MLI")["event_count"] == 1
