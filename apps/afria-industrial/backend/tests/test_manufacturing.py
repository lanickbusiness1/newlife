from dataclasses import asdict

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.domain.manufacturing import ExternalOption, ManufacturingDesign, ManufacturingNeed, ManufacturingNode, resolve_manufacturing
from app.main import create_app


def node(**overrides):
    base = dict(
        node_id='node-bj-01',name='Cotonou Microfactory',country='BJ',jurisdiction='BJ',status='AVAILABLE',
        available_capacity=100,lead_time_hours=6,unit_cost=40,local_content_ratio=0.65,energy_state='STABLE',
        connectivity_state='OFFLINE_READY',quality_state='QUALIFIED',machine_types=('FDM',),processes=('ADDITIVE',),
        materials=('PA12',),workforce_skills=('CAD','QA'),certifications=('ISO9001',),permissions=('MANUFACTURE',),
        constraints=(),evidence_refs=('node-proof',)
    )
    base.update(overrides)
    return ManufacturingNode(**base)


def design(**overrides):
    base = dict(
        design_id='design-001',owner='Example IP Owner',version='1.0',ip_rights_status='AUTHORIZED',expired=False,
        bom=('part-a',),allowed_materials=('PA12',),allowed_machine_types=('FDM',),allowed_jurisdictions=('BJ',),
        required_certifications=('ISO9001',),authorized_uses=('CIVIL_MAINTENANCE',),evidence_refs=('design-proof',)
    )
    base.update(overrides)
    return ManufacturingDesign(**base)


def need(**overrides):
    base = dict(
        need_id='need-001',quantity=10,required_by_hours=24,downtime_cost_per_hour=500,requested_use='CIVIL_MAINTENANCE',
        required_material='PA12',required_machine_type='FDM',required_certifications=('ISO9001',),repair_feasible=False,
        repair_cost=0,repair_lead_time_hours=0,repair_risk_score=0,baseline_import_cost=1800,
        baseline_import_lead_time_hours=96
    )
    base.update(overrides)
    return ManufacturingNeed(**base)


def test_resolver_selects_authorized_local_make_and_calculates_value():
    result = resolve_manufacturing(
        need(),
        [node()],
        design(),
        [ExternalOption('IMPORT','importer',1800,96,0.2,True,0.0,('import-proof',))],
    )
    assert result.decision == 'MAKE'
    assert result.selected is not None and result.selected.node_id == 'node-bj-01'
    assert result.industrial_availability_value > 0
    assert result.downtime_avoided_hours == 90


def test_make_fails_closed_when_design_rights_are_not_authorized():
    result = resolve_manufacturing(
        need(),
        [node()],
        design(ip_rights_status='UNVERIFIED'),
        [ExternalOption('IMPORT','importer',1800,96,0.2,True)],
    )
    assert result.decision == 'IMPORT'
    make = next(item for item in result.options if item.kind == 'MAKE')
    assert make.feasible is False
    assert 'ip_rights_not_authorized' in make.rationale


def test_api_registry_resolver_and_evidence_chain(tmp_path):
    app = create_app(Settings(
        database_path=str(tmp_path/'manufacturing.db'),
        api_keys='engineer1:engineer:engineer-secret,operator1:operator:operator-secret,viewer1:viewer:viewer-secret'
    ))
    client = TestClient(app)
    engineer = {'X-API-Key':'engineer-secret'}
    operator = {'X-API-Key':'operator-secret'}

    n = asdict(node())
    for key in ('machine_types','processes','materials','workforce_skills','certifications','permissions','constraints','evidence_refs'):
        n[key] = list(n[key])
    d = asdict(design())
    for key in ('bom','allowed_materials','allowed_machine_types','allowed_jurisdictions','required_certifications','authorized_uses','evidence_refs'):
        d[key] = list(d[key])
    q = asdict(need())
    q['required_certifications'] = list(q['required_certifications'])

    assert client.post('/manufacturing/nodes',json=n,headers=engineer).status_code == 201
    assert client.post('/manufacturing/designs',json=d,headers=engineer).status_code == 201
    response = client.post('/manufacturing/resolve',headers=operator,json={
        'actor':'operator1',
        'need':q,
        'design_id':'design-001',
        'external_options':[{
            'kind':'IMPORT','provider_id':'importer','total_cost':1800,'lead_time_hours':96,
            'risk_score':0.2,'compliant':True,'local_content_ratio':0,'evidence_refs':['import-proof']
        }]
    })
    assert response.status_code == 200
    body = response.json()
    assert body['decision'] == 'MAKE'
    assert body['industrial_availability_value'] > 0
    evidence = client.get('/evidence').json()
    assert evidence['integrity'] is True
    assert 'MANUFACTURING_DECISION_GENERATED' in {item['event_type'] for item in evidence['records']}


def test_viewer_cannot_register_manufacturing_node(tmp_path):
    app = create_app(Settings(database_path=str(tmp_path/'security.db'),api_keys='viewer1:viewer:viewer-secret'))
    client = TestClient(app)
    payload = asdict(node())
    for key in ('machine_types','processes','materials','workforce_skills','certifications','permissions','constraints','evidence_refs'):
        payload[key] = list(payload[key])
    assert client.post('/manufacturing/nodes',json=payload,headers={'X-API-Key':'viewer-secret'}).status_code == 403
