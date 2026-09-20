from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.domain.manufacturing import ExternalOption, ManufacturingDesign, ManufacturingNeed, ManufacturingNode
from app.services.manufacturing import ManufacturingService


class NodePayload(BaseModel):
    node_id: str
    name: str
    country: str
    jurisdiction: str
    status: str
    available_capacity: float = Field(gt=0)
    lead_time_hours: float = Field(ge=0)
    unit_cost: float = Field(ge=0)
    local_content_ratio: float = Field(ge=0, le=1)
    energy_state: str
    connectivity_state: str
    quality_state: str
    machine_types: list[str] = Field(default_factory=list)
    processes: list[str] = Field(default_factory=list)
    materials: list[str] = Field(default_factory=list)
    workforce_skills: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    evidence_refs: list[str] = Field(default_factory=list)


class DesignPayload(BaseModel):
    design_id: str
    owner: str
    version: str
    ip_rights_status: str
    expired: bool = False
    bom: list[str] = Field(default_factory=list)
    allowed_materials: list[str] = Field(default_factory=list)
    allowed_machine_types: list[str] = Field(default_factory=list)
    allowed_jurisdictions: list[str] = Field(default_factory=list)
    required_certifications: list[str] = Field(default_factory=list)
    authorized_uses: list[str] = Field(default_factory=list)
    evidence_refs: list[str] = Field(default_factory=list)


class ExternalOptionPayload(BaseModel):
    kind: str
    provider_id: str
    total_cost: float = Field(ge=0)
    lead_time_hours: float = Field(ge=0)
    risk_score: float = Field(ge=0, le=1)
    compliant: bool
    local_content_ratio: float = Field(default=0, ge=0, le=1)
    evidence_refs: list[str] = Field(default_factory=list)


class NeedPayload(BaseModel):
    need_id: str
    quantity: float = Field(gt=0)
    required_by_hours: float = Field(ge=0)
    downtime_cost_per_hour: float = Field(ge=0)
    requested_use: str
    required_material: str
    required_machine_type: str
    required_certifications: list[str] = Field(default_factory=list)
    repair_feasible: bool
    repair_cost: float = Field(ge=0)
    repair_lead_time_hours: float = Field(ge=0)
    repair_risk_score: float = Field(ge=0, le=1)
    baseline_import_cost: float = Field(ge=0)
    baseline_import_lead_time_hours: float = Field(ge=0)


class ResolvePayload(BaseModel):
    actor: str = 'operator'
    need: NeedPayload
    design_id: str | None = None
    external_options: list[ExternalOptionPayload] = Field(default_factory=list)


def _node(payload: NodePayload) -> ManufacturingNode:
    data = payload.model_dump()
    for key in ('machine_types','processes','materials','workforce_skills','certifications','permissions','constraints','evidence_refs'):
        data[key] = tuple(data[key])
    return ManufacturingNode(**data)


def _design(payload: DesignPayload) -> ManufacturingDesign:
    data = payload.model_dump()
    for key in ('bom','allowed_materials','allowed_machine_types','allowed_jurisdictions','required_certifications','authorized_uses','evidence_refs'):
        data[key] = tuple(data[key])
    return ManufacturingDesign(**data)


def _need(payload: NeedPayload) -> ManufacturingNeed:
    data = payload.model_dump()
    data['required_certifications'] = tuple(data['required_certifications'])
    return ManufacturingNeed(**data)


def _external(payload: ExternalOptionPayload) -> ExternalOption:
    if payload.kind not in {'SOURCE','IMPORT'}:
        raise ValueError('external option kind must be SOURCE or IMPORT')
    data = payload.model_dump()
    data['evidence_refs'] = tuple(data['evidence_refs'])
    return ExternalOption(**data)


def build_manufacturing_router(service: ManufacturingService, engineer_mutation_dependency, operator_mutation_dependency) -> APIRouter:
    router = APIRouter(tags=['manufacturing'])

    @router.post('/manufacturing/nodes', status_code=201, dependencies=[Depends(engineer_mutation_dependency)])
    def register_node(payload: NodePayload, actor: str = 'engineer'):
        try:
            return asdict(service.register_node(_node(payload), actor))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @router.get('/manufacturing/nodes')
    def list_nodes():
        return [asdict(item) for item in service.list_nodes()]

    @router.post('/manufacturing/designs', status_code=201, dependencies=[Depends(engineer_mutation_dependency)])
    def register_design(payload: DesignPayload, actor: str = 'engineer'):
        try:
            return asdict(service.register_design(_design(payload), actor))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @router.get('/manufacturing/designs')
    def list_designs():
        return [asdict(item) for item in service.list_designs()]

    @router.post('/manufacturing/resolve', dependencies=[Depends(operator_mutation_dependency)])
    def resolve(payload: ResolvePayload):
        try:
            result = service.resolve(
                _need(payload.need),
                payload.design_id,
                [_external(item) for item in payload.external_options],
                payload.actor,
            )
            return asdict(result)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    return router
