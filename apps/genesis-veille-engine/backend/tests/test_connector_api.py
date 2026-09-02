from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.connectors import FetchedDocument, PublicHttpConnector
from app.main import create_app


INGEST_KEY = "connector-api-key"
AUTH_HEADERS = {"X-Genesis-Ingest-Key": INGEST_KEY}


class FakeTransport:
    def fetch(self, url: str, *, allowed_hosts: list[str]) -> FetchedDocument:
        return FetchedDocument(
            final_url=url,
            content_type="text/html",
            retrieved_at=datetime(2026, 8, 22, 3, 25, tzinfo=timezone.utc),
            title="Mali public tender",
            text="A public tender opportunity has opened in Mali.",
        )


def source_payload() -> dict:
    return {
        "id": "src-http-api",
        "name": "Official Notices",
        "source_type": "official",
        "license_class": "public",
        "reliability_tier": 1,
        "active": True,
        "allowed_hosts": ["example.org"],
    }


def connector_payload() -> dict:
    return {
        "source_id": "src-http-api",
        "url": "https://example.org/tenders/42",
        "country_iso3": "MLI",
        "event_type_hint": "tender",
        "sector": "procurement",
        "sensitive": False,
    }


def test_http_connector_endpoint_is_disabled_by_default():
    api = TestClient(create_app(ingest_key=INGEST_KEY))
    api.post("/api/v1/sources", json=source_payload(), headers=AUTH_HEADERS)

    response = api.post(
        "/api/v1/connectors/http/ingest",
        json=connector_payload(),
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 503


def test_enabled_http_connector_ingests_only_through_existing_provenance_pipeline():
    connector = PublicHttpConnector(transport=FakeTransport())
    api = TestClient(
        create_app(
            ingest_key=INGEST_KEY,
            http_connector_enabled=True,
            http_connector=connector,
        )
    )
    api.post("/api/v1/sources", json=source_payload(), headers=AUTH_HEADERS)

    response = api.post(
        "/api/v1/connectors/http/ingest",
        json=connector_payload(),
        headers=AUTH_HEADERS,
    )
    state = api.get("/api/v1/world-state/countries/MLI")

    assert response.status_code == 201
    assert response.json()["provenance"]["status"] == "VERIFIED"
    assert response.json()["event"]["event_type"] == "tender"
    assert state.json()["event_count"] == 1
    assert state.json()["opportunity_score"] == 10.0


def test_connector_endpoint_rejects_unregistered_host():
    connector = PublicHttpConnector(transport=FakeTransport())
    api = TestClient(
        create_app(
            ingest_key=INGEST_KEY,
            http_connector_enabled=True,
            http_connector=connector,
        )
    )
    api.post("/api/v1/sources", json=source_payload(), headers=AUTH_HEADERS)
    payload = connector_payload()
    payload["url"] = "https://attacker.example/tenders/42"

    response = api.post(
        "/api/v1/connectors/http/ingest",
        json=payload,
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "CONNECTOR_REJECTED"
    assert api.get("/api/v1/events").json() == []
