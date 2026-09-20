from __future__ import annotations

import sqlite3
from pathlib import Path


def connect_sqlite(path: str) -> sqlite3.Connection:
    db_path = Path(path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA foreign_keys=ON')
    conn.execute('PRAGMA busy_timeout=100')
    return conn


def initialize_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        '''
CREATE TABLE IF NOT EXISTS sites(site_id TEXT PRIMARY KEY,name TEXT NOT NULL,country TEXT NOT NULL,timezone TEXT NOT NULL,industry TEXT NOT NULL,operating_status TEXT NOT NULL,data_residency_policy TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS lines(line_id TEXT PRIMARY KEY,site_id TEXT NOT NULL REFERENCES sites(site_id) ON DELETE RESTRICT,name TEXT NOT NULL,process_type TEXT NOT NULL,rated_capacity REAL NOT NULL,unit TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS assets(asset_id TEXT PRIMARY KEY,site_id TEXT NOT NULL REFERENCES sites(site_id) ON DELETE RESTRICT,line_id TEXT NOT NULL REFERENCES lines(line_id) ON DELETE RESTRICT,asset_type TEXT NOT NULL,manufacturer TEXT NOT NULL,model TEXT NOT NULL,criticality TEXT NOT NULL,commissioning_date TEXT,protocol_profile TEXT NOT NULL,status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS telemetry(point_id TEXT PRIMARY KEY,asset_id TEXT NOT NULL REFERENCES assets(asset_id) ON DELETE RESTRICT,metric TEXT NOT NULL,unit TEXT NOT NULL,event_timestamp TEXT NOT NULL,receipt_timestamp TEXT NOT NULL,value REAL NOT NULL,quality TEXT NOT NULL,source TEXT NOT NULL,provenance_id TEXT NOT NULL,batch_id TEXT NOT NULL,UNIQUE(batch_id,point_id));
CREATE INDEX IF NOT EXISTS idx_telemetry_asset_metric_time ON telemetry(asset_id,metric,event_timestamp);
CREATE TABLE IF NOT EXISTS anomalies(anomaly_id TEXT PRIMARY KEY,asset_id TEXT NOT NULL REFERENCES assets(asset_id) ON DELETE RESTRICT,metric TEXT NOT NULL,detected_at TEXT NOT NULL,method TEXT NOT NULL,baseline REAL NOT NULL,observed_value REAL NOT NULL,deviation REAL NOT NULL,severity TEXT NOT NULL,explanation TEXT NOT NULL,evidence_refs_json TEXT NOT NULL DEFAULT '[]');
CREATE TABLE IF NOT EXISTS alerts(alert_id TEXT PRIMARY KEY,anomaly_id TEXT,rule_id TEXT,site_id TEXT NOT NULL REFERENCES sites(site_id) ON DELETE RESTRICT,asset_id TEXT NOT NULL REFERENCES assets(asset_id) ON DELETE RESTRICT,severity TEXT NOT NULL,state TEXT NOT NULL,raised_at TEXT NOT NULL,acknowledged_at TEXT,acknowledged_by TEXT,recommendation TEXT NOT NULL,evidence_refs_json TEXT NOT NULL DEFAULT '[]');
CREATE TABLE IF NOT EXISTS evidence(sequence INTEGER PRIMARY KEY AUTOINCREMENT,evidence_id TEXT NOT NULL UNIQUE,event_type TEXT NOT NULL,actor TEXT NOT NULL,scope_json TEXT NOT NULL,event_timestamp TEXT NOT NULL,input_hash TEXT NOT NULL,output_hash TEXT NOT NULL,previous_hash TEXT NOT NULL,source_refs_json TEXT NOT NULL,decision TEXT,metadata_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS readiness_assessments(assessment_id TEXT PRIMARY KEY,site_id TEXT NOT NULL,overall_score REAL NOT NULL,dimensions_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ingestion_batches(batch_id TEXT PRIMARY KEY,accepted_count INTEGER NOT NULL,rejected_count INTEGER NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sync_queue(sequence INTEGER PRIMARY KEY AUTOINCREMENT,envelope_id TEXT NOT NULL UNIQUE,payload_json TEXT NOT NULL,destination TEXT NOT NULL,purpose TEXT NOT NULL,data_class TEXT NOT NULL,retention TEXT NOT NULL,authority TEXT NOT NULL,encryption_state TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'QUEUED',created_at TEXT NOT NULL,replayed_at TEXT);
CREATE TABLE IF NOT EXISTS manufacturing_nodes(
    node_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    status TEXT NOT NULL,
    available_capacity REAL NOT NULL,
    lead_time_hours REAL NOT NULL,
    unit_cost REAL NOT NULL,
    local_content_ratio REAL NOT NULL,
    energy_state TEXT NOT NULL,
    connectivity_state TEXT NOT NULL,
    quality_state TEXT NOT NULL,
    machine_types_json TEXT NOT NULL,
    processes_json TEXT NOT NULL,
    materials_json TEXT NOT NULL,
    workforce_skills_json TEXT NOT NULL,
    certifications_json TEXT NOT NULL,
    permissions_json TEXT NOT NULL,
    constraints_json TEXT NOT NULL,
    evidence_refs_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS manufacturing_designs(
    design_id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    version TEXT NOT NULL,
    ip_rights_status TEXT NOT NULL,
    expired INTEGER NOT NULL,
    bom_json TEXT NOT NULL,
    allowed_materials_json TEXT NOT NULL,
    allowed_machine_types_json TEXT NOT NULL,
    allowed_jurisdictions_json TEXT NOT NULL,
    required_certifications_json TEXT NOT NULL,
    authorized_uses_json TEXT NOT NULL,
    evidence_refs_json TEXT NOT NULL
);
'''
    )
    conn.commit()
