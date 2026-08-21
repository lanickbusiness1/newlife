from __future__ import annotations

from collections import Counter
from typing import Any

from .models import AcceptedEvent, EventInput, ProvenanceDecision


RISK_EVENT_TYPES = {
    "conflict",
    "cyber",
    "internet_outage",
    "natural_hazard",
    "energy_disruption",
    "maritime_disruption",
}

OPPORTUNITY_EVENT_TYPES = {
    "funding",
    "investment",
    "tender",
    "infrastructure_launch",
    "market_growth",
    "technology_launch",
}


class WorldStateStore:
    def __init__(self) -> None:
        self._events: list[AcceptedEvent] = []
        self._event_ids: set[str] = set()

    def add(self, event: EventInput, decision: ProvenanceDecision) -> AcceptedEvent:
        if not decision.accepted:
            raise ValueError("cannot store rejected event")
        if event.id in self._event_ids:
            raise ValueError("duplicate event id")

        accepted = AcceptedEvent(event=event, provenance=decision)
        self._events.append(accepted)
        self._event_ids.add(event.id)
        return accepted

    def list_events(self) -> list[AcceptedEvent]:
        return list(self._events)

    def country_state(self, iso3: str) -> dict[str, Any]:
        country_iso3 = iso3.upper()
        matches = [item for item in self._events if item.event.country_iso3 == country_iso3]

        if not matches:
            return {
                "country_iso3": country_iso3,
                "event_count": 0,
                "latest_observed_at": None,
                "event_type_counts": {},
                "sector_counts": {},
                "provenance_counts": {},
                "average_confidence": 0.0,
                "risk_score": 0.0,
                "opportunity_score": 0.0,
            }

        event_type_counts = Counter(item.event.event_type for item in matches)
        sector_counts = Counter(item.event.sector for item in matches if item.event.sector)
        provenance_counts = Counter(item.provenance.status for item in matches)
        average_confidence = round(
            sum(item.event.confidence for item in matches) / len(matches),
            4,
        )

        return {
            "country_iso3": country_iso3,
            "event_count": len(matches),
            "latest_observed_at": max(item.event.observed_at for item in matches),
            "event_type_counts": dict(event_type_counts),
            "sector_counts": dict(sector_counts),
            "provenance_counts": dict(provenance_counts),
            "average_confidence": average_confidence,
            "risk_score": self._score(matches, RISK_EVENT_TYPES),
            "opportunity_score": self._score(matches, OPPORTUNITY_EVENT_TYPES),
        }

    @staticmethod
    def _score(events: list[AcceptedEvent], matching_types: set[str]) -> float:
        total = 0.0
        for item in events:
            if item.event.event_type not in matching_types:
                continue
            total += 5.0 if item.event.confidence < 0.50 else 10.0
        return min(100.0, total)
