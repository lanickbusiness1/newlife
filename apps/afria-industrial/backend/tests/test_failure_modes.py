import sqlite3,time
from datetime import datetime,timezone
import pytest
from app.domain.models import Asset,Line,Site,TelemetryPoint
from app.persistence.repositories import AssetRepository,LineRepository,SiteRepository
from app.persistence.sqlite import connect_sqlite,initialize_schema
from app.services.telemetry import TelemetryService
def _telemetry_service(tmp_path):
    conn=connect_sqlite(str(tmp_path/'failure.db'));initialize_schema(conn);SiteRepository(conn).create(Site('s1','Demo','BJ','Africa/Porto-Novo','agro','active','local'));LineRepository(conn).create(Line('l1','s1','Line','packing',100.0,'units/hour'));AssetRepository(conn).create(Asset('a1','s1','l1','motor','Synthetic','M1','high',None,'simulator','online'));return conn,TelemetryService(conn)
def test_stale_source_is_not_live(tmp_path):
    _,service=_telemetry_service(tmp_path);service.ingest_batch('stale',[TelemetryPoint('stale1','a1','temperature_c','C','2026-09-01T00:00:00Z',60.0,'STALE','SIMULATOR','sim-stale')]);state=service.source_state('a1');assert state.data_state=='STALE';assert state.live is False
def test_acceptance_environment_ingests_100_points_per_second(tmp_path):
    _,service=_telemetry_service(tmp_path);points=[TelemetryPoint(f'p{i}','a1','temperature_c','C',f'2026-09-01T00:{i//60:02d}:{i%60:02d}Z',60+i/100,'GOOD','SIMULATOR','perf') for i in range(100)];started=time.perf_counter();result=service.ingest_batch('perf-100',points);assert result.accepted==100;assert time.perf_counter()-started<1.0
def test_sqlite_write_lock_recovers_without_silent_loss(tmp_path):
    path=str(tmp_path/'locked.db');conn=connect_sqlite(path);initialize_schema(conn);SiteRepository(conn).create(Site('s1','Demo','BJ','Africa/Porto-Novo','agro','active','local'));LineRepository(conn).create(Line('l1','s1','Line','packing',100.0,'units/hour'));AssetRepository(conn).create(Asset('a1','s1','l1','motor','Synthetic','M1','high',None,'simulator','online'));blocker=sqlite3.connect(path,timeout=.1);blocker.execute('PRAGMA journal_mode=WAL');blocker.execute('BEGIN IMMEDIATE');service=TelemetryService(conn);point=TelemetryPoint('p1','a1','temperature_c','C',datetime.now(timezone.utc).isoformat(),60,'GOOD','SIMULATOR','lock-test')
    with pytest.raises(sqlite3.OperationalError):service.ingest_batch('locked',[point])
    blocker.rollback();blocker.close();assert service.ingest_batch('recovered',[TelemetryPoint('p2','a1','temperature_c','C',datetime.now(timezone.utc).isoformat(),61,'GOOD','SIMULATOR','lock-test')]).accepted==1
def test_simulator_invalid_count_fails_loudly():
    from pathlib import Path
    import sys
    sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'simulator'));from generator.engine import generate_scenario;from generator.scenarios import healthy_motor
    with pytest.raises(ValueError,match='count'):generate_scenario(1,healthy_motor(),-1)
