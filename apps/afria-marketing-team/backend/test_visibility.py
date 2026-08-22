from fastapi.testclient import TestClient
from main import app
from visibility import VisibilityAssessment, assess_visibility

client = TestClient(app)


def full_payload():
    return VisibilityAssessment(
        enterprise_name="Example SA",
        country="Bénin",
        verified_identity=True,
        verified_source_count=5,
        website_present=True,
        search_presence=100,
        ai_presence=100,
        media_presence=100,
        professional_presence=100,
        marketplace_presence=100,
        institutional_presence=100,
        investor_presence=100,
    )


def test_full_visibility_has_zero_gap():
    result = assess_visibility(full_payload())
    assert result.visibility_score == 100
    assert result.visibility_gap == 0
    assert result.priority == "low"
    assert result.confidence == "high"


def test_missing_observations_are_marked_never_invented():
    result = assess_visibility(VisibilityAssessment(
        enterprise_name="Invisible SARL",
        country="Mali",
        verified_identity=True,
        website_present=False,
    ))
    assert "search_presence" in result.missing_dimensions
    assert result.missing_data_policy == "mark_missing_never_invent"
    assert result.confidence == "low"
    assert result.visibility_gap >= 70


def test_weakest_channels_drive_actions():
    payload = full_payload().model_copy(update={"ai_presence": 15, "marketplace_presence": 20})
    result = assess_visibility(payload)
    assert any("IA" in action for action in result.recommended_actions)
    assert any("marketplace" in action.lower() for action in result.recommended_actions)


def test_api_exposes_canonical_capability_without_new_product():
    response = client.post("/visibility/assess", json={
        "enterprise_name": "Atelier Kora",
        "country": "Bénin",
        "verified_identity": True,
        "verified_source_count": 2,
        "website_present": True,
        "search_presence": 55,
        "ai_presence": 20,
        "media_presence": 10,
        "professional_presence": 40,
        "marketplace_presence": 0,
        "institutional_presence": 25,
        "investor_presence": 5
    })
    assert response.status_code == 200
    body = response.json()
    assert body["parent_asset_id"] == "PRD-MKT-TEAM-001"
    assert body["capability"] == "AfrIA AI Visibility Intelligence™"
    assert body["metric"] == "African Enterprise Visibility Gap™"
    assert body["new_product_created"] is False
