from fastapi import FastAPI

from app.core.config import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    cfg = settings or Settings()
    app = FastAPI(
        title='AfrIA Industrial Intelligence & Automation OS',
        version='0.1.0',
    )

    @app.get('/health/live')
    def live() -> dict[str, str]:
        return {'status': 'ok'}

    @app.get('/health/ready')
    def ready() -> dict[str, str]:
        return {'status': 'ready'}

    @app.get('/system/mode')
    def system_mode() -> dict[str, str]:
        return {'mode': cfg.system_mode, 'source': 'local'}

    return app


app = create_app()
