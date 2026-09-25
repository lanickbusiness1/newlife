import hashlib
import json
from datetime import datetime, timezone
from typing import Literal
from urllib.parse import quote

from fastapi import FastAPI
from pydantic import BaseModel, Field

from authenticity import AuthenticityAssessment, assess_authenticity
from visibility import VisibilityAssessment, assess_visibility
from cea_return import CeaReturnLeadInput, HeritageAttributionEvent, qualify_cea_return_lead, normalize_heritage_event
from notion_crm import CeaCrmLead, NotionCrmAdapter, NotionCrmConfig

PRODUCT_STANDARD = "Production Product"
ASSET_ID = "PRD-MKT-TEAM-001"
PRODUCTION_REVENUE_READY = False
SENSITIVE = {"SEND", "PAY", "DELETE", "EXPORT"}

CRM_PROOF_REQUIREMENTS = {
    "Message envoyé": "send_proof",
    "Réponse reçue": "reply_proof",
    "Diagnostic réservé": "diagnostic_proof",
    "Proposition envoyée": "proposal_proof",
    "Paiement demandé": "payment_request_proof",
    "Payé": "payment_proof",
}

EVIDENCE_TO_STATUS = {
    "send_proof": "Message envoyé",
    "reply_proof": "Réponse reçue",
    "diagnostic_proof": "Diagnostic réservé",
    "proposal_proof": "Proposition envoyée",
    "payment_request_proof": "Paiement demandé",
    "payment_proof": "Payé",
}

CHANNEL_ACTION_TO_EVENT = {
    "send_message": "message_sent",
    "capture_reply": "reply_received",
    "reserve_diagnostic": "diagnostic_reserved",
    "send_proposal": "proposal_sent",
    "request_payment": "payment_requested",
    "confirm_payment": "payment_received",
}

CHANNEL_EVENT_TO_EVIDENCE = {
    "message_sent": "send_proof",
    "reply_received": "reply_proof",
    "diagnostic_reserved": "diagnostic_proof",
    "proposal_sent": "proposal_proof",
    "payment_requested": "payment_request_proof",
    "payment_received": "payment_proof",
}

CHANNEL_PROOF_CONNECTOR = "Channel Proof Connector Layer™"
CASH_AUTOPILOT_LAYER = "Cash Autopilot Finalization Layer™"

OUTBOUND_EVIDENCE_LEDGER: dict[str, dict] = {}
CRM_STATUS_STORE: dict[str, dict] = {}
CASH_AUTOPILOT_RUNS: list[dict] = []

app = FastAPI(title="AfrIA Marketing Team Production Product", version="1.4.0")


class ProductIntake(BaseModel):
    product_name: str = Field(min_length=1)
    offer: str = Field(min_length=1)
    country: str = Field(min_length=1)
    buyer_role: str = Field(min_length=1)
    objective: str = Field(min_length=1)


class PolicyRequest(BaseModel):
    capability: Literal["READ", "GENERATE", "PROPOSE", "WRITE", "SEND", "PAY", "DELETE", "EXPORT"]
    human_approved: bool = False
    kill_switch_active: bool = False


class EvidenceRequest(BaseModel):
    asset_id: str
    product_standard: str
    production_revenue_ready: bool


class OutboundEvidenceRequest(BaseModel):
    lead_id: str = Field(min_length=1)
    lead_name: str | None = None
    channel: Literal["WhatsApp", "Email", "LinkedIn", "Payment", "Manual"]
    evidence_type: Literal[
        "send_proof",
        "reply_proof",
        "diagnostic_proof",
        "proposal_proof",
        "payment_request_proof",
        "payment_proof",
    ]
    proof_ref: str = Field(min_length=1)
    source: str = Field(min_length=1)
    occurred_at: str | None = None
    note: str | None = None


class CrmTransitionRequest(BaseModel):
    lead_id: str = Field(min_length=1)
    from_status: str = Field(min_length=1)
    to_status: str = Field(min_length=1)
    evidence_ids: list[str] = Field(default_factory=list)


class CrmStatusApplyRequest(BaseModel):
    lead_id: str = Field(min_length=1)
    from_status: str = Field(min_length=1)
    to_status: str = Field(min_length=1)
    evidence_ids: list[str] = Field(default_factory=list)


class ChannelActivationRequest(BaseModel):
    channel: Literal["WhatsApp", "Email", "LinkedIn", "Payment"]
    connected: bool
    requested_action: str = Field(min_length=1)


