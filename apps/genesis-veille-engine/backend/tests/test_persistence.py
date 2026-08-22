from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.main import create_app
from app.models import AcceptedEvent, EventInput, ProvenanceDecision, SourceRecord
from app.persistence import SQLiteStateRepository


INGEST_KEY = "persistence-test-key"
AUTH_HEADERS = {"X-Genesis-Ingest-Key": INGEST_KEY}


def source() -> SourceRecord:
    return SourceRecord(
        id="src-persist-1",
        name="Persistent Official Source",
        source_type="official",
        license_class="public",
        reliability_tier=1,
        active=True,
    )


def event() -> EventInput:
    return EventInput(
        id="evt-persist-1",
        event_type="funding",
        title="Funding window opened",
        country_iso3="MLI",
        observed_at=datetime(2026, 8, 22, 2, 50, tzinfo=timezone.utc),
        source_ids=["src-persist-1"],
        confidence=0.92,
        corroboration_count=1,
        sensitive=False,
        sector="humanitarian",
    )


def accepted_event() -> AcceptedEvent:
    return AcceptedEvent(
        event=event(),
        provenance=ProvenanceDecision(
            accepted=True,
            status="VERIFIED",
            reasons=[],
        ),
    )


def test_sqlite_repository_recovers_sources_and_events_after_reopen(tmp_path):
    db_path = tmp_path / "world-state.db"

    first = SQLiteStateRepository(db_path)
    first.save_source(source())
    first.save_event(accepted_event())
    first.close()

    reopened = SQLiteStateRepository(db_path)

    assert [item.id for item in reopened.list_sources()] == ["src-persist-1"]
    restored_events = reopened.list_events()
    assert len(restored_events) == 1
    assert restored_events[0].event.id == "evt-persist-1"
    assert restored_events[0].provenance.status == "VERIFIED"
    reopened.close()


def test_api_world_state_survives_application_restart(tmp_path):
    db_path = tmp_path / "api-state.db"

    first = TestClient(create_app(ingest_key=INGEST_KEY, storage_path=db_path))
    created_source = first.post(
        "/api/v1/sources",
        json=source().model_dump(mode="json"),
        headers=AUTH_HEADERS,
    )
    created_event = first.post(
        "/api/v1/events",
        json=event().model_dump(mode="json"),
        headers=AUTH_HEADERS,
    )

    assert created_source.status_code == 201
    assert created_event.status_code == 201

    restarted = TestClient(create_app(ingest_key=INGEST_KEY, storage_path=db_path))
    state = restarted.get("/api/v1/world-state/countries/MLI")

    assert state.status_code == 200
    assert state.json()["event_count"] == 1
    assert state.json()["opportunity_score"] == 10.0
    assert [item["id"] for item in restarted.get("/api/v1/sources").json()] == [
        "src-persist-1"
    ]
    assert [item["event"]["id"] for item in restarted.get("/api/v1/events").json()] == [
        "evt-persist-1"
    ]


def test_sqlite_backup_is_restoreable(tmp_path):
    db_path = tmp_path / "primary.db"
    backup_path = tmp_path / "backup.db"

    repository = SQLiteStateRepository(db_path)
    repository.save_source(source())
    repository.save_event(accepted_event())
    repository.backup(backup_path)
    repository.close()

    restored = SQLiteStateRepository(backup_path)

    assert [item.id for item in restored.list_sources()] == ["src-persist-1"]
    assert [item.event.id for item in restored.list_events()] == ["evt-persist-1"]
    restored.close()
