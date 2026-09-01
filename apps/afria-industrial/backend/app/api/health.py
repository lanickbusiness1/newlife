from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.core.observability import OperationalMetrics
from app.services.evidence import EvidenceService
from app.services.sync import SyncService
def build_health_router(conn,evidence:EvidenceService,sync:SyncService,metrics:OperationalMetrics)->APIRouter:
    router=APIRouter(tags=['system'])
    @router.get('/health/live')
    def live():return {'status':'ok'}
    @router.get('/health/ready')
    def ready():
        try:conn.execute('SELECT 1').fetchone()
        except Exception:return JSONResponse({'status':'not_ready','database':False,'evidence_integrity':False},status_code=503)
        integrity=evidence.verify_chain();body={'status':'ready' if integrity else 'not_ready','database':True,'evidence_integrity':integrity};return JSONResponse(body,status_code=200 if integrity else 503)
    @router.get('/system/mode')
    def mode():return {'mode':sync.status().mode,'source':'local'}
    @router.get('/system/metrics')
    def system_metrics():return metrics.snapshot()
    return router
