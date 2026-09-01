import pytest
from fastapi.testclient import TestClient
from app.core.config import Settings
from app.domain.models import Line,Site
from app.main import create_app
from app.persistence.repositories import LineRepository,SiteRepository
@pytest.fixture
def app(tmp_path):
    settings=Settings(database_path=str(tmp_path/'security.db'),api_keys='viewer1:viewer:viewer-secret,engineer1:engineer:engineer-secret',mutation_rate_limit=10,mutation_rate_window_seconds=60,cors_origins='https://operator.example'); app=create_app(settings)
    SiteRepository(app.state.conn).create(Site('s1','Demo','BJ','Africa/Porto-Novo','agro','active','local')); LineRepository(app.state.conn).create(Line('l1','s1','Line','packing',100.0,'units/hour')); return app
@pytest.fixture
def client(app): return TestClient(app)
@pytest.fixture
def asset_payload(): return {'asset_id':'a0','site_id':'s1','line_id':'l1','asset_type':'motor','manufacturer':'Synthetic','model':'M1','criticality':'high','commissioning_date':None,'protocol_profile':'simulator','status':'online'}
def test_missing_api_key_is_401(client,asset_payload): assert client.post('/assets',json=asset_payload).status_code==401
def test_viewer_cannot_mutate_assets(client,asset_payload): assert client.post('/assets',json=asset_payload,headers={'X-API-Key':'viewer-secret'}).status_code==403
def test_engineer_can_mutate_assets(client,asset_payload): assert client.post('/assets',json=asset_payload,headers={'X-API-Key':'engineer-secret'}).status_code==201
def test_mutation_rate_limit_returns_429(client,asset_payload):
    headers={'X-API-Key':'engineer-secret'}
    for i in range(10): assert client.post('/assets',json={**asset_payload,'asset_id':f'r{i}'},headers=headers).status_code==201
    assert client.post('/assets',json={**asset_payload,'asset_id':'overflow'},headers=headers).status_code==429
def test_openapi_exposes_no_machine_control_paths(client):
    paths=client.get('/openapi.json').json()['paths']; forbidden=('write','actuate','command','plc/set','pac/set'); assert not any(any(token in path.lower() for token in forbidden) for path in paths)
def test_cors_allows_only_configured_origin(client):
    response=client.options('/assets',headers={'Origin':'https://operator.example','Access-Control-Request-Method':'POST'}); assert response.headers['access-control-allow-origin']=='https://operator.example'
    denied=client.options('/assets',headers={'Origin':'https://evil.example','Access-Control-Request-Method':'POST'}); assert 'access-control-allow-origin' not in denied.headers
