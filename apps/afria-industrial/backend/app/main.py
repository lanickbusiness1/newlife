from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.assets import build_assets_router
from app.api.evidence import build_evidence_router
from app.api.readiness import ReadinessService,build_readiness_router
from app.api.telemetry import build_telemetry_router
from app.api.sync import build_sync_router
from app.core.config import Settings
from app.core.rate_limit import FixedWindowRateLimiter
from app.core.security import require_role
from app.persistence.repositories import AssetRepository
from app.persistence.sqlite import connect_sqlite,initialize_schema
from app.services.evidence import EvidenceService
from app.services.telemetry import TelemetryService
from app.services.sync import MockUpstreamTransport,SyncService
def create_app(settings:Settings|None=None)->FastAPI:
    cfg=settings or Settings(); app=FastAPI(title='AfrIA Industrial Intelligence & Automation OS',version='0.1.0')
    origins=[origin.strip() for origin in cfg.cors_origins.split(',') if origin.strip()]; app.add_middleware(CORSMiddleware,allow_origins=origins,allow_credentials=False,allow_methods=['GET','POST','OPTIONS'],allow_headers=['X-API-Key','Content-Type'])
    conn=connect_sqlite(cfg.database_path); initialize_schema(conn); app.state.conn=conn; app.state.settings=cfg
    limiter=FixedWindowRateLimiter(cfg.mutation_rate_limit,cfg.mutation_rate_window_seconds); app.state.rate_limiter=limiter; mutation_dependency=require_role(cfg,'engineer',limiter=limiter)
    telemetry_service=TelemetryService(conn); app.state.telemetry_service=telemetry_service; evidence_service=EvidenceService(conn); sync_service=SyncService(conn,MockUpstreamTransport(available=True),evidence_service); app.state.sync_service=sync_service
    @app.get('/health/live')
    def live()->dict[str,str]: return {'status':'ok'}
    @app.get('/health/ready')
    def ready()->dict[str,str]:
        try: conn.execute('SELECT 1').fetchone()
        except Exception: return {'status':'not_ready'}
        return {'status':'ready'}
    @app.get('/system/mode')
    def system_mode()->dict[str,str]: return {'mode':sync_service.status().mode,'source':'local'}
    app.include_router(build_assets_router(AssetRepository(conn),mutation_dependency)); app.include_router(build_telemetry_router(telemetry_service,mutation_dependency)); app.include_router(build_evidence_router(evidence_service)); app.include_router(build_readiness_router(ReadinessService(conn,evidence_service),mutation_dependency)); app.include_router(build_sync_router(sync_service)); return app
app=create_app()
