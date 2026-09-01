from __future__ import annotations
from dataclasses import asdict
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel
from app.domain.models import Asset
from app.persistence.repositories import AssetRepository
class AssetPayload(BaseModel):
    asset_id:str; site_id:str; line_id:str; asset_type:str; manufacturer:str; model:str; criticality:str; commissioning_date:str|None=None; protocol_profile:str; status:str
def build_assets_router(repo:AssetRepository,mutation_dependency)->APIRouter:
    router=APIRouter(tags=['assets'])
    @router.post('/assets',status_code=201,dependencies=[Depends(mutation_dependency)])
    def create_asset(payload:AssetPayload):
        try: return asdict(repo.create(Asset(**payload.model_dump())))
        except ValueError as exc: raise HTTPException(status_code=422,detail=str(exc)) from exc
    @router.get('/assets')
    def list_assets(): return [asdict(asset) for asset in repo.list_all()]
    return router
