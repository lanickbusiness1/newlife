from datetime import datetime,timedelta,timezone
import pytest
from fastapi.testclient import TestClient
from app.core.config import Settings
from app.domain.models import Asset,Line,Site,TelemetryPoint
from app.main import create_app
from app.persistence.repositories import AssetRepository,LineRepository,SiteRepository
from app.services.telemetry import TelemetryService
@pytest.fixture
def client(tmp_path):
    app=create_app(Settings(database_path=str(tmp_path/'api.db'),api_keys='engineer1:engineer:engineer-secret')); SiteRepository(app.state.conn).create(Site('s1','Demo','BJ','Africa/Porto-Novo','agro','active','local')); LineRepository(app.state.conn).create(Line('l1','s1','Line','packing',100.0,'units/hour')); AssetRepository(app.state.conn).create(Asset('a1','s1','l1','motor','Synthetic','M1','high',None,'simulator','online')); return TestClient(app)
@pytest.fixture
def valid_batch(): return {'batch_id':'b1','points':[{'point_id':'p1','asset_id':'a1','metric':'temperature_c','unit':'C','timestamp':'2026-09-01T00:00:00Z','value':62.0,'quality':'GOOD','source':'SIMULATOR','provenance_id':'sim-1'}]}
def test_duplicate_batch_is_idempotent(client,valid_batch):
    first=client.post('/telemetry/batch',json=valid_batch,headers={'X-API-Key':'engineer-secret'}); second=client.post('/telemetry/batch',json=valid_batch,headers={'X-API-Key':'engineer-secret'}); assert first.status_code==202; assert second.status_code==200; assert second.json()['duplicate'] is True
def test_more_than_1000_points_is_rejected(client):
    payload={'batch_id':'big','points':[{'point_id':f'p{i}','asset_id':'a1','metric':'x','unit':'u','timestamp':'2026-09-01T00:00:00Z','value':1.0,'quality':'GOOD','source':'SIMULATOR','provenance_id':'sim'} for i in range(1001)]}; assert client.post('/telemetry/batch',json=payload,headers={'X-API-Key':'engineer-secret'}).status_code==413
def test_future_timestamp_is_retained_but_marked_suspect(tmp_path):
    fixed_now=datetime(2026,9,1,0,0,tzinfo=timezone.utc); app=create_app(Settings(database_path=str(tmp_path/'svc.db'),api_keys='engineer1:engineer:engineer-secret')); SiteRepository(app.state.conn).create(Site('s1','Demo','BJ','Africa/Porto-Novo','agro','active','local')); LineRepository(app.state.conn).create(Line('l1','s1','Line','packing',100.0,'units/hour')); AssetRepository(app.state.conn).create(Asset('a1','s1','l1','motor','Synthetic','M1','high',None,'simulator','online')); service=TelemetryService(app.state.conn,now=lambda:fixed_now); future=TelemetryPoint('p1','a1','temperature_c','C',(fixed_now+timedelta(hours=1)).isoformat(),70.0,'GOOD','SIMULATOR','sim-1'); result=service.ingest_batch('b1',[future]); assert result.accepted==1; assert result.points[0].quality=='SUSPECT'; assert result.points[0].receipt_timestamp!=result.points[0].timestamp
def test_unknown_source_is_rejected(client,valid_batch):
    valid_batch['batch_id']='bad-source'; valid_batch['points'][0]['point_id']='p2'; valid_batch['points'][0]['source']='UNKNOWN'; assert client.post('/telemetry/batch',json=valid_batch,headers={'X-API-Key':'engineer-secret'}).status_code==422
