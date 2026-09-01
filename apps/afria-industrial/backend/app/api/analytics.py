from __future__ import annotations
import json,sqlite3
from dataclasses import asdict
from typing import Any
from fastapi import APIRouter,Depends,HTTPException
from app.domain.kpi import calculate_energy_per_unit,calculate_mtbf,calculate_mttr,calculate_oee
from app.services.alerts import AlertService
def _telemetry_rows(conn,scope_type,scope_id):
    if scope_type=='asset': return conn.execute('SELECT t.* FROM telemetry t WHERE t.asset_id=? ORDER BY event_timestamp',(scope_id,)).fetchall()
    if scope_type=='line': return conn.execute('SELECT t.* FROM telemetry t JOIN assets a ON a.asset_id=t.asset_id WHERE a.line_id=? ORDER BY event_timestamp',(scope_id,)).fetchall()
    if scope_type=='site': return conn.execute('SELECT t.* FROM telemetry t JOIN assets a ON a.asset_id=t.asset_id WHERE a.site_id=? ORDER BY event_timestamp',(scope_id,)).fetchall()
    raise ValueError(scope_type)
def _result(name,result): payload=asdict(result); payload['name']=name; return payload
def kpis_for_scope(conn,scope_type,scope_id):
    rows=_telemetry_rows(conn,scope_type,scope_id); scope={'type':scope_type,'id':scope_id}
    if not rows:return {'scope':scope,'status':'INSUFFICIENT_DATA','kpis':[]}
    latest={}
    for row in rows: latest[row['metric']]=row
    completeness=sum(1 for row in rows if row['quality']=='GOOD')/len(rows); period=(rows[0]['event_timestamp'],rows[-1]['event_timestamp']); refs=tuple(sorted({row['provenance_id'] for row in rows})); out=[]
    keys=('planned_minutes','run_minutes','actual_output','theoretical_output','good_units','total_units')
    if set(keys)<=set(latest): out.append(_result('OEE',calculate_oee(*(latest[k]['value'] for k in keys),completeness,period,refs)))
    if {'kwh','good_units'}<=set(latest): out.append(_result('ENERGY_PER_UNIT',calculate_energy_per_unit(latest['kwh']['value'],latest['good_units']['value'],completeness,period,refs)))
    if {'operating_minutes','failures'}<=set(latest) and latest['failures']['value']>0: out.append(_result('MTBF',calculate_mtbf(latest['operating_minutes']['value'],int(latest['failures']['value']),completeness,period,refs)))
    if {'repair_minutes','repairs'}<=set(latest) and latest['repairs']['value']>0: out.append(_result('MTTR',calculate_mttr(latest['repair_minutes']['value'],int(latest['repairs']['value']),completeness,period,refs)))
    return {'scope':scope,'status':'OK' if out else 'INSUFFICIENT_DATA','kpis':out}
def build_analytics_router(conn:sqlite3.Connection,alerts:AlertService,operator_mutation_dependency)->APIRouter:
    router=APIRouter(tags=['analytics'])
    @router.get('/kpis/site/{site_id}')
    def site_kpis(site_id:str):return kpis_for_scope(conn,'site',site_id)
    @router.get('/kpis/line/{line_id}')
    def line_kpis(line_id:str):return kpis_for_scope(conn,'line',line_id)
    @router.get('/kpis/asset/{asset_id}')
    def asset_kpis(asset_id:str):return kpis_for_scope(conn,'asset',asset_id)
    @router.get('/anomalies')
    def anomalies():
        result=[]
        for row in conn.execute('SELECT * FROM anomalies ORDER BY detected_at DESC'): item=dict(row); item['evidence_refs']=json.loads(item.pop('evidence_refs_json')); result.append(item)
        return result
    @router.get('/alerts')
    def list_alerts():
        result=[]
        for row in conn.execute('SELECT * FROM alerts ORDER BY raised_at DESC'): item=dict(row); item['evidence_refs']=json.loads(item.pop('evidence_refs_json')); result.append(item)
        return result
    @router.post('/alerts/{alert_id}/acknowledge',dependencies=[Depends(operator_mutation_dependency)])
    def acknowledge(alert_id:str,payload:dict[str,str]):
        actor=payload.get('actor','operator'); timestamp=payload.get('acknowledged_at')
        if not timestamp:raise HTTPException(status_code=422,detail='acknowledged_at is required')
        try:return asdict(alerts.acknowledge(alert_id,actor,timestamp))
        except KeyError as exc:raise HTTPException(status_code=404,detail='alert not found') from exc
    return router
