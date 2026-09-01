from __future__ import annotations
from dataclasses import asdict
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel
from app.domain.models import Asset,Line,Site
from app.persistence.repositories import AssetRepository,LineRepository,SiteRepository
class SitePayload(BaseModel):
    site_id:str; name:str; country:str; timezone:str; industry:str; operating_status:str; data_residency_policy:str
class LinePayload(BaseModel):
    line_id:str; site_id:str; name:str; process_type:str; rated_capacity:float; unit:str
class AssetPayload(BaseModel):
    asset_id:str; site_id:str; line_id:str; asset_type:str; manufacturer:str; model:str; criticality:str; commissioning_date:str|None=None; protocol_profile:str; status:str
def build_assets_router(sites:SiteRepository,lines:LineRepository,assets:AssetRepository,mutation_dependency)->APIRouter:
    router=APIRouter(tags=['registry']); deps=[Depends(mutation_dependency)]
    @router.post('/sites',status_code=201,dependencies=deps)
    def create_site(payload:SitePayload): return asdict(sites.create(Site(**payload.model_dump())))
    @router.get('/sites')
    def list_sites(): return [asdict(site) for site in sites.list_all()]
    @router.post('/lines',status_code=201,dependencies=deps)
    def create_line(payload:LinePayload):
        try:return asdict(lines.create(Line(**payload.model_dump())))
        except ValueError as exc: raise HTTPException(status_code=422,detail=str(exc)) from exc
    @router.get('/lines')
    def list_lines(): return [asdict(line) for line in lines.list_all()]
    @router.post('/assets',status_code=201,dependencies=deps)
    def create_asset(payload:AssetPayload):
        try:return asdict(assets.create(Asset(**payload.model_dump())))
        except ValueError as exc: raise HTTPException(status_code=422,detail=str(exc)) from exc
    @router.get('/assets')
    def list_assets(): return [asdict(asset) for asset in assets.list_all()]
    return router
