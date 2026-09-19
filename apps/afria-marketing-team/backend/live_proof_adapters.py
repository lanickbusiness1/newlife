import hashlib
import json
from datetime import datetime, timezone
from typing import Any

LIVE_PROOF_LAYER = "Live Proof Adapter Layer™"
ASSET_ID = "PRD-MKT-TEAM-001"

EVENT_TO_EVIDENCE = {
    "message_sent": "send_proof",
    "reply_received": "reply_proof",
    "diagnostic_reserved": "diagnostic_proof",
    "proposal_sent": "proposal_proof",
    "payment_requested": "payment_request_proof",
    "payment_received": "payment_proof",
}

EVIDENCE_TO_STATUS = {
    "send_proof": "Message envoyé",
    "reply_proof": "Réponse reçue",
    "diagnostic_proof": "Diagnostic réservé",
    "proposal_proof": "Proposition envoyée",
    "payment_request_proof": "Paiement demandé",
    "payment_proof": "Payé",
}

CONTROLLED_MANUAL_ADAPTERS = {"WhatsAppManual", "LinkedInManual", "PaymentManual"}
CONNECTED_ADAPTERS = {"Gmail", "Email", "Payment"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _digest(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _evidence_id(payload: dict[str, Any]) -> str:
    return f"OEG-EVID-{_digest(payload)[:16].upper()}"


def normalize_live_proof(event: dict[str, Any]) -> dict[str, Any]:
    event_type = event["event_type"]
    if event_type not in EVENT_TO_EVIDENCE:
        raise ValueError(f"unsupported live proof event: {event_type}")

    adapter = event["adapter"]
    evidence_type = EVENT_TO_EVIDENCE[event_type]
    evidence_payload = {
        "asset_id": ASSET_ID,
        "adapter": adapter,
        "lead_id": event["lead_id"],
        "lead_name": event.get("lead_name"),
        "event_type": event_type,
        "evidence_type": evidence_type,
        "external_ref": event["external_ref"],
        "source": event["source"],
        "occurred_at": event.get("occurred_at") or _now_iso(),
        "amount": event.get("amount"),
        "currency": event.get("currency"),
        "note": event.get("note"),
    }
    return {
        **evidence_payload,
        "live_proof_layer": LIVE_PROOF_LAYER,
        "accepted": True,
        "manual_controlled": adapter in CONTROLLED_MANUAL_ADAPTERS,
        "connected_adapter": adapter in CONNECTED_ADAPTERS,
        "evidence_id": _evidence_id(evidence_payload),
        "digest": _digest(evidence_payload),
        "crm_transition_enabled": EVIDENCE_TO_STATUS[evidence_type],
        "rule": "live proof accepted only from external_ref; no fabricated send/payment status",
    }


def adapter_status(payload: dict[str, Any]) -> dict[str, Any]:
    connected = bool(payload.get("connected"))
    adapter = payload["adapter"]
    return {
        "live_proof_layer": LIVE_PROOF_LAYER,
        "adapter": adapter,
        "connected": connected,
        "requested_event": payload.get("requested_event"),
        "classification": "connected_channel" if connected else "activation_channel",
        "product_blocker": False,
        "proof_capture_mode": "api_or_connector_event" if connected else "manual_controlled_until_api_available",
        "next_action": "normalize_external_event" if connected else "capture_external_ref_and_manual_controlled_proof",
        "rule": "unconnected channel = activation channel, not product blocker",
    }


def summarize_live_proof_status(evidence_records: list[dict[str, Any]]) -> dict[str, Any]:
    payment_records = [
        record for record in evidence_records
        if record.get("evidence_type") == "payment_proof" and record.get("accepted") is True
    ]
    verified_cash_amount = sum(int(record.get("amount") or 0) for record in payment_records)
    return {
        "live_proof_layer": LIVE_PROOF_LAYER,
        "evidence_count": len(evidence_records),
        "verified_payments": len(payment_records),
        "verified_cash_amount": verified_cash_amount,
        "currency": payment_records[-1].get("currency") if payment_records else None,
        "commercial_live_cash_verified": bool(payment_records),
        "product_blocker": False,
        "non_blocking_gaps": ["activation_channel", "external_live_proof_required"],
        "next_action": "connect_or_capture_first_real_external_proof",
        "rule": "cash is verified only from payment_proof records",
    }