class ChannelProofDraftRequest(BaseModel):
    lead_id: str = Field(min_length=1)
    lead_name: str | None = None
    channel: Literal["WhatsApp", "Email", "LinkedIn", "Payment"]
    action: Literal[
        "send_message",
        "capture_reply",
        "reserve_diagnostic",
        "send_proposal",
        "request_payment",
        "confirm_payment",
    ]
    contact_ref: str | None = None
    message: str | None = None
    amount: int | None = None
    currency: str | None = None


class ChannelProofEventRequest(BaseModel):
    lead_id: str = Field(min_length=1)
    lead_name: str | None = None
    channel: Literal["WhatsApp", "Email", "LinkedIn", "Payment"]
    event_type: Literal[
        "message_sent",
        "reply_received",
        "diagnostic_reserved",
        "proposal_sent",
        "payment_requested",
        "payment_received",
    ]
    proof_ref: str = Field(min_length=1)
    source: str = Field(min_length=1)
    occurred_at: str | None = None
    note: str | None = None


class CashAutopilotEvent(BaseModel):
    lead_id: str = Field(min_length=1)
    lead_name: str | None = None
    from_status: str = "À contacter"
    channel: Literal["WhatsApp", "Email", "LinkedIn", "Payment"]
    event_type: Literal[
        "message_sent",
        "reply_received",
        "diagnostic_reserved",
        "proposal_sent",
        "payment_requested",
        "payment_received",
    ]
    proof_ref: str = Field(min_length=1)
    source: str = Field(min_length=1)
    occurred_at: str | None = None
    note: str | None = None


class CashAutopilotRunRequest(BaseModel):
    run_id: str = Field(min_length=1)
    events: list[CashAutopilotEvent] = Field(default_factory=list)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _canonical_digest(payload: dict) -> str:
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _build_evidence_id(payload: dict) -> str:
    return f"OEG-EVID-{_canonical_digest(payload)[:16].upper()}"


def _digits_only(value: str | None) -> str:
    return "".join(character for character in (value or "") if character.isdigit())


def _draft_url(payload: ChannelProofDraftRequest) -> str | None:
    message = quote(payload.message or "")
    if payload.channel == "WhatsApp":
        phone = _digits_only(payload.contact_ref)
        return f"https://wa.me/{phone}?text={message}" if phone else None
    if payload.channel == "Email":
        contact = payload.contact_ref or ""
        return f"mailto:{contact}?subject={quote('AfrIA Marketing Team™')}&body={message}"
    if payload.channel == "LinkedIn":
        return payload.contact_ref
    if payload.channel == "Payment":
        amount = payload.amount or 0
        currency = payload.currency or "FCFA"
        return f"payment://request?lead_id={quote(payload.lead_id)}&amount={amount}&currency={quote(currency)}"
    return None


def _store_outbound_evidence(payload: OutboundEvidenceRequest, connector_layer: str | None = None) -> dict:
    evidence_payload = {
        "asset_id": ASSET_ID,
        "lead_id": payload.lead_id,
        "lead_name": payload.lead_name,
        "channel": payload.channel,
        "evidence_type": payload.evidence_type,
        "proof_ref": payload.proof_ref,
        "source": payload.source,
        "occurred_at": payload.occurred_at or _now_iso(),
        "note": payload.note,
    }
    evidence_id = _build_evidence_id(evidence_payload)
    record = {
        **evidence_payload,
        "evidence_id": evidence_id,
        "digest": _canonical_digest(evidence_payload),
        "accepted": True,
        "crm_transition_enabled": EVIDENCE_TO_STATUS[payload.evidence_type],
    }
    if connector_layer:
        record["connector_layer"] = connector_layer
    OUTBOUND_EVIDENCE_LEDGER[evidence_id] = record
    return record


def _validate_crm_transition(payload: CrmTransitionRequest) -> dict:
    required_type = CRM_PROOF_REQUIREMENTS.get(payload.to_status)
    if required_type is None:
        return {
            "allowed": True,
            "reason": "no_proof_required_for_target_status",
            "lead_id": payload.lead_id,
            "from_status": payload.from_status,
            "to_status": payload.to_status,
            "required_evidence_type": None,
        }

    matching_evidence = [
        OUTBOUND_EVIDENCE_LEDGER[evidence_id]
        for evidence_id in payload.evidence_ids
        if evidence_id in OUTBOUND_EVIDENCE_LEDGER
        and OUTBOUND_EVIDENCE_LEDGER[evidence_id]["lead_id"] == payload.lead_id
        and OUTBOUND_EVIDENCE_LEDGER[evidence_id]["evidence_type"] == required_type
    ]

    if not matching_evidence:
        return {
            "allowed": False,
            "reason": "proof_required_before_status_change",
            "lead_id": payload.lead_id,
            "from_status": payload.from_status,
            "to_status": payload.to_status,
            "required_evidence_type": required_type,
            "accepted_evidence_ids": [],
        }

    return {
        "allowed": True,
        "reason": "proof_verified",
        "lead_id": payload.lead_id,
        "from_status": payload.from_status,
        "to_status": payload.to_status,
        "required_evidence_type": required_type,
        "accepted_evidence_ids": [evidence["evidence_id"] for evidence in matching_evidence],
    }


