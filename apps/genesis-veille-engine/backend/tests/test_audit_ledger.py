import json
import sqlite3
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.models import AuditRecord, SourceRecord
from app.persistence import SQLiteStateRepository


INGEST_KEY = "audit-test-key"
AUTH = {"X-Genesis-Ingest-Key": INGEST_KEY}
NOW = datetime(2026, 8, 22, 5, 30, tzinfo=timezone.utc)


def source_payload():
    return SourceRecord(
        id="src-audit-1",
        name="Audit Official Source",
        source_type="official",
        license_class="public",
        reliability_tier=1,
        active=True,
        allowed_hosts=["example.org"],
    ).model_dump(mode="json")


def audit_record(**overrides):
    values = {
        "id": "audit-1",
        "occurred_at": NOW,
        "action": "SOURCE_REGISTER",
        "outcome": "SUCCEEDED",
        "resource": "/api/v1/sources",
        "reason": None,
        "source_id": "src-audit-1",
        "target_id": None,
        "details": {"status_code": 201},
    }
    values.update(overrides)
    return AuditRecord(**values)


def test_v2_database_is_migrated_to_v3_with_empty_audit_ledger(tmp_path):
    db_path = tmp_path / "legacy-v2.db"
    connection = sqlite3.connect(db_path)
    connection.executescript(
        """
        CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        INSERT INTO metadata(key, value) VALUES('schema_version', '2');
        CREATE TABLE sources (id TEXT PRIMARY KEY, payload_json TEXT NOT NULL, payload_sha256 TEXT NOT NULL);
        CREATE TABLE events (id TEXT PRIMARY KEY, payload_json TEXT NOT NULL, payload_sha256 TEXT NOT NULL);
        CREATE TABLE crawl_targets (id TEXT PRIMARY KEY, payload_json TEXT NOT NULL, payload_sha256 TEXT NOT NULL);
        """
    )
    connection.commit()
    connection.close()

    repository = SQLiteStateRepository(db_path)

    assert repository.schema_version() == "3"
    assert repository.list_audit_records() == []
    repository.close()


def test_v3_schema_rolls_back_to_v2_only_when_audit_ledger_is_empty(tmp_path):
    db_path = tmp_path / "rollback-v3.db"
    repository = SQLiteStateRepository(db_path)
    assert repository.schema_version() == "3"

    repository.rollback_schema_to_v2()
    assert repository.schema_version() == "2"
    repository.close()

    repository = SQLiteStateRepository(db_path)
    repository.save_audit_record(audit_record())
    with pytest.raises(RuntimeError, match="audit records"):
        repository.rollback_schema_to_v2()
    repository.close()


def test_audit_record_is_append_only_persistent_and_integrity_checked(tmp_path):
    db_path = tmp_path / "audit.db"
    repository = SQLiteStateRepository(db_path)
    repository.save_audit_record(audit_record())
    with pytest.raises(ValueError, match="duplicate audit id"):
        repository.save_audit_record(audit_record(reason="replacement"))
    repository.close()

    reopened = SQLiteStateRepository(db_path)
    records = reopened.list_audit_records()
    assert len(records) == 1
    assert records[0].action == "SOURCE_REGISTER"
    reopened.close()

    connection = sqlite3.connect(db_path)
    connection.execute(
        "UPDATE audit_records SET payload_json = replace(payload_json, 'SUCCEEDED', 'FAILED') WHERE id = 'audit-1'"
    )
    connection.commit()
    connection.close()

    tampered = SQLiteStateRepository(db_path)
    with pytest.raises(ValueError, match="integrity check failed for audit:audit-1"):
        tampered.list_audit_records()
    tampered.close()


def test_audit_api_is_private_and_successful_source_write_is_recorded(tmp_path):
    client = TestClient(
        create_app(
            ingest_key=INGEST_KEY,
            storage_path=tmp_path / "api-audit.db",
            clock=lambda: NOW,
        )
    )

    assert client.get("/api/v1/audit").status_code == 401
    created = client.post("/api/v1/sources", json=source_payload(), headers=AUTH)
    records = client.get("/api/v1/audit", headers=AUTH)

    assert created.status_code == 201
    assert records.status_code == 200
    source_records = [item for item in records.json() if item["action"] == "SOURCE_REGISTER"]
    assert len(source_records) == 1
    assert source_records[0]["outcome"] == "SUCCEEDED"
    assert source_records[0]["source_id"] == "src-audit-1"


def test_wrong_ingest_key_is_audited_without_storing_secret(tmp_path):
    client = TestClient(
        create_app(
            ingest_key=INGEST_KEY,
            storage_path=tmp_path / "denied.db",
            clock=lambda: NOW,
        )
    )
    bad_secret = "definitely-wrong-secret"

    denied = client.post(
        "/api/v1/sources",
        json=source_payload(),
        headers={"X-Genesis-Ingest-Key": bad_secret},
    )
    records = client.get("/api/v1/audit", headers=AUTH)

    assert denied.status_code == 401
    payload = records.json()
    auth_denials = [item for item in payload if item["action"] == "AUTHORIZATION"]
    assert auth_denials
    assert auth_denials[-1]["outcome"] == "DENIED"
    assert auth_denials[-1]["resource"] == "/api/v1/sources"
    assert bad_secret not in json.dumps(payload)
    assert INGEST_KEY not in json.dumps(payload)


def test_disabled_connector_and_scheduler_decisions_are_audited(tmp_path):
    client = TestClient(
        create_app(
            ingest_key=INGEST_KEY,
            storage_path=tmp_path / "decisions.db",
            clock=lambda: NOW,
        )
    )
    client.post("/api/v1/sources", json=source_payload(), headers=AUTH)

    connector = client.post(
        "/api/v1/connectors/http/ingest",
        json={
            "source_id": "src-audit-1",
            "url": "https://example.org/",
            "country_iso3": "MLI",
            "event_type_hint": "funding",
            "sector": "development",
            "sensitive": False,
        },
        headers=AUTH,
    )
    scheduler = client.post("/api/v1/crawler/tick", headers=AUTH)
    records = client.get("/api/v1/audit", headers=AUTH).json()

    assert connector.status_code == 503
    assert scheduler.status_code == 503
    connector_records = [item for item in records if item["action"] == "HTTP_CONNECTOR_INGEST"]
    scheduler_records = [item for item in records if item["action"] == "SCHEDULER_TICK"]
    assert connector_records[-1]["outcome"] == "DENIED"
    assert scheduler_records[-1]["outcome"] == "DENIED"
    assert "disabled" in connector_records[-1]["reason"]
    assert "disabled" in scheduler_records[-1]["reason"]
