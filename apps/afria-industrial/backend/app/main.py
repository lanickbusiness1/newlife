from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.assets import build_assets_router
from app.api.analytics import build_analytics_router
from app.api.evidence import build_evidence_router
from app.api.health import build_health_router
from app.api.readiness import ReadinessService,build_readiness_router
from app.api.sync import build_sync_router
from app.api.telemetry import build_telemetry_router
from app.core.config import Settings
from app.core.observability import OperationalMetrics
from app.core.rate_limit import FixedWindowRateLimiter
from app.core.security import require_role
from app.persistence.repositories import AssetRepository,LineRepository,SiteRepository
from app.persistence.sqlite import connect_sqlite,initialize_schema
from app.services.alerts import AlertService
from app.services.evidence import EvidenceService
from app.services.sync import MockUpstreamTransport,SyncService
from app.services.telemetry import TelemetryService
def create_app(settings:Settings|None=None)->FastAPI:
    cfg=settings or Settings();app=FastAPI(title='AfrIA Industrial Intelligence & Automation OS',version='0.1.0');origins=[o.strip() for o in cfg.cors_origins.split(',') if o.strip()];app.add_middleware(CORSMiddleware,allow_origins=origins,allow_credentials=False,allow_methods=['GET','POST','OPTIONS'],allow_headers=['X-API-Key','Content-Type']);conn=connect_sqlite(cfg.database_path);initialize_schema(conn);app.state.conn=conn;app.state.settings=cfg
    limiter=FixedWindowRateLimiter(cfg.mutation_rate_limit,cfg.mutation_rate_window_seconds);app.state.rate_limiter=limiter;engineer=require_role(cfg,'engineer',limiter=limiter);operator=require_role(cfg,'operator',limiter=limiter);telemetry=TelemetryService(conn);evidence=EvidenceService(conn);sync=SyncService(conn,MockUpstreamTransport(True),evidence);alerts=AlertService(conn,evidence);metrics=OperationalMetrics(conn,evidence,sync);app.state.telemetry_service=telemetry;app.state.evidence_service=evidence;app.state.sync_service=sync;app.state.alert_service=alerts;app.state.metrics=metrics
    app.include_router(build_health_router(conn,evidence,sync,metrics));app.include_router(build_assets_router(SiteRepository(conn),LineRepository(conn),AssetRepository(conn),engineer));app.include_router(build_telemetry_router(telemetry,engineer));app.include_router(build_analytics_router(conn,alerts,operator));app.include_router(build_evidence_router(evidence));app.include_router(build_readiness_router(ReadinessService(conn,evidence),engineer));app.include_router(build_sync_router(sync));return app
app=create_app()
