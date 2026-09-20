from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

DecisionKind = Literal['REPAIR', 'MAKE', 'SOURCE', 'IMPORT']


@dataclass(frozen=True)
class ManufacturingNode:
    node_id: str
    name: str
    country: str
    jurisdiction: str
    status: str
    available_capacity: float
    lead_time_hours: float
    unit_cost: float
    local_content_ratio: float
    energy_state: str
    connectivity_state: str
    quality_state: str
    machine_types: tuple[str, ...]
    processes: tuple[str, ...]
    materials: tuple[str, ...]
    workforce_skills: tuple[str, ...]
    certifications: tuple[str, ...]
    permissions: tuple[str, ...]
    constraints: tuple[str, ...] = ()
    evidence_refs: tuple[str, ...] = ()


@dataclass(frozen=True)
class ManufacturingDesign:
    design_id: str
    owner: str
    version: str
    ip_rights_status: str
    expired: bool
    bom: tuple[str, ...]
    allowed_materials: tuple[str, ...]
    allowed_machine_types: tuple[str, ...]
    allowed_jurisdictions: tuple[str, ...]
    required_certifications: tuple[str, ...]
    authorized_uses: tuple[str, ...]
    evidence_refs: tuple[str, ...] = ()


@dataclass(frozen=True)
class ExternalOption:
    kind: Literal['SOURCE', 'IMPORT']
    provider_id: str
    total_cost: float
    lead_time_hours: float
    risk_score: float
    compliant: bool
    local_content_ratio: float = 0.0
    evidence_refs: tuple[str, ...] = ()


@dataclass(frozen=True)
class ManufacturingNeed:
    need_id: str
    quantity: float
    required_by_hours: float
    downtime_cost_per_hour: float
    requested_use: str
    required_material: str
    required_machine_type: str
    required_certifications: tuple[str, ...]
    repair_feasible: bool
    repair_cost: float
    repair_lead_time_hours: float
    repair_risk_score: float
    baseline_import_cost: float
    baseline_import_lead_time_hours: float


@dataclass(frozen=True)
class OptionAssessment:
    kind: DecisionKind
    feasible: bool
    total_cost: float | None
    lead_time_hours: float | None
    risk_score: float | None
    score: float | None
    rationale: tuple[str, ...]
    node_id: str | None = None
    provider_id: str | None = None
    local_content_ratio: float = 0.0


@dataclass(frozen=True)
class ManufacturingDecision:
    need_id: str
    decision: DecisionKind | Literal['NO_FEASIBLE_OPTION']
    selected: OptionAssessment | None
    options: tuple[OptionAssessment, ...]
    industrial_availability_value: float
    downtime_avoided_hours: float
    lead_time_avoided_hours: float
    import_cost_avoided: float
    local_value_created: float


def _validate_ratio(value: float, field: str) -> None:
    if value < 0 or value > 1:
        raise ValueError(f'{field} must be between 0 and 1')


def _make_candidate(need: ManufacturingNeed, design: ManufacturingDesign | None, node: ManufacturingNode) -> OptionAssessment:
    reasons: list[str] = []
    if design is None:
        reasons.append('design_missing')
    else:
        if design.ip_rights_status != 'AUTHORIZED':
            reasons.append('ip_rights_not_authorized')
        if design.expired:
            reasons.append('design_expired')
        if need.requested_use not in design.authorized_uses:
            reasons.append('use_not_authorized')
        if need.required_material not in design.allowed_materials:
            reasons.append('material_not_allowed_by_design')
        if need.required_machine_type not in design.allowed_machine_types:
            reasons.append('machine_not_allowed_by_design')
        if '*' not in design.allowed_jurisdictions and node.jurisdiction not in design.allowed_jurisdictions:
            reasons.append('jurisdiction_not_allowed')
        if not set(design.required_certifications).issubset(set(node.certifications)):
            reasons.append('design_certification_gap')
    if node.status != 'AVAILABLE':
        reasons.append('node_not_available')
    if node.quality_state != 'QUALIFIED':
        reasons.append('node_not_qualified')
    if node.available_capacity < need.quantity:
        reasons.append('insufficient_capacity')
    if 'MANUFACTURE' not in node.permissions:
        reasons.append('manufacture_permission_missing')
    if need.required_material not in node.materials:
        reasons.append('material_unavailable')
    if need.required_machine_type not in node.machine_types:
        reasons.append('machine_type_unavailable')
    if not set(need.required_certifications).issubset(set(node.certifications)):
        reasons.append('need_certification_gap')
    if reasons:
        return OptionAssessment('MAKE', False, None, None, None, None, tuple(reasons), node_id=node.node_id)
    _validate_ratio(node.local_content_ratio, 'local_content_ratio')
    risk = 0.10
    if node.energy_state != 'STABLE':
        risk += 0.15
    if node.connectivity_state not in {'ONLINE', 'OFFLINE_READY'}:
        risk += 0.05
    risk += min(len(node.constraints) * 0.02, 0.20)
    return OptionAssessment(
        'MAKE',
        True,
        node.unit_cost * need.quantity,
        node.lead_time_hours,
        min(risk, 1.0),
        None,
        ('authorized_design', 'qualified_node', 'capacity_available'),
        node_id=node.node_id,
        local_content_ratio=node.local_content_ratio,
    )


