import sqlite3
from datetime import datetime, timedelta, timezone

from app.connectors import ConnectorObservation
from app.models import CrawlTarget, SourceRecord
from app.persistence import SQLiteStateRepository
from app.provenance import ProvenanceGate
from app.scheduler import CrawlScheduler
from app.source_registry import SourceRegistry
from app.world_state import WorldStateStore


NOW = datetime(2026, 8, 22, 5, 20, tzinfo=timezone.utc)


def source() -> SourceRecord:
    return SourceRecord(
        id="src-sched-1",
        name="Scheduler Official Source",
        source_type="official",
        license_class="public",
        reliability_tier=1,
        active=True,
        allowed_hosts=["example.org"],
    )


def target(**overrides) -> CrawlTarget:
    values = {
        "id": "crawl-target-1",
        "source_id": "src-sched-1",
        "url": "https://example.org/news",
        "country_iso3": "MLI",
        "event_type_hint": "funding",
        "sector": "development",
        "enabled": True,
        "interval_seconds": 3600,
        "next_due_at": NOW,
    }
    values.update(overrides)
    return CrawlTarget(**values)


class FakeConnector:
    def __init__(self, text: str = "Funding window opened", fail: bool = False):
        self.text = text
        self.fail = fail
        self.calls = 0

    def fetch(self, *, source, url, country_iso3, event_type_hint, sector=None, sensitive=False):
        self.calls += 1
        if self.fail:
            raise ValueError("upstream unavailable")
        return ConnectorObservation(
            source_id=source.id,
            url=url,
            retrieved_at=NOW,
            title="Official update",
            content_text=self.text,
            country_iso3=country_iso3,
            event_type_hint=event_type_hint,
            sector=sector,
            sensitive=sensitive,
        )


def build_scheduler(repository: SQLiteStateRepository, connector: FakeConnector):
    registry = SourceRegistry(repository.list_sources())
    gate = ProvenanceGate(registry)
    store = WorldStateStore(repository.list_events())
    return CrawlScheduler(
        repository=repository,
        registry=registry,
        connector=connector,
        pipeline_factory=lambda: __import__("app.connectors", fromlist=["ConnectorPipeline"]).ConnectorPipeline(
            registry, gate, store, repository
        ),
    ), store


def test_v1_database_is_migrated_through_v2_to_latest_without_losing_crawl_state(tmp_path):
    db_path = tmp_path / "legacy-v1.db"
    connection = sqlite3.connect(db_path)
    connection.executescript(
        """
        CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        INSERT INTO metadata(key, value) VALUES('schema_version', '1');
        CREATE TABLE sources (id TEXT PRIMARY KEY, payload_json TEXT NOT NULL, payload_sha256 TEXT NOT NULL);
        CREATE TABLE events (id TEXT PRIMARY KEY, payload_json TEXT NOT NULL, payload_sha256 TEXT NOT NULL);
        """
    )
    connection.commit()
    connection.close()

    repository = SQLiteStateRepository(db_path)

    assert repository.schema_version() == "3"
    assert repository.list_crawl_targets() == []
    assert repository.list_audit_records() == []
    repository.close()


def test_latest_schema_can_roll_back_v3_to_v2_then_v1_when_no_new_state_exists(tmp_path):
    db_path = tmp_path / "rollback.db"
    repository = SQLiteStateRepository(db_path)
    assert repository.schema_version() == "3"

    repository.rollback_schema_to_v2()
    assert repository.schema_version() == "2"
    repository.rollback_schema_to_v1()

    assert repository.schema_version() == "1"
    repository.close()


def test_crawl_target_survives_repository_reopen(tmp_path):
    db_path = tmp_path / "targets.db"
    repository = SQLiteStateRepository(db_path)
    repository.save_source(source())
    repository.save_crawl_target(target())
    repository.close()

    reopened = SQLiteStateRepository(db_path)
    restored = reopened.list_crawl_targets()

    assert len(restored) == 1
    assert restored[0].id == "crawl-target-1"
    assert restored[0].url == "https://example.org/news"
    assert restored[0].next_due_at == NOW
    reopened.close()


def test_scheduler_selects_only_due_enabled_targets(tmp_path):
    repository = SQLiteStateRepository(tmp_path / "due.db")
    repository.save_source(source())
    repository.save_crawl_target(target(id="due"))
    repository.save_crawl_target(target(id="future", next_due_at=NOW + timedelta(hours=2)))
    repository.save_crawl_target(target(id="disabled", enabled=False))

    due = repository.list_due_crawl_targets(NOW)

    assert [item.id for item in due] == ["due"]
    repository.close()


def test_scheduler_success_persists_event_and_advances_next_due(tmp_path):
    repository = SQLiteStateRepository(tmp_path / "success.db")
    repository.save_source(source())
    repository.save_crawl_target(target())
    connector = FakeConnector()
    scheduler, store = build_scheduler(repository, connector)

    result = scheduler.tick(NOW)
    refreshed = repository.get_crawl_target("crawl-target-1")

    assert result.succeeded == 1
    assert result.failed == 0
    assert result.unchanged == 0
    assert connector.calls == 1
    assert store.country_state("MLI")["event_count"] == 1
    assert refreshed is not None
    assert refreshed.last_success_at == NOW
    assert refreshed.failure_count == 0
    assert refreshed.last_error is None
    assert refreshed.last_content_sha256
    assert refreshed.next_due_at == NOW + timedelta(hours=1)
    repository.close()


def test_scheduler_unchanged_content_does_not_duplicate_world_state(tmp_path):
    repository = SQLiteStateRepository(tmp_path / "unchanged.db")
    repository.save_source(source())
    repository.save_crawl_target(target())
    connector = FakeConnector()
    scheduler, store = build_scheduler(repository, connector)

    first = scheduler.tick(NOW)
    stored = repository.get_crawl_target("crawl-target-1")
    repository.save_crawl_target(stored.model_copy(update={"next_due_at": NOW + timedelta(hours=1)}))
    second = scheduler.tick(NOW + timedelta(hours=1))

    assert first.succeeded == 1
    assert second.unchanged == 1
    assert second.succeeded == 0
    assert store.country_state("MLI")["event_count"] == 1
    assert len(repository.list_events()) == 1
    repository.close()


def test_scheduler_failure_records_error_and_exponential_backoff(tmp_path):
    repository = SQLiteStateRepository(tmp_path / "failure.db")
    repository.save_source(source())
    repository.save_crawl_target(target())
    connector = FakeConnector(fail=True)
    scheduler, _ = build_scheduler(repository, connector)

    result = scheduler.tick(NOW)
    refreshed = repository.get_crawl_target("crawl-target-1")

    assert result.failed == 1
    assert refreshed is not None
    assert refreshed.failure_count == 1
    assert refreshed.last_attempt_at == NOW
    assert refreshed.last_success_at is None
    assert refreshed.last_error == "upstream unavailable"
    assert refreshed.next_due_at == NOW + timedelta(hours=2)
    repository.close()
