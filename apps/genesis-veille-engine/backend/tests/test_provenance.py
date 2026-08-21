from datetime import datetime, timezone

from app.models import EventInput, SourceRecord
from app.provenance import ProvenanceGate
from app.source_registry import SourceRegistry


def source(source_id: str, reliability_tier: int = 1, active: bool = True) -> SourceRecord:
    return SourceRecord(
        id=source_id,
        name=f"Source {source_id}",
        source_type="official",
        license_class="public",
        reliability_tier=reliability_tier,
        active=active,
    )


def event(**overrides) -> EventInput:
    payload = {
        "id": "evt-1",
        "event_type": "internet_outage",
        "title": "Connectivity disruption",
        "country_iso3": "MLI",
        "observed_at": datetime(2026, 8, 21, 12, 0, tzinfo=timezone.utc),
        "source_ids": ["src-1"],
        "confidence": 0.9,
        "corroboration_count": 1,
        "sensitive": False,
        "sector": "telecom",
    }
    payload.update(overrides)
    return EventInput(**payload)


def test_rejects_event_with_unknown_source():
    registry = SourceRegistry()
    decision = ProvenanceGate(registry).evaluate(event())

    assert decision.accepted is False
    assert decision.status == "REJECTED"
    assert "unknown_or_inactive_source:src-1" in decision.reasons


def test_rejects_sensitive_single_source_event():
    registry = SourceRegistry([source("src-1")])
    decision = ProvenanceGate(registry).evaluate(event(sensitive=True))

    assert decision.accepted is False
    assert decision.status == "REJECTED"
    assert "sensitive_event_requires_two_distinct_sources" in decision.reasons


def test_accepts_corroborated_sensitive_event():
    registry = SourceRegistry([source("src-1"), source("src-2", reliability_tier=2)])
    decision = ProvenanceGate(registry).evaluate(
        event(
            sensitive=True,
            source_ids=["src-1", "src-2"],
            corroboration_count=2,
            confidence=0.86,
        )
    )

    assert decision.accepted is True
    assert decision.status == "CORROBORATED"
    assert decision.reasons == []


def test_low_confidence_single_source_is_observation_only():
    registry = SourceRegistry([source("src-1", reliability_tier=1)])
    decision = ProvenanceGate(registry).evaluate(event(confidence=0.49))

    assert decision.accepted is True
    assert decision.status == "OBSERVATION_ONLY"
    assert "single_source_not_verified" in decision.reasons
