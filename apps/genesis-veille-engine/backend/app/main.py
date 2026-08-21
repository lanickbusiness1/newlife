from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException, status
from fastapi.responses import FileResponse

from .models import AcceptedEvent, EventInput, SourceRecord
from .provenance import ProvenanceGate
from .source_registry import SourceRegistry
from .world_state import WorldStateStore


SERVICE_NAME = "genesis-veille-world-state"
SERVICE_VERSION = "0.1.0"
FRONTEND_INDEX = Path(__file__).resolve().parents[2] / "frontend" / "index.html"


def create_app() -> FastAPI:
    registry = SourceRegistry()
    gate = ProvenanceGate(registry)
    store = WorldStateStore()

    app = FastAPI(
        title="Genesis Veille Engine — World State API",
        version=SERVICE_VERSION,
    )

    @app.get("/", include_in_schema=False)
    def public_shell() -> FileResponse:
        return FileResponse(FRONTEND_INDEX, media_type="text/html; charset=utf-8")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {
            "status": "ok",
            "service": SERVICE_NAME,
            "version": SERVICE_VERSION,
        }

    @app.get("/api/v1/sources", response_model=list[SourceRecord])
    def list_sources() -> list[SourceRecord]:
        return registry.list()

    @app.post(
        "/api/v1/sources",
        response_model=SourceRecord,
        status_code=status.HTTP_201_CREATED,
    )
    def register_source(source: SourceRecord) -> SourceRecord:
        return registry.register(source)

    @app.get("/api/v1/events", response_model=list[AcceptedEvent])
    def list_events() -> list[AcceptedEvent]:
        return store.list_events()

    @app.post(
        "/api/v1/events",
        response_model=AcceptedEvent,
        status_code=status.HTTP_201_CREATED,
    )
    def ingest_event(event: EventInput) -> AcceptedEvent:
        decision = gate.evaluate(event)
        if not decision.accepted:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=decision.model_dump(),
            )
        return store.add(event, decision)

    @app.get("/api/v1/world-state/countries/{iso3}")
    def country_world_state(iso3: str) -> dict:
        normalized = iso3.upper()
        if len(normalized) != 3 or not normalized.isalpha():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="country code must be a three-letter ISO3 code",
            )
        return store.country_state(normalized)

    return app


app = create_app()
