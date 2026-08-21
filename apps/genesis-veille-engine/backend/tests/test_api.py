from fastapi.testclient import TestClient

from app.main import create_app


def client() -> TestClient:
    return TestClient(create_app())


def source_payload(source_id: str = "src-official-1") -> dict:
    return {
        "id": source_id,
        "name": "Official Source",
        "source_type": "official",
        "license_class": "public",
        "reliability_tier": 1,
        "active": True,
    }


def event_payload(source_ids: list[str] | None = None, **overrides) -> dict:
    payload = {
        "id": "evt-api-1",
        "event_type": "internet_outage",
        "title": "Connectivity disruption",
        "country_iso3": "mli",
        "observed_at": "2026-08-21T12:30:00Z",
        "source_ids": source_ids or ["src-official-1"],
        "confidence": 0.91,
        "corroboration_count": 1,
        "sensitive": False,
        "sector": "telecom",
    }
    payload.update(overrides)
    return payload


def test_health_contract():
    response = client().get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "genesis-veille-world-state",
        "version": "0.1.0",
    }


def test_root_serves_public_africa_shell():
    response = client().get("/")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Genesis Veille — Africa World State" in response.text
    assert "Africa World State · Public Intelligence" in response.text


def test_register_source_and_list_it():
    api = client()

    created = api.post("/api/v1/sources", json=source_payload())
    listed = api.get("/api/v1/sources")

    assert created.status_code == 201
    assert created.json()["id"] == "src-official-1"
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == ["src-official-1"]


def test_rejected_event_returns_conflict_and_is_not_stored():
    api = client()

    response = api.post("/api/v1/events", json=event_payload(source_ids=["unknown-source"]))

    assert response.status_code == 409
    assert response.json()["detail"]["status"] == "REJECTED"
    assert api.get("/api/v1/events").json() == []


def test_accept_event_and_expose_country_world_state():
    api = client()
    api.post("/api/v1/sources", json=source_payload())

    accepted = api.post("/api/v1/events", json=event_payload())
    state = api.get("/api/v1/world-state/countries/mli")

    assert accepted.status_code == 201
    assert accepted.json()["provenance"]["status"] == "VERIFIED"
    assert accepted.json()["event"]["country_iso3"] == "MLI"
    assert state.status_code == 200
    assert state.json()["country_iso3"] == "MLI"
    assert state.json()["event_count"] == 1
    assert state.json()["risk_score"] == 10.0
    assert state.json()["opportunity_score"] == 0.0
