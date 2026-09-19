from __future__ import annotations

from .models import EventInput, ProvenanceDecision
from .source_registry import SourceRegistry


class ProvenanceGate:
    def __init__(self, registry: SourceRegistry) -> None:
        self._registry = registry

    def evaluate(self, event: EventInput) -> ProvenanceDecision:
        unique_source_ids = list(dict.fromkeys(event.source_ids))
        sources = []
        reasons: list[str] = []

        for source_id in unique_source_ids:
            source = self._registry.get(source_id)
            if source is None or not source.active:
                reasons.append(f"unknown_or_inactive_source:{source_id}")
            else:
                sources.append(source)

        if reasons:
            return ProvenanceDecision(accepted=False, status="REJECTED", reasons=reasons)

        if event.sensitive:
            if len(unique_source_ids) < 2:
                reasons.append("sensitive_event_requires_two_distinct_sources")
            if event.corroboration_count < 2:
                reasons.append("sensitive_event_requires_corroboration_count_2")
            if reasons:
                return ProvenanceDecision(accepted=False, status="REJECTED", reasons=reasons)
            return ProvenanceDecision(accepted=True, status="CORROBORATED", reasons=[])

        if len(unique_source_ids) >= 2 and event.corroboration_count >= 2:
            return ProvenanceDecision(accepted=True, status="CORROBORATED", reasons=[])

        best_tier = min(source.reliability_tier for source in sources)
        if best_tier <= 2 and event.confidence >= 0.80:
            return ProvenanceDecision(accepted=True, status="VERIFIED", reasons=[])

        return ProvenanceDecision(
            accepted=True,
            status="OBSERVATION_ONLY",
            reasons=["single_source_not_verified"],
        )
