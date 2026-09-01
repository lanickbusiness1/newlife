from __future__ import annotations

from dataclasses import asdict
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.domain.models import TelemetryPoint
from app.persistence.repositories import TelemetryRepository
from app.services.telemetry import BatchTooLarge, TelemetryService


class TelemetryPointInput(BaseModel):
    point_id: str = Field(min_length=1)
    asset_id: str = Field(min_length=1)
    metric: str = Field(min_length=1)
    unit: str = Field(min_length=1)
    timestamp: str = Field(min_length=1)
    value: float
    quality: Literal['GOOD', 'STALE', 'INVALID', 'SUSPECT']
    source: Literal['SIMULATOR', 'MQTT', 'OPCUA']
    provenance_id: str = Field(min_length=1)


class TelemetryBatchInput(BaseModel):
    batch_id: str = Field(min_length=1)
    points: list[TelemetryPointInput]


def build_telemetry_router(service: TelemetryService) -> APIRouter:
    router = APIRouter(tags=['telemetry'])

    @router.post('/telemetry/batch')
    def ingest(payload: TelemetryBatchInput):
        try:
            points = [TelemetryPoint(**point.model_dump()) for point in payload.points]
            result = service.ingest_batch(payload.batch_id, points)
        except BatchTooLarge as exc:
            raise HTTPException(status_code=413, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        body = {'batch_id': result.batch_id, 'accepted': result.accepted, 'rejected': result.rejected, 'duplicate': result.duplicate, 'points': [asdict(point) for point in result.points]}
        return JSONResponse(body, status_code=200 if result.duplicate else 202)

    @router.get('/telemetry')
    def telemetry(asset_id: str = Query(min_length=1), metric: str | None = None):
        return [asdict(point) for point in TelemetryRepository(service.conn).list_for_asset(asset_id, metric)]

    return router
