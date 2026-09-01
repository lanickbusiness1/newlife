from __future__ import annotations
import json, sqlite3, uuid
from dataclasses import asdict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.domain.readiness import DimensionInput, ReadinessAssessment, score_readiness
from app.services.evidence import EvidenceService

class DimensionPayload(BaseModel):
    score: float = Field(ge=0, le=100)
    evidence_status: str
    gaps: list[str] = []
class AssessmentPayload(BaseModel):
    site_id: str
    actor: str
    dimensions: dict[str, DimensionPayload]
class ReadinessService:
    def __init__(self, conn: sqlite3.Connection, evidence: EvidenceService) -> None:
        self.conn, self.evidence = conn, evidence
    def create(self, site_id: str, actor: str, inputs: dict[str, DimensionInput]) -> ReadinessAssessment:
        assessment_id = str(uuid.uuid4()); assessment = score_readiness(inputs, assessment_id)
        payload = {key: asdict(value) for key, value in assessment.dimensions.items()}
        self.conn.execute('INSERT INTO readiness_assessments(assessment_id, site_id, overall_score, dimensions_json) VALUES (?, ?, ?, ?)', (assessment_id, site_id, assessment.overall_score, json.dumps(payload, sort_keys=True)))
        self.evidence._append_no_commit('READINESS_ASSESSMENT_GENERATED', actor, {'site_id': site_id, 'assessment_id': assessment_id}, {'overall_score': assessment.overall_score, 'dimensions': payload}, [])
        self.conn.commit(); return assessment
    def get(self, assessment_id: str) -> dict | None:
        row = self.conn.execute('SELECT * FROM readiness_assessments WHERE assessment_id=?', (assessment_id,)).fetchone(); return dict(row) if row else None

def build_readiness_router(service: ReadinessService) -> APIRouter:
    router = APIRouter(tags=['readiness'])
    @router.post('/readiness/assessments', status_code=201)
    def create_assessment(payload: AssessmentPayload):
        try:
            inputs = {key: DimensionInput(item.score, item.evidence_status, item.gaps) for key, item in payload.dimensions.items()}
            return asdict(service.create(payload.site_id, payload.actor, inputs))
        except (ValueError, KeyError) as exc: raise HTTPException(status_code=422, detail=str(exc)) from exc
    @router.get('/readiness/assessments/{assessment_id}')
    def get_assessment(assessment_id: str):
        row = service.get(assessment_id)
        if row is None: raise HTTPException(status_code=404, detail='assessment not found')
        return row
    return router