def resolve_manufacturing(
    need: ManufacturingNeed,
    nodes: list[ManufacturingNode],
    design: ManufacturingDesign | None,
    external_options: list[ExternalOption],
) -> ManufacturingDecision:
    if need.quantity <= 0:
        raise ValueError('quantity must be > 0')
    if need.required_by_hours < 0 or need.downtime_cost_per_hour < 0:
        raise ValueError('time and downtime cost must be >= 0')
    options: list[OptionAssessment] = []

    if need.repair_feasible:
        _validate_ratio(need.repair_risk_score, 'repair_risk_score')
        options.append(OptionAssessment(
            'REPAIR',
            True,
            need.repair_cost,
            need.repair_lead_time_hours,
            need.repair_risk_score,
            None,
            ('repair_feasible',),
        ))
    else:
        options.append(OptionAssessment('REPAIR', False, None, None, None, None, ('repair_not_feasible',)))

    make_candidates = [_make_candidate(need, design, node) for node in nodes]
    feasible_make = [item for item in make_candidates if item.feasible]
    if feasible_make:
        options.extend(feasible_make)
    elif make_candidates:
        reasons = sorted({reason for item in make_candidates for reason in item.rationale})
        options.append(OptionAssessment('MAKE', False, None, None, None, None, tuple(reasons)))
    else:
        options.append(OptionAssessment('MAKE', False, None, None, None, None, ('no_manufacturing_node',)))

    for external in external_options:
        _validate_ratio(external.risk_score, 'external risk_score')
        _validate_ratio(external.local_content_ratio, 'external local_content_ratio')
        if not external.compliant:
            options.append(OptionAssessment(
                external.kind, False, None, None, None, None, ('compliance_failed',), provider_id=external.provider_id
            ))
            continue
        options.append(OptionAssessment(
            external.kind,
            True,
            external.total_cost,
            external.lead_time_hours,
            external.risk_score,
            None,
            ('compliant_external_option',),
            provider_id=external.provider_id,
            local_content_ratio=external.local_content_ratio,
        ))

    feasible = [item for item in options if item.feasible and item.total_cost is not None and item.lead_time_hours is not None and item.risk_score is not None]
    if not feasible:
        return ManufacturingDecision(need.need_id, 'NO_FEASIBLE_OPTION', None, tuple(options), 0.0, 0.0, 0.0, 0.0, 0.0)

    max_cost = max(item.total_cost or 0.0 for item in feasible) or 1.0
    max_lead = max(item.lead_time_hours or 0.0 for item in feasible) or 1.0
    scored: list[OptionAssessment] = []
    for item in options:
        if not item.feasible or item.total_cost is None or item.lead_time_hours is None or item.risk_score is None:
            scored.append(item)
            continue
        deadline_penalty = 0.5 if item.lead_time_hours > need.required_by_hours else 0.0
        score = 0.45 * (item.total_cost / max_cost) + 0.35 * (item.lead_time_hours / max_lead) + 0.20 * item.risk_score + deadline_penalty
        scored.append(OptionAssessment(
            item.kind,
            True,
            item.total_cost,
            item.lead_time_hours,
            item.risk_score,
            round(score, 6),
            item.rationale + (('deadline_missed',) if deadline_penalty else ('deadline_met',)),
            item.node_id,
            item.provider_id,
            item.local_content_ratio,
        ))

    selected = min(
        (item for item in scored if item.feasible and item.score is not None),
        key=lambda item: (item.score, item.lead_time_hours or 0.0, item.total_cost or 0.0),
    )
    lead_avoided = max(0.0, need.baseline_import_lead_time_hours - (selected.lead_time_hours or 0.0))
    cost_avoided = max(0.0, need.baseline_import_cost - (selected.total_cost or 0.0))
    local_value = (selected.total_cost or 0.0) * selected.local_content_ratio
    availability_value = lead_avoided * need.downtime_cost_per_hour + cost_avoided + local_value
    return ManufacturingDecision(
        need.need_id,
        selected.kind,
        selected,
        tuple(scored),
        round(availability_value, 2),
        round(lead_avoided, 2),
        round(lead_avoided, 2),
        round(cost_avoided, 2),
        round(local_value, 2),
    )