def _apply_crm_status(payload: CrmStatusApplyRequest) -> dict:
    transition = _validate_crm_transition(
        CrmTransitionRequest(
            lead_id=payload.lead_id,
            from_status=payload.from_status,
            to_status=payload.to_status,
            evidence_ids=payload.evidence_ids,
        )
    )
    if not transition["allowed"]:
        current = CRM_STATUS_STORE.get(payload.lead_id, {"status": payload.from_status})
        return {
            "layer": CASH_AUTOPILOT_LAYER,
            "applied": False,
            "product_blocker": False,
            "lead_id": payload.lead_id,
            "status": current["status"],
            "transition": transition,
            "accepted_evidence_ids": [],
            "rule": "status not applied without matching proof",
        }

    history_item = {
        "from_status": payload.from_status,
        "to_status": payload.to_status,
        "evidence_ids": transition.get("accepted_evidence_ids", []),
        "applied_at": _now_iso(),
    }
    previous = CRM_STATUS_STORE.get(payload.lead_id, {"history": []})
    CRM_STATUS_STORE[payload.lead_id] = {
        "lead_id": payload.lead_id,
        "status": payload.to_status,
        "updated_at": history_item["applied_at"],
        "evidence_ids": transition.get("accepted_evidence_ids", []),
        "history": [*previous.get("history", []), history_item],
    }
    return {
        "layer": CASH_AUTOPILOT_LAYER,
        "applied": True,
        "product_blocker": False,
        "lead_id": payload.lead_id,
        "status": payload.to_status,
        "transition": transition,
        "accepted_evidence_ids": transition.get("accepted_evidence_ids", []),
        "rule": "status applied only after proof verification",
    }


@app.get("/health")
def health():
    return {
        "service": "afria-marketing-team-production",
        "asset_id": ASSET_ID,
        "product_standard": PRODUCT_STANDARD,
        "production_revenue_ready": PRODUCTION_REVENUE_READY,
        "literal": "PRODUCTION_REVENUE_READY=false",
        "gates": ["S7+", "M6", "CyberAudit", "M8", "Big4", "Outbound Evidence Gate™", CHANNEL_PROOF_CONNECTOR, CASH_AUTOPILOT_LAYER, "CEA Heritage Revenue Loop™"],
    }


@app.post("/product/intake")
def product_intake(payload: ProductIntake):
    return {
        "product_object": {
            "asset_id": ASSET_ID,
            "name": payload.product_name,
            "offer": payload.offer,
            "country": payload.country,
            "buyer_role": payload.buyer_role,
            "objective": payload.objective,
            "missing_data_policy": "mark_missing_never_invent",
        },
        "icp_seed": f"{payload.buyer_role} au {payload.country}",
        "status": "normalized",
    }


@app.post("/policy/simulate")
def policy_simulate(payload: PolicyRequest):
    if payload.kill_switch_active:
        return {"state": "blocked", "reason": "kill switch active", "human_approval_required": False}
    if payload.capability in SENSITIVE and not payload.human_approved:
        return {"state": "needs_human", "reason": f"{payload.capability}: human approval required before execution", "human_approval_required": True}
    return {"state": "allowed", "reason": f"{payload.capability}: allowed by policy simulation", "human_approval_required": False}


@app.post("/visibility/assess")
def visibility_assess(payload: VisibilityAssessment):
    return assess_visibility(payload)


@app.post("/content/authenticity/assess")
def content_authenticity_assess(payload: AuthenticityAssessment):
    return assess_authenticity(payload)


@app.post("/export/evidence")
def export_evidence(payload: EvidenceRequest):
    valid = payload.asset_id == ASSET_ID and payload.product_standard == PRODUCT_STANDARD and payload.production_revenue_ready is False
    return {"valid": valid, "asset_id": payload.asset_id, "production_revenue_ready": payload.production_revenue_ready}


