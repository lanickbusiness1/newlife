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


def test_outbound_evidence_ingest_returns_deterministic_evidence_id():
    response = client.post("/outbound/evidence", json={
        "lead_id": "lead-001",
        "lead_name": "Prospect école",
        "channel": "WhatsApp",
        "evidence_type": "send_proof",
        "proof_ref": "wa://message/abc-001",
        "source": "manual_export",
        "occurred_at": "2026-08-30T13:45:00Z"
    })
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] is True
    assert body["evidence_id"].startswith("OEG-EVID-")
    assert body["crm_transition_enabled"] == "Message envoyé"


def test_crm_transition_rejects_message_sent_without_send_proof():
    response = client.post("/crm/transition/validate", json={
        "lead_id": "lead-no-proof",
        "from_status": "À contacter",
        "to_status": "Message envoyé",
        "evidence_ids": []
    })
    assert response.status_code == 200
    body = response.json()
    assert body["allowed"] is False
    assert body["required_evidence_type"] == "send_proof"
    assert body["reason"] == "proof_required_before_status_change"


def test_crm_transition_allows_message_sent_with_send_proof():
    evidence = client.post("/outbound/evidence", json={
        "lead_id": "lead-002",
        "lead_name": "Prospect PME",
        "channel": "WhatsApp",
        "evidence_type": "send_proof",
        "proof_ref": "wa://message/abc-002",
        "source": "manual_export"
    }).json()

    response = client.post("/crm/transition/validate", json={
        "lead_id": "lead-002",
        "from_status": "À contacter",
        "to_status": "Message envoyé",
        "evidence_ids": [evidence["evidence_id"]]
    })
    assert response.status_code == 200
    body = response.json()
    assert body["allowed"] is True
    assert body["reason"] == "proof_verified"


def test_channel_unavailable_is_activation_not_product_blocker():
    response = client.post("/channel/activation/classify", json={
        "channel": "WhatsApp",
        "connected": False,
        "requested_action": "send_message"
    })
    assert response.status_code == 200
    body = response.json()
    assert body["classification"] == "activation_channel"
    assert body["product_blocker"] is False
    assert body["next_action"] == "prepare_draft_and_capture_external_proof"


def test_channel_proof_draft_builds_whatsapp_link_without_claiming_send():
    response = client.post("/channel/proof/draft", json={
        "lead_id": "lead-010",
        "lead_name": "Prospect école",
        "channel": "WhatsApp",
        "action": "send_message",
        "contact_ref": "+229 61 10 73 73",
        "message": "Bonjour, diagnostic express AfrIA Marketing Team™ ?"
    })
    assert response.status_code == 200
    body = response.json()
    assert body["prepared"] is True
    assert body["sent"] is False
    assert body["product_blocker"] is False
    assert body["proof_required"] == "send_proof"
    assert body["next_status"] == "Message envoyé"
    assert body["send_url"].startswith("https://wa.me/22961107373?text=")
    assert body["evidence_submission_target"] == "/outbound/evidence"


def test_channel_proof_normalizes_email_sent_event_into_evidence():
    response = client.post("/channel/proof/normalize", json={
        "lead_id": "lead-email-001",
        "lead_name": "Cabinet conseil",
        "channel": "Email",
        "event_type": "message_sent",
        "proof_ref": "email://sent/message-001",
        "source": "gmail_connector",
        "occurred_at": "2026-09-19T07:10:00Z"
    })
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] is True
    assert body["evidence_type"] == "send_proof"
    assert body["crm_transition_enabled"] == "Message envoyé"
    assert body["connector_layer"] == "Channel Proof Connector Layer™"


def test_channel_proof_normalizes_payment_received_event_to_paid_status():
    evidence = client.post("/channel/proof/normalize", json={
        "lead_id": "lead-pay-001",
        "lead_name": "PME payante",
        "channel": "Payment",
        "event_type": "payment_received",
        "proof_ref": "payment://transaction/tx-49900",
        "source": "payment_manual_proof"
    }).json()

    assert evidence["evidence_type"] == "payment_proof"
    assert evidence["crm_transition_enabled"] == "Payé"

    transition = client.post("/crm/transition/validate", json={
        "lead_id": "lead-pay-001",
        "from_status": "Paiement demandé",
        "to_status": "Payé",
        "evidence_ids": [evidence["evidence_id"]]
    })
    assert transition.status_code == 200
    assert transition.json()["allowed"] is True


def test_channel_proof_refuses_unknown_event_mapping():
    response = client.post("/channel/proof/normalize", json={
        "lead_id": "lead-unknown",
        "channel": "LinkedIn",
        "event_type": "profile_viewed",
        "proof_ref": "linkedin://event/001",
        "source": "manual"
    })
    assert response.status_code == 422
