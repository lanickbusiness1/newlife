from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_cea_heritage_lead_preserves_content_id_and_routes_memory_culture():
    response = client.post(
        "/cea/lead/qualify",
        json={
            "content_id": "VODUN-KAKPO-001",
            "narrative_source": "griot/capsule-01",
            "primary_intent": "Mémoire & Culture",
            "horizon": "30-90d",
            "budget_usd": 1200,
            "consent_contact": True,
            "language": "FR",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["profile"] == "CEA_RETURN"
    assert body["content_id"] == "VODUN-KAKPO-001"
    assert body["priority"] == "P1 - Cette semaine"
    assert body["next_best_offer"] == "Accueil Cotonou 600 USD"
    assert body["crm_record"]["Content ID"] == "VODUN-KAKPO-001"
    assert body["crm_record"]["Consentement Contact"] == "__YES__"


def test_cea_lead_never_allows_direct_contact_without_consent():
    response = client.post(
        "/cea/lead/qualify",
        json={
            "content_id": "VODUN-KAKPO-002",
            "narrative_source": "griot/capsule-01",
            "primary_intent": "Voyage",
            "horizon": "<30d",
            "budget_usd": 900,
            "consent_contact": False,
            "language": "EN",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["contact_allowed"] is False
    assert body["crm_record"]["Consentement Contact"] == "__NO__"


def test_public_funnel_blocks_initiatic_content():
    response = client.post(
        "/cea/heritage/event/track",
        json={
            "session_id": "sess-sensitive-001",
            "content_id": "VODUN-SECRET-001",
            "source_campaign": "griot-private",
            "narrative_source": "community",
            "event_type": "CONTENT_VIEW",
            "heritage_sensitivity": "INITIATIC_N2",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] is False
    assert body["blocked"] is True
    assert body["reason"] == "sensitive_heritage_not_eligible_for_public_revenue_funnel"
    assert body["revenue_attributable"] is False


def test_payment_confirmation_is_rejected_without_transaction_proof():
    response = client.post(
        "/cea/heritage/event/track",
        json={
            "session_id": "sess-pay-no-proof",
            "lead_id": "lead-pay-no-proof",
            "content_id": "VODUN-KAKPO-001",
            "source_campaign": "griot-capsule-01",
            "narrative_source": "griot/capsule-01",
            "event_type": "PAYMENT_CONFIRMED",
            "heritage_sensitivity": "PUBLIC_N0",
            "consent_contact": True,
            "economic_value_usd": 600,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] is False
    assert body["reason"] == "payment_proof_required"
    assert body["revenue_attributable"] is False


def test_verified_payment_creates_evidence_and_paid_crm_transition():
    response = client.post(
        "/cea/heritage/event/track",
        json={
            "session_id": "sess-pay-proof",
            "lead_id": "lead-heritage-paid-001",
            "content_id": "VODUN-KAKPO-001",
            "source_campaign": "griot-capsule-01",
            "narrative_source": "griot/capsule-01",
            "event_type": "PAYMENT_CONFIRMED",
            "heritage_sensitivity": "PUBLIC_N0",
            "consent_contact": True,
            "proof_ref": "payment://transaction/cea-600-001",
            "economic_value_usd": 600,
            "occurred_at": "2026-09-25T17:10:00Z",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] is True
    assert body["attribution_level"] == "ATTRIBUTED"
    assert body["revenue_attributable"] is True
    assert body["revenue_attributed_usd"] == 600
    assert body["payment_evidence"]["evidence_type"] == "payment_proof"
    assert body["crm_application"]["applied"] is True
    assert body["crm_application"]["status"] == "Payé"


def test_same_heritage_event_is_idempotent_for_same_explicit_timestamp():
    payload = {
        "session_id": "sess-idempotent-001",
        "content_id": "VODUN-KAKPO-001",
        "source_campaign": "griot-capsule-01",
        "narrative_source": "griot/capsule-01",
        "event_type": "CTA_CLICK",
        "heritage_sensitivity": "PUBLIC_N0",
        "occurred_at": "2026-09-25T17:11:00Z",
    }
    first = client.post("/cea/heritage/event/track", json=payload)
    second = client.post("/cea/heritage/event/track", json=payload)
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["event_id"] == second.json()["event_id"]
    assert first.json()["attribution_level"] == "OBSERVED"
