from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.connectors import ConnectorObservation
from app.main import create_app
from app.models import CrawlTarget, SourceRecord


INGEST_KEY = "scheduler-api-key"
AUTH = {"X-Genesis-Ingest-Key": INGEST_KEY}
NOW = datetime(2026, 8, 22, 5, 25, tzinfo=timezone.utc)


def source_payload():
    return SourceRecord(
        id="src-api-sched",
        name="API Scheduler Source",
        source_type="official",
        license_class="public",
        reliability_tier=1,
        active=True,
        allowed_hosts=["example.org"],
    ).model_dump(mode="json")


def target_payload(url: str = "https://example.org/news"):
    return CrawlTarget(
        id="target-api-1",
        source_id="src-api-sched",
        url=url,
        country_iso3="MLI",
        event_type_hint="funding",
        sector="development",
        enabled=True,
        interval_seconds=3600,
        next_due_at=NOW,
    ).model_dump(mode="json")


class FakeConnector:
    def fetch(self, *, source, url, country_iso3, event_type_hint, sector=None, sensitive=False):
        return ConnectorObservation(
            source_id=source.id,
            url=url,
            retrieved_at=NOW,
            title="Scheduled official update",
            content_text="A verified funding window is open.",
            country_iso3=country_iso3,
            event_type_hint=event_type_hint,
            sector=sector,
            sensitive=sensitive,
        )


def test_crawl_target_routes_require_durable_storage():
    client = TestClient(create_app(ingest_key=INGEST_KEY))

    response = client.get("/api/v1/crawl-targets", headers=AUTH)

    assert response.status_code == 503


def test_register_and_list_crawl_target_are_private_and_durable(tmp_path):
    db_path = tmp_path / "scheduler-api.db"
    client = TestClient(create_app(ingest_key=INGEST_KEY, storage_path=db_path))
    assert client.post("/api/v1/sources", json=source_payload(), headers=AUTH).status_code == 201

    unauthorized = client.post("/api/v1/crawl-targets", json=target_payload())
    created = client.post("/api/v1/crawl-targets", json=target_payload(), headers=AUTH)
    listed = client.get("/api/v1/crawl-targets", headers=AUTH)

    assert unauthorized.status_code == 401
    assert created.status_code == 201
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == ["target-api-1"]

    restarted = TestClient(create_app(ingest_key=INGEST_KEY, storage_path=db_path))
    assert [item["id"] for item in restarted.get("/api/v1/crawl-targets", headers=AUTH).json()] == [
        "target-api-1"
    ]


def test_register_crawl_target_rejects_url_outside_source_allowlist(tmp_path):
    client = TestClient(create_app(ingest_key=INGEST_KEY, storage_path=tmp_path / "host.db"))
    client.post("/api/v1/sources", json=source_payload(), headers=AUTH)

    response = client.post(
        "/api/v1/crawl-targets",
        json=target_payload("https://other.example/news"),
        headers=AUTH,
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "CRAWL_TARGET_REJECTED"


def test_scheduler_tick_is_disabled_by_default(tmp_path):
    client = TestClient(
        create_app(
            ingest_key=INGEST_KEY,
            storage_path=tmp_path / "disabled.db",
            http_connector_enabled=True,
            http_connector=FakeConnector(),
            clock=lambda: NOW,
        )
    )

    response = client.post("/api/v1/crawler/tick", headers=AUTH)

    assert response.status_code == 503


def test_enabled_scheduler_tick_processes_due_target_and_persists_state(tmp_path):
    db_path = tmp_path / "enabled.db"
    client = TestClient(
        create_app(
            ingest_key=INGEST_KEY,
            storage_path=db_path,
            http_connector_enabled=True,
            scheduler_enabled=True,
            http_connector=FakeConnector(),
            clock=lambda: NOW,
        )
    )
    client.post("/api/v1/sources", json=source_payload(), headers=AUTH)
    client.post("/api/v1/crawl-targets", json=target_payload(), headers=AUTH)

    tick = client.post("/api/v1/crawler/tick", headers=AUTH)
    world_state = client.get("/api/v1/world-state/countries/MLI")
    targets = client.get("/api/v1/crawl-targets", headers=AUTH).json()

    assert tick.status_code == 200
    assert tick.json() == {"attempted": 1, "succeeded": 1, "unchanged": 0, "failed": 0}
    assert world_state.json()["event_count"] == 1
    assert targets[0]["last_success_at"] == NOW.isoformat().replace("+00:00", "Z")
    assert targets[0]["failure_count"] == 0
    assert targets[0]["last_content_sha256"]

    restarted = TestClient(create_app(ingest_key=INGEST_KEY, storage_path=db_path))
    assert restarted.get("/api/v1/world-state/countries/MLI").json()["event_count"] == 1
    assert restarted.get("/api/v1/crawl-targets", headers=AUTH).json()[0]["last_content_sha256"]
