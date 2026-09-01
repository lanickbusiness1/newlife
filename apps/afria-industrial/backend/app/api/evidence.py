from fastapi import APIRouter

from app.services.evidence import EvidenceService


def build_evidence_router(service: EvidenceService) -> APIRouter:
    router = APIRouter(tags=['evidence'])

    @router.get('/evidence')
    def evidence():
        return {'integrity': service.verify_chain(), 'records': service.list_all()}

    return router