@app.post("/outbound/evidence")
def ingest_outbound_evidence(payload: OutboundEvidenceRequest):
    return _store_outbound_evidence(payload)


@app.post("/crm/transition/validate")
def validate_crm_transition(payload: CrmTransitionRequest):
    return _validate_crm_transition(payload)


@app.post("/crm/status/apply")
def apply_crm_status(payload: CrmStatusApplyRequest):
    return _apply_crm_status(payload)


@app.post("/channel/activation/classify")
def classify_channel_activation(payload: ChannelActivationRequest):
    if payload.connected:
        return {
            "classification": "connected_channel",
            "product_blocker": False,
            "channel": payload.channel,
            "requested_action": payload.requested_action,
            "next_action": "execute_with_policy_and_capture_proof",
        }

    return {
        "classification": "activation_channel",
        "product_blocker": False,
        "channel": payload.channel,
        "requested_action": payload.requested_action,
        "next_action": "prepare_draft_and_capture_external_proof",
        "rule": "canal externe non connecté = activation canal, pas blocage produit",
    }


@app.post("/channel/proof/draft")
def draft_channel_proof(payload: ChannelProofDraftRequest):
    event_type = CHANNEL_ACTION_TO_EVENT[payload.action]
    evidence_type = CHANNEL_EVENT_TO_EVIDENCE[event_type]
    return {
        "connector_layer": CHANNEL_PROOF_CONNECTOR,
        "prepared": True,
        "sent": False,
        "product_blocker": False,
        "classification": "activation_channel",
        "channel": payload.channel,
        "lead_id": payload.lead_id,
        "lead_name": payload.lead_name,
        "action": payload.action,
        "event_type": event_type,
        "proof_required": evidence_type,
        "next_status": EVIDENCE_TO_STATUS[evidence_type],
        "send_url": _draft_url(payload),
        "message": payload.message,
        "evidence_submission_target": "/outbound/evidence",
        "rule": "draft prepared only; CRM status cannot advance until proof is ingested",
    }


@app.post("/channel/proof/normalize")
def normalize_channel_proof(payload: ChannelProofEventRequest):
    evidence_type = CHANNEL_EVENT_TO_EVIDENCE[payload.event_type]
    evidence_payload = OutboundEvidenceRequest(
        lead_id=payload.lead_id,
        lead_name=payload.lead_name,
        channel=payload.channel,
        evidence_type=evidence_type,
        proof_ref=payload.proof_ref,
        source=payload.source,
        occurred_at=payload.occurred_at,
        note=payload.note,
    )
    record = _store_outbound_evidence(evidence_payload, connector_layer=CHANNEL_PROOF_CONNECTOR)
    return {
        **record,
        "event_type": payload.event_type,
        "transition_validation_target": "/crm/transition/validate",
    }


@app.post("/cash/autopilot/run")
def run_cash_autopilot(payload: CashAutopilotRunRequest):
    results = []
    payments_verified = 0
    for event in payload.events:
        evidence = normalize_channel_proof(
            ChannelProofEventRequest(
                lead_id=event.lead_id,
                lead_name=event.lead_name,
                channel=event.channel,
                event_type=event.event_type,
                proof_ref=event.proof_ref,
                source=event.source,
                occurred_at=event.occurred_at,
                note=event.note,
            )
        )
        target_status = evidence["crm_transition_enabled"]
        application = _apply_crm_status(
            CrmStatusApplyRequest(
                lead_id=event.lead_id,
                from_status=event.from_status,
                to_status=target_status,
                evidence_ids=[evidence["evidence_id"]],
            )
        )
        if evidence["evidence_type"] == "payment_proof" and application["applied"]:
            payments_verified += 1
        results.append({"event": event.model_dump(), "evidence": evidence, "application": application})

    applied_transitions = sum(1 for result in results if result["application"]["applied"])
    run_record = {
        "layer": CASH_AUTOPILOT_LAYER,
        "run_id": payload.run_id,
        "processed_events": len(payload.events),
        "applied_transitions": applied_transitions,
        "payments_verified": payments_verified,
        "cash_status": "CASH_PROOF_FOUND" if payments_verified else "NO_VERIFIED_CASH_YET",
        "product_blocker": False,
        "results": results,
        "executed_at": _now_iso(),
    }
    CASH_AUTOPILOT_RUNS.append(run_record)
    return run_record


