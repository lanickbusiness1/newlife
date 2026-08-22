from __future__ import annotations

import hmac
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Callable

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.responses import FileResponse

from .connectors import (
    CRAWLABLE_LICENSE_CLASSES,
    ConnectorIngestRequest,
    ConnectorPipeline,
    PublicHttpConnector,
    PublicUrlPolicy,
)
from .models import AcceptedEvent, CrawlTarget, EventInput, SourceRecord
from .persistence import SQLiteStateRepository
from .provenance import ProvenanceGate
from .scheduler import CrawlScheduler
from .source_registry import SourceRegistry
from .world_state import WorldStateStore


SERVICE_NAME = "genesis-veille-world-state"
SERVICE_VERSION = "0.2.0"
FRONTEND_INDEX = Path(__file__).resolve().parents[2] / "frontend" / "index.html"
CONTENT_SECURITY_POLICY = "; ".join(
    [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "connect-src 'self'",
        "img-src 'self' data:",
        "object-src 'none'",
        "base-uri 'none'",
        "frame-ancestors 'none'",
        "form-action 'none'",
    ]
)


def _env_enabled(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def create_app(
    ingest_key: str | None = None,
    storage_path: str | Path | None = None,
    *,
    http_connector_enabled: bool = False,
    scheduler_enabled: bool = False,
    http_connector: PublicHttpConnector | None = None,
    clock: Callable[[], datetime] = _utc_now,
) -> FastAPI:
    repository = SQLiteStateRepository(storage_path) if storage_path is not None else None
    registry = SourceRegistry(repository.list_sources() if repository else None)
    gate = ProvenanceGate(registry)
    store = WorldStateStore(repository.list_events() if repository else None)
    connector = http_connector or PublicHttpConnector()
    connector_pipeline = ConnectorPipeline(registry, gate, store, repository)
    url_policy = PublicUrlPolicy()

    app = FastAPI(
        title="Genesis Veille Engine — World State API",
        version=SERVICE_VERSION,
    )
    app.state.repository = repository
    app.state.http_connector_enabled = http_connector_enabled
    app.state.scheduler_enabled = scheduler_enabled

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = CONTENT_SECURITY_POLICY
        return response

    def require_ingest_access(
        supplied_key: Annotated[
            str | None,
            Header(alias="X-Genesis-Ingest-Key"),
        ] = None,
    ) -> None:
        if not ingest_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="ingestion is disabled until GENESIS_INGEST_KEY is configured",
            )
        if supplied_key is None or not hmac.compare_digest(supplied_key, ingest_key):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invalid ingest credential",
            )

    def require_durable_storage() -> SQLiteStateRepository:
        if repository is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="durable storage is required for crawl scheduling",
            )
        return repository

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
        dependencies=[Depends(require_ingest_access)],
    )
    def register_source(source: SourceRecord) -> SourceRecord:
        try:
            if repository is not None:
                repository.save_source(source)
            return registry.register(source)
        except ValueError as exc:
            if str(exc) == "source id conflict":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "code": "SOURCE_ID_CONFLICT",
                        "message": "source id already exists with different trust metadata",
                    },
                ) from exc
            raise

    @app.get("/api/v1/events", response_model=list[AcceptedEvent])
    def list_events() -> list[AcceptedEvent]:
        return store.list_events()

    @app.post(
        "/api/v1/events",
        response_model=AcceptedEvent,
        status_code=status.HTTP_201_CREATED,
        dependencies=[Depends(require_ingest_access)],
    )
    def ingest_event(event: EventInput) -> AcceptedEvent:
        decision = gate.evaluate(event)
        if not decision.accepted:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=decision.model_dump(),
            )

        accepted = AcceptedEvent(event=event, provenance=decision)
        try:
            if repository is not None:
                repository.save_event(accepted)
            return store.add(event, decision)
        except ValueError as exc:
            if str(exc) == "duplicate event id":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "code": "DUPLICATE_EVENT_ID",
                        "message": "event id already exists in world-state ledger",
                    },
                ) from exc
            raise

    @app.post(
        "/api/v1/connectors/http/ingest",
        response_model=AcceptedEvent,
        status_code=status.HTTP_201_CREATED,
        dependencies=[Depends(require_ingest_access)],
    )
    def ingest_http_connector(payload: ConnectorIngestRequest) -> AcceptedEvent:
        if not http_connector_enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="public HTTP connector is disabled",
            )

        source = registry.get(payload.source_id)
        if source is None or not source.active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "CONNECTOR_REJECTED",
                    "message": "unknown or inactive source",
                },
            )

        try:
            observation = connector.fetch(
                source=source,
                url=payload.url,
                country_iso3=payload.country_iso3,
                event_type_hint=payload.event_type_hint,
                sector=payload.sector,
                sensitive=payload.sensitive,
            )
            return connector_pipeline.process(observation)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "CONNECTOR_REJECTED",
                    "message": str(exc),
                },
            ) from exc

    @app.get(
        "/api/v1/crawl-targets",
        response_model=list[CrawlTarget],
        dependencies=[Depends(require_ingest_access)],
    )
    def list_crawl_targets() -> list[CrawlTarget]:
        durable = require_durable_storage()
        return durable.list_crawl_targets()

    @app.post(
        "/api/v1/crawl-targets",
        response_model=CrawlTarget,
        status_code=status.HTTP_201_CREATED,
        dependencies=[Depends(require_ingest_access)],
    )
    def register_crawl_target(target: CrawlTarget) -> CrawlTarget:
        durable = require_durable_storage()
        source = registry.get(target.source_id)
        try:
            if source is None or not source.active:
                raise ValueError("unknown or inactive source")
            if source.license_class.strip().lower() not in CRAWLABLE_LICENSE_CLASSES:
                raise ValueError("license class is not crawlable")
            if not source.allowed_hosts:
                raise ValueError("source has no registered crawl hosts")
            url_policy.validate(target.url, allowed_hosts=source.allowed_hosts)
            if durable.get_crawl_target(target.id) is not None:
                raise ValueError("crawl target id already exists")
            return durable.save_crawl_target(target)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "CRAWL_TARGET_REJECTED",
                    "message": str(exc),
                },
            ) from exc

    @app.post(
        "/api/v1/crawler/tick",
        dependencies=[Depends(require_ingest_access)],
    )
    def run_crawler_tick() -> dict[str, int]:
        durable = require_durable_storage()
        if not scheduler_enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="crawl scheduler is disabled",
            )
        if not http_connector_enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="public HTTP connector is disabled",
            )

        result = CrawlScheduler(
            repository=durable,
            registry=registry,
            connector=connector,
            pipeline_factory=lambda: connector_pipeline,
        ).tick(clock())
        return {
            "attempted": result.attempted,
            "succeeded": result.succeeded,
            "unchanged": result.unchanged,
            "failed": result.failed,
        }

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


app = create_app(
    ingest_key=os.getenv("GENESIS_INGEST_KEY"),
    storage_path=os.getenv("GENESIS_STATE_DB"),
    http_connector_enabled=_env_enabled("GENESIS_HTTP_CONNECTOR_ENABLED"),
    scheduler_enabled=_env_enabled("GENESIS_CRAWL_SCHEDULER_ENABLED"),
)
