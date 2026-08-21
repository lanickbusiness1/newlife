from datetime import datetime, timezone

from app.models import EventInput, ProvenanceDecision
from app.world_state import WorldStateStore


def make_event(
    event_id: str,
    event_type: str,
    confidence: float,
    sector: str,
    minute: int,
) -> EventInput:
    return EventInput(
        id=event_id,
        event_type=event_type,
        title=event_type.replace("_", " ").title(),
        country_iso3="mli",
        observed_at=datetime(2026, 8, 21, 12, minute, tzinfo=timezone.utc),
        source_ids=["src-1"],
        confidence=confidence,
        corroboration_count=1,
        sensitive=False,
        sector=sector,
    )


def test_country_state_aggregates_events_and_explainable_scores():
    store = WorldStateStore()
    verified = ProvenanceDecision(accepted=True, status="VERIFIED", reasons=[])
    corroborated = ProvenanceDecision(accepted=True, status="CORROBORATED", reasons=[])

    store.add(make_event("risk-1", "internet_outage", 0.90, "telecom", 1), verified)
    store.add(make_event("opp-1", "funding", 0.80, "finance", 2), corroborated)

    state = store.country_state("mli")

    assert state["country_iso3"] == "MLI"
    assert state["event_count"] == 2
    assert state["latest_observed_at"] == datetime(2026, 8, 21, 12, 2, tzinfo=timezone.utc)
    assert state["event_type_counts"] == {"internet_outage": 1, "funding": 1}
    assert state["sector_counts"] == {"telecom": 1, "finance": 1}
    assert state["provenance_counts"] == {"VERIFIED": 1, "CORROBORATED": 1}
    assert state["average_confidence"] == 0.85
    assert state["risk_score"] == 10.0
    assert state["opportunity_score"] == 10.0


def test_low_confidence_matching_event_contributes_half_score():
    store = WorldStateStore()
    observation = ProvenanceDecision(
        accepted=True,
        status="OBSERVATION_ONLY",
        reasons=["single_source_not_verified"],
    )
    store.add(make_event("risk-low", "cyber", 0.40, "cyber", 3), observation)

    state = store.country_state("MLI")

    assert state["risk_score"] == 5.0
    assert state["opportunity_score"] == 0.0


def test_rejected_event_cannot_enter_world_state():
    store = WorldStateStore()
    rejected = ProvenanceDecision(accepted=False, status="REJECTED", reasons=["bad provenance"])

    try:
        store.add(make_event("bad", "conflict", 0.90, "security", 4), rejected)
    except ValueError as exc:
        assert str(exc) == "cannot store rejected event"
    else:
        raise AssertionError("rejected event was stored")
