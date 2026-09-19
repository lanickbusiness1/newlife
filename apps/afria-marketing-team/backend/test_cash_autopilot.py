from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_crm_status_apply_refuses_status_without_matching_proof():
    response = client.post("/crm/status/apply", json={
        "lead_id": "final-no-proof",
        "from_status": "À contacter",
        "to_status": "Message envoyé",
        "evidence_ids": []
    })

    assert response.status_code == 200
    body = response.json()
    assert body["applied"] is False
    assert body["transition"]["allowed"] is False
    assert body["status"] == "À contacter"
    assert body["product_blocker"] is False


def test_crm_status_apply_updates_status_with_matching_proof():
    evidence = client.post("/channel/proof/normalize", json={
        "lead_id": "final-sent-proof",
        "lead_name": "Prospect final",
        "channel": "WhatsApp",
        "event_type": "message_sent",
        "proof_ref": "wa://message/final-001",
        "source": "manual_whatsapp_export"
    }).json()

    response = client.post("/crm/status/apply", json={
        "lead_id": "final-sent-proof",
        "from_status": "À contacter",
        "to_status": "Message envoyé",
        "evidence_ids": [evidence["evidence_id"]]
    })

    assert response.status_code == 200
    body = response.json()
    assert body["applied"] is True
    assert body["status"] == "Message envoyé"
    assert body["accepted_evidence_ids"] == [evidence["evidence_id"]]


def test_cash_autopilot_run_closes_event_to_status_loop():
    response = client.post("/cash/autopilot/run", json={
        "run_id": "cash-run-final-001",
        "events": [
            {
                "lead_id": "cash-loop-001",
                "lead_name": "PME payante",
                "from_status": "Paiement demandé",
                "channel": "Payment",
                "event_type": "payment_received",
                "proof_ref": "payment://tx/final-49900",
                "source": "payment_manual_proof"
            },
            {
                "lead_id": "cash-loop-002",
                "lead_name": "Cabinet conseil",
                "from_status": "À contacter",
                "channel": "Email",
                "event_type": "message_sent",
                "proof_ref": "email://sent/final-002",
                "source": "gmail_connector"
            }
        ]
    })

    assert response.status_code == 200
    body = response.json()
    assert body["run_id"] == "cash-run-final-001"
    assert body["processed_events"] == 2
    assert body["applied_transitions"] == 2
    assert body["payments_verified"] == 1
    assert body["cash_status"] == "CASH_PROOF_FOUND"
    assert body["product_blocker"] is False


def test_cash_autopilot_report_exposes_cash_and_evidence_state():
    response = client.get("/cash/autopilot/report")

    assert response.status_code == 200
    body = response.json()
    assert body["asset_id"] == "PRD-MKT-TEAM-001"
    assert body["evidence_count"] >= 1
    assert body["product_blocker"] is False
    assert "activation_channel" in body["non_blocking_gap_types"]
    assert body["crm_status_count"] >= 1


def test_cash_finalization_check_confirms_core_complete_not_live_cash_complete():
    response = client.get("/cash/finalization/check")

    assert response.status_code == 200
    body = response.json()
    assert body["core_product_finalized"] is True
    assert body["requires_live_channel_proof_for_commercial_finalization"] is True
    assert body["product_blocker"] is False
    assert body["next_frontier"] == "connect_live_channel_proofs_and_verified_payment"
