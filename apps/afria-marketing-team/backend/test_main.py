from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health_exposes_production_boundary():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["asset_id"] == "PRD-MKT-TEAM-001"
    assert body["product_standard"] == "Production Product"
    assert body["production_revenue_ready"] is False
    assert body["literal"] == "PRODUCTION_REVENUE_READY=false"


def test_policy_blocks_send_without_human_approval():
    response = client.post("/policy/simulate", json={"capability": "SEND", "human_approved": False})
    assert response.status_code == 200
    assert response.json()["state"] == "needs_human"


def test_product_intake_marks_missing_never_invent():
    response = client.post("/product/intake", json={
        "product_name": "AfrIA Marketing Team™",
        "offer": "Starter Revenue Engine",
        "country": "Bénin",
        "buyer_role": "CEO PME",
        "objective": "installer un moteur commercial IA"
    })
    assert response.status_code == 200
    body = response.json()
    assert body["product_object"]["asset_id"] == "PRD-MKT-TEAM-001"
    assert body["product_object"]["missing_data_policy"] == "mark_missing_never_invent"


def test_evidence_requires_revenue_ready_false_boundary():
    response = client.post("/export/evidence", json={
        "asset_id": "PRD-MKT-TEAM-001",
        "product_standard": "Production Product",
        "production_revenue_ready": False
    })
    assert response.status_code == 200
    assert response.json()["valid"] is True
