from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_live_gmail_sent_event_becomes_send_proof_and_message_sent():
    response = client.post("/live-proof/ingest", json={
        "adapter": "Gmail",
        "lead_id": "lead-gmail-001",
        "lead_name": "Cabinet conseil",
        "event_type": "message_sent",
        "external_ref": "gmail://sent/message-001",
        "source": "gmail_connector",
        "occurred_at": "2026-09-19T07:25:00Z"
    })
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] is True
    assert body["adapter"] == "Gmail"
    assert body["evidence_type"] == "send_proof"
    assert body["crm_transition_enabled"] == "Message envoyé"
    assert body["evidence_id"].startswith("OEG-EVID-")


def test_live_payment_confirmed_event_becomes_paid_with_amount():
    response = client.post("/live-proof/ingest", json={
        "adapter": "Payment",
        "lead_id": "lead-pay-live-001",
        "lead_name": "PME payante",
        "event_type": "payment_received",
        "external_ref": "payment://transaction/live-49900",
        "source": "payment_provider_or_manual_receipt",
        "amount": 49900,
        "currency": "FCFA"
    })
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] is True
    assert body["evidence_type"] == "payment_proof"
    assert body["crm_transition_enabled"] == "Payé"
    assert body["amount"] == 49900
    assert body["currency"] == "FCFA"


def test_manual_whatsapp_proof_is_controlled_not_fabricated():
    response = client.post("/live-proof/ingest", json={
        "adapter": "WhatsAppManual",
        "lead_id": "lead-wa-001",
        "lead_name": "Prospect école",
        "event_type": "reply_received",
        "external_ref": "manual://screenshot/whatsapp-reply-001",
        "source": "manual_screenshot_controlled",
        "note": "Captured from WhatsApp Business screenshot"
    })
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] is True
    assert body["manual_controlled"] is True
    assert body["evidence_type"] == "reply_proof"
    assert body["crm_transition_enabled"] == "Réponse reçue"


def test_unconnected_live_adapter_is_activation_not_product_blocker():
    response = client.post("/live-proof/adapter/status", json={
        "adapter": "LinkedInManual",
        "connected": False,
        "requested_event": "message_sent"
    })
    assert response.status_code == 200
    body = response.json()
    assert body["classification"] == "activation_channel"
    assert body["product_blocker"] is False
    assert body["proof_capture_mode"] == "manual_controlled_until_api_available"


def test_live_proof_status_summarizes_verified_cash_and_activation_gaps():
    payment = client.post("/live-proof/ingest", json={
        "adapter": "Payment",
        "lead_id": "lead-live-summary-001",
        "event_type": "payment_received",
        "external_ref": "payment://transaction/live-summary-49900",
        "source": "payment_provider_or_manual_receipt",
        "amount": 49900,
        "currency": "FCFA"
    }).json()
    client.post("/crm/status/apply", json={
        "lead_id": "lead-live-summary-001",
        "from_status": "Paiement demandé",
        "to_status": "Payé",
        "evidence_ids": [payment["evidence_id"]]
    })

    response = client.get("/live-proof/status")
    assert response.status_code == 200
    body = response.json()
    assert body["live_proof_layer"] == "Live Proof Adapter Layer™"
    assert body["verified_payments"] >= 1
    assert body["verified_cash_amount"] >= 49900
    assert "activation_channel" in body["non_blocking_gaps"]
