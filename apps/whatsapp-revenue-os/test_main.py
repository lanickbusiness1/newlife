import main as app_module
from fastapi.testclient import TestClient


client = TestClient(app_module.app)


def test_health_keeps_truthful_release_boundary():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["asset_id"] == "PRD-WA-AGENT-FACTORY-001"
    assert body["demo_ready"] is False
    assert body["client_live"] is False
    assert body["release_stage"] == "CODE_REVIEW"


def test_demo_inbound_runs_safe_simulated_vertical_slice():
    app_module.runtime_control["kill_switch_active"] = False
    response = client.post("/demo/inbound", json={
        "from_number": "+224600000010",
        "text": "Bonjour, je cherche une parcelle vers Calavi, budget 12 millions",
    })
    assert response.status_code == 200
    body = response.json()
    assert body["qualification"]["zone"] == "Calavi"
    assert body["reply_sent"] is True
    assert body["handoff_created"] is True


def test_operator_dashboard_requires_token(monkeypatch):
    monkeypatch.setenv("OPERATOR_TOKEN", "operator-secret")
    unauthorized = client.get("/dashboard/summary")
    assert unauthorized.status_code == 401
    authorized = client.get("/dashboard/summary", headers={"X-Operator-Token": "operator-secret"})
    assert authorized.status_code == 200
    assert authorized.json()["demo_ready"] is False


def test_kill_switch_can_block_demo_outbound(monkeypatch):
    monkeypatch.setenv("OPERATOR_TOKEN", "operator-secret")
    on = client.post(
        "/control/kill-switch",
        headers={"X-Operator-Token": "operator-secret"},
        json={"active": True},
    )
    assert on.status_code == 200
    blocked = client.post("/demo/inbound", json={
        "from_number": "+224600000011",
        "text": "Je cherche une parcelle vers Calavi, budget 12 millions",
    })
    assert blocked.status_code == 200
    assert blocked.json()["reply_sent"] is False
    assert blocked.json()["policy_reason"] == "kill_switch_active"
    app_module.runtime_control["kill_switch_active"] = False


def test_webhook_challenge_uses_configured_verify_token(monkeypatch):
    monkeypatch.setenv("META_VERIFY_TOKEN", "verify-me")
    response = client.get(
        "/webhook/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "verify-me",
            "hub.challenge": "12345",
        },
    )
    assert response.status_code == 200
    assert response.text == "12345"
