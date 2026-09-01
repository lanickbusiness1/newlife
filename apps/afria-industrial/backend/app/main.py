from fastapi import FastAPI

from app.api.telemetry import build_telemetry_router
from app.api.evidence import build_evidence_router
from app.core.config import Settings
from app.persistence.sqlite import connect_sqlite, initialize_schema
from app.services.telemetry import TelemetryService
from app.services.evidence import EvidenceService


def create_app(settings: Settings | None = None) -> FastAPI:
    cfg = settings or Settings()
    app = FastAPI(title='AfrIA Industrial Intelligence & Automation OS', version='0.1.0')
    conn = connect_sqlite(cfg.database_path)
    initialize_schema(conn)
    app.state.conn = conn
    app.state.settings = cfg
    telemetry_service = TelemetryService(conn)
    app.state.telemetry_service = telemetry_service

    @app.get('/health/live')
    def live() -> dict[str, str]:
        return {'status': 'ok'}

    @app.get('/health/ready')
    def ready() -> dict[str, str]:
        try:
            conn.execute('SELECT 1').fetchone()
        except Exception:
            return {'status': 'not_ready'}
        return {'status': 'ready'}

    @app.get('/system/mode')
    def system_mode() -> dict[str, str]:
        return {'mode': cfg.system_mode, 'source': 'local'}

    app.include_router(build_telemetry_router(telemetry_service))
    app.include_router(build_evidence_router(EvidenceService(conn)))
    return app


app = create_app()