@app.get("/cash/autopilot/report")
def cash_autopilot_report():
    payments_verified = sum(1 for evidence in OUTBOUND_EVIDENCE_LEDGER.values() if evidence["evidence_type"] == "payment_proof")
    return {
        "layer": CASH_AUTOPILOT_LAYER,
        "asset_id": ASSET_ID,
        "product_standard": PRODUCT_STANDARD,
        "evidence_count": len(OUTBOUND_EVIDENCE_LEDGER),
        "crm_status_count": len(CRM_STATUS_STORE),
        "payments_verified": payments_verified,
        "cash_status": "CASH_PROOF_FOUND" if payments_verified else "NO_VERIFIED_CASH_YET",
        "product_blocker": False,
        "non_blocking_gap_types": ["activation_channel", "external_live_proof_required"],
        "last_run_id": CASH_AUTOPILOT_RUNS[-1]["run_id"] if CASH_AUTOPILOT_RUNS else None,
        "next_action": "connect_live_channel_proofs_and_verified_payment",
        "rule": "report reflects verified evidence only; no false CRM advancement",
    }


@app.get("/cash/finalization/check")
def cash_finalization_check():
    payments_verified = sum(1 for evidence in OUTBOUND_EVIDENCE_LEDGER.values() if evidence["evidence_type"] == "payment_proof")
    return {
        "layer": CASH_AUTOPILOT_LAYER,
        "asset_id": ASSET_ID,
        "core_product_finalized": True,
        "core_loop": "channel_event_to_evidence_to_crm_status_to_cash_report",
        "requires_live_channel_proof_for_commercial_finalization": True,
        "commercial_live_cash_verified": payments_verified > 0,
        "product_blocker": False,
        "activation_not_blocker": True,
        "next_frontier": "connect_live_channel_proofs_and_verified_payment",
        "finalization_boundary": "product core finalized; commercial live finalization depends on external proof adapters and verified payment",
    }



@app.post("/cea/lead/qualify")
def qualify_cea_lead(payload: CeaReturnLeadInput):
    return qualify_cea_return_lead(payload)


@app.post("/cea/heritage/event/track")
def track_cea_heritage_event(payload: HeritageAttributionEvent):
    record = normalize_heritage_event(payload)
    if not record["accepted"]:
        return record

    if payload.event_type != "PAYMENT_CONFIRMED":
        return record

    evidence_payload = OutboundEvidenceRequest(
        lead_id=payload.lead_id or "",
        channel="Payment",
        evidence_type="payment_proof",
        proof_ref=payload.proof_ref or "",
        source=payload.source_campaign,
        occurred_at=payload.occurred_at,
        note=(
            f"heritage_content_id={payload.content_id}; "
            f"narrative_source={payload.narrative_source}; "
            f"economic_value_usd={payload.economic_value_usd}"
        ),
    )
    payment_evidence = _store_outbound_evidence(
        evidence_payload,
        connector_layer="CEA Heritage Revenue Loop™",
    )
    crm_application = _apply_crm_status(
        CrmStatusApplyRequest(
            lead_id=payload.lead_id or "",
            from_status="Paiement demandé",
            to_status="Payé",
            evidence_ids=[payment_evidence["evidence_id"]],
        )
    )
    return {
        **record,
        "payment_evidence": payment_evidence,
        "crm_application": crm_application,
        "revenue_attributed_usd": payload.economic_value_usd,
        "verification_boundary": "STAGING_PROOF_GATED_ONLY",
        "production_revenue_ready": PRODUCTION_REVENUE_READY,
        "revenue_rule": "staging attribution requires payment proof reference; production cash remains false until an authorized payment adapter verifies live settlement",
    }



@app.post("/cea/crm/lead/persist")
def persist_cea_crm_lead(payload: CeaCrmLead):
    config = NotionCrmConfig.from_env()
    if config is None:
        return {
            "persisted": False,
            "classification": "activation_channel",
            "product_blocker": False,
            "lead_id": payload.lead_id,
            "reason": "notion_crm_credentials_not_configured",
            "next_action": "configure_NOTION_CRM_TOKEN_in_deployment_secret_store",
            "data_source_id": "bf3a6c6b-4304-4a2c-a96d-0b788dc08600",
        }

    try:
        return {
            **NotionCrmAdapter(config).create_lead(payload),
            "classification": "connected_persistent_crm",
            "product_blocker": False,
        }
    except Exception as exc:
        return {
            "persisted": False,
            "classification": "external_adapter_error",
            "product_blocker": False,
            "lead_id": payload.lead_id,
            "reason": "notion_crm_write_failed",
            "error_type": type(exc).__name__,
            "next_action": "inspect_adapter_evidence_without_exposing_secrets",
            "data_source_id": config.data_source_id,
        }
