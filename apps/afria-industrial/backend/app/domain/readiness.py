from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

EvidenceStatus = Literal['OBSERVED', 'DECLARED', 'ASSUMED']
DIMENSION_KEYS = ('asset_visibility','instrumentation_coverage','protocol_interoperability','data_quality','ot_network_resilience','cybersecurity_baseline','maintenance_maturity','energy_production_observability','edge_offline_readiness','governance_sovereignty','skills_operating_ownership','business_case_readiness')

@dataclass(frozen=True)
class DimensionInput:
    score: float
    evidence_status: EvidenceStatus
    gaps: list[str]

@dataclass(frozen=True)
class DimensionResult:
    score: float
    confidence: float
    evidence_status: EvidenceStatus
    gaps: tuple[str, ...]
    risk: str
    recommended_action: str
    implementation_horizon: str

@dataclass(frozen=True)
class ReadinessAssessment:
    assessment_id: str
    overall_score: float
    dimensions: dict[str, DimensionResult]

def score_dimension(value: DimensionInput) -> DimensionResult:
    if not 0 <= value.score <= 100: raise ValueError('score must be between 0 and 100')
    confidence = {'OBSERVED': 1.0, 'DECLARED': 0.65, 'ASSUMED': 0.35}[value.evidence_status]
    if value.score < 40: risk, action, horizon = 'HIGH', 'Remediate foundational gaps before pilot.', '0-30 days'
    elif value.score < 70: risk, action, horizon = 'MEDIUM', 'Close priority evidence and interoperability gaps.', '30-60 days'
    else: risk, action, horizon = 'LOW', 'Validate remaining gaps in a controlled pilot.', '60-90 days'
    return DimensionResult(value.score, confidence, value.evidence_status, tuple(value.gaps), risk, action, horizon)

def score_readiness(inputs: dict[str, DimensionInput], assessment_id: str = '') -> ReadinessAssessment:
    if set(inputs) != set(DIMENSION_KEYS): raise ValueError('readiness requires exactly the 12 canonical dimensions')
    dimensions = {key: score_dimension(inputs[key]) for key in DIMENSION_KEYS}
    return ReadinessAssessment(assessment_id, sum(item.score for item in dimensions.values()) / len(dimensions), dimensions)
