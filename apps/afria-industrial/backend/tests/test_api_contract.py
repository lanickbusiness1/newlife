import pytest
from fastapi.testclient import TestClient
from app.core.config import Settings
from app.main import create_app
from app.services.evidence import EvidenceService
REQUIRED={'/health/live','/health/ready','/system/mode','/sites','/lines','/assets','/telemetry/batch','/telemetry','/kpis/site/{site_id}','/kpis/line/{line_id}','/kpis/asset/{asset_id}','/anomalies','/alerts','/alerts/{alert_id}/acknowledge','/readiness/assessments','/readiness/assessments/{assessment_id}','/evidence','/sync/status'}
@pytest.fixture
def app(tmp_path):return create_app(Settings(database_path=str(tmp_path/'api-contract.db'),api_keys='engineer1:engineer:engineer-secret,operator1:operator:operator-secret'))
@pytest.fixture
def client(app):return TestClient(app)
def test_required_paths_exist(client):assert REQUIRED<=set(client.get('/openapi.json').json()['paths'])
def test_ready_fails_when_evidence_chain_is_invalid(client,app):
    evidence=EvidenceService(app.state.conn);evidence.append('TEST','system',{'test':'health'},{'value':1},[]);app.state.conn.execute("UPDATE evidence SET output_hash='tampered' WHERE sequence=1");app.state.conn.commit();response=client.get('/health/ready');assert response.status_code==503;assert response.json()['evidence_integrity'] is False
def test_registry_routes_create_site_line_asset(client):
    h={'X-API-Key':'engineer-secret'};site={'site_id':'s1','name':'Demo','country':'BJ','timezone':'Africa/Porto-Novo','industry':'agro','operating_status':'active','data_residency_policy':'local'};line={'line_id':'l1','site_id':'s1','name':'Pack','process_type':'packing','rated_capacity':100,'unit':'units/hour'};asset={'asset_id':'a1','site_id':'s1','line_id':'l1','asset_type':'motor','manufacturer':'Synthetic','model':'M1','criticality':'high','commissioning_date':None,'protocol_profile':'simulator','status':'online'};assert client.post('/sites',json=site,headers=h).status_code==201;assert client.post('/lines',json=line,headers=h).status_code==201;assert client.post('/assets',json=asset,headers=h).status_code==201;assert client.get('/assets').json()[0]['asset_id']=='a1'
def test_operational_metrics_exposes_required_signals(client):
    data=client.get('/system/metrics').json();required={'ingestion_accepted','ingestion_rejected','telemetry_freshness','anomalies_by_severity','alert_backlog','sync_queue_depth','persistence_errors','adapter_health','system_mode','evidence_integrity'};assert required<=set(data)
def test_kpi_response_has_proof_metadata(client):
    result=client.get('/kpis/asset/missing').json();assert result['scope']=={'type':'asset','id':'missing'};assert result['status']=='INSUFFICIENT_DATA';assert result['kpis']==[]
