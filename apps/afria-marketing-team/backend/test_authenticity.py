from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_authenticity_gate_passes_high_signal_content():
    response = client.post("/content/authenticity/assess", json={
        "platform": "linkedin",
        "originality_score": 90,
        "evidence_score": 85,
        "specificity_score": 92,
        "human_contribution_score": 88,
        "information_density_score": 84,
        "generic_language_risk": 12,
        "verified_evidence_count": 3,
        "human_reviewed": True
    })
    assert response.status_code == 200
    body = response.json()
    assert body["capability"] == "Human Signal & Authenticity Gate™"
    assert body["decision"] == "pass"
    assert body["send_allowed"] is False
    assert body["human_send_approval_required"] is True


def test_authenticity_gate_blocks_generic_unproven_content():
    response = client.post("/content/authenticity/assess", json={
        "platform": "linkedin",
        "originality_score": 35,
        "evidence_score": 20,
        "specificity_score": 25,
        "human_contribution_score": 30,
        "information_density_score": 30,
        "generic_language_risk": 85,
        "verified_evidence_count": 0,
        "human_reviewed": False
    })
    assert response.status_code == 200
    body = response.json()
    assert body["decision"] == "block"
    assert "verified evidence" in " ".join(body["reasons"]).lower()


def test_authenticity_gate_requires_revision_when_signal_is_middling():
    response = client.post("/content/authenticity/assess", json={
        "platform": "youtube",
        "originality_score": 70,
        "evidence_score": 65,
        "specificity_score": 68,
        "human_contribution_score": 70,
        "information_density_score": 66,
        "generic_language_risk": 40,
        "verified_evidence_count": 1,
        "human_reviewed": True
    })
    assert response.status_code == 200
    assert response.json()["decision"] == "revise"
