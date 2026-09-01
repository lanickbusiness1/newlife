from dataclasses import asdict
from fastapi import APIRouter
from app.services.sync import SyncService
def build_sync_router(service:SyncService)->APIRouter:
    router=APIRouter(tags=['sync'])
    @router.get('/sync/status')
    def status(): return asdict(service.status())
    return router
