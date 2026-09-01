from pathlib import Path
import sys
from app.api.analytics import kpis_for_scope
from app.api.readiness import ReadinessService
from app.domain.anomaly import rolling_zscore_anomaly
from app.domain.models import Alert,Asset,Line,Site,TelemetryPoint
from app.domain.readiness import DIMENSION_KEYS,DimensionInput
from app.persistence.repositories import AssetRepository,LineRepository,SiteRepository
from app.persistence.sqlite import connect_sqlite,initialize_schema
from app.services.alerts import AlertService
from app.services.evidence import EvidenceService
from app.services.sync import MockUpstreamTransport,SyncEnvelope,SyncService
from app.services.telemetry import TelemetryService
SIMULATOR_PATH=Path(__file__).resolve().parents[2]/'simulator'
if str(SIMULATOR_PATH) not in sys.path:sys.path.insert(0,str(SIMULATOR_PATH))
from generator.engine import generate_scenario
from generator.scenarios import bearing_temperature_drift
def test_full_simulator_backed_acceptance_loop(tmp_path):
    conn=connect_sqlite(str(tmp_path/'acceptance.db'));initialize_schema(conn);sites,lines,assets=SiteRepository(conn),LineRepository(conn),AssetRepository(conn);sites.create(Site('site-demo','Synthetic Factory','BJ','Africa/Porto-Novo','agro','active','local'));lines.create(Line('line-1','site-demo','Packing','packing',100.0,'units/hour'))
    for aid,atype in [('motor-1','motor'),('pump-1','pump'),('conveyor-1','conveyor')]:assets.create(Asset(aid,'site-demo','line-1',atype,'Synthetic','Proof','high',None,'simulator','online'))
    telemetry=TelemetryService(conn);base={'planned_minutes':480.0,'run_minutes':420.0,'actual_output':800.0,'theoretical_output':840.0,'good_units':760.0,'total_units':800.0,'kwh':420.0,'operating_minutes':1200.0,'failures':3.0,'repair_minutes':90.0,'repairs':3.0};points=[TelemetryPoint(f'kpi-{i}','motor-1',m,'unit',f'2026-09-01T00:00:{i:02d}Z',v,'GOOD','SIMULATOR','acceptance-kpi') for i,(m,v) in enumerate(base.items())];assert telemetry.ingest_batch('acceptance-kpis',points).accepted==len(points)
    generated=generate_scenario(7,bearing_temperature_drift(10),30);temp=[TelemetryPoint(f'temp-{p["index"]}','motor-1',str(p['metric']),str(p['unit']),str(p['timestamp']),float(p['value']),'GOOD','SIMULATOR','scenario-bearing-drift') for p in generated if p['available']];telemetry.ingest_batch('acceptance-temperature',temp);kpis=kpis_for_scope(conn,'asset','motor-1');assert kpis['status']=='OK';assert {'OEE','ENERGY_PER_UNIT','MTBF','MTTR'}<={x['name'] for x in kpis['kpis']}
    values=[float(p['value']) for p in generated];anomaly=rolling_zscore_anomaly(values[:10],values[-1],3.0,('scenario-bearing-drift',));assert anomaly.detected is True;evidence=EvidenceService(conn);ev=evidence.append('ANOMALY_DETECTED','engine',{'asset_id':'motor-1'},{'method':anomaly.method,'deviation':anomaly.deviation},list(anomaly.evidence_refs));alerts=AlertService(conn,evidence);alerts.create(Alert('alert-1','site-demo','motor-1',anomaly.severity,'OPEN','2026-09-01T00:30:00Z','Inspect bearing before next production cycle',rule_id='bearing-drift',evidence_refs=(ev.evidence_id,)));assert conn.execute("SELECT COUNT(*) FROM alerts WHERE state='OPEN'").fetchone()[0]==1
    transport=MockUpstreamTransport(False);sync=SyncService(conn,transport,evidence);sync.enqueue(SyncEnvelope('event-1','central-control-plane','operational-proof','telemetry-derived','30d','pilot-contract','TLS',{'alert_id':'alert-1'}));assert sync.status().mode=='OFFLINE_EDGE';assert kpis_for_scope(conn,'asset','motor-1')['status']=='OK';transport.available=True;assert sync.replay().sent_event_ids==['event-1'];assert sync.status().queue_depth==0
    readiness=ReadinessService(conn,evidence).create('site-demo','engineer',{k:DimensionInput(75,'OBSERVED',[]) for k in DIMENSION_KEYS});assert readiness.overall_score==75;assert evidence.verify_chain() is True;assert {r[0] for r in conn.execute('SELECT DISTINCT source FROM telemetry')}=={'SIMULATOR'}
