import hashlib
import json
from datetime import datetime, timezone
from typing import Literal
from fastapi import FastAPI
from pydantic import BaseModel, Field
from visibility import VisibilityAssessment, assess_visibility
from authenticity import AuthenticityAssessment, assess_authenticity

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

OUTBOUND_EVIDENCE_LEDGER: dict[str, dict] = {}

app = FastAPI(title="AfrIA Marketing Team Production Product", version="1.1.0")

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

class ChannelActivationRequest(BaseModel):
    channel: Literal["WhatsApp", "Email", "LinkedIn", "Payment"]
    connected: bool
    requested_action: str = Field(min_length=1)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _canonical_digest(payload: dict) -> str:
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _build_evidence_id(payload: dict) -> str:
    return f"OEG-EVID-{_canonical_digest(payload)[:16].upper()}"

@app.get("/health")
def health():
    return {
        "service": "afria-marketing-team-production",
        "asset_id": ASSET_ID,
        "product_standard": PRODUCT_STANDARD,
        "production_revenue_ready": PRODUCTION_REVENUE_READY,
        "literal": "PRODUCTION_REVENUE_READY=false",
        "gates": ["S7+", "M6", "CyberAudit", "M8", "Big4", "Outbound Evidence Gate™"],
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
    OUTBOUND_EVIDENCE_LEDGER[evidence_id] = {
        **evidence_payload,
        "evidence_id": evidence_id,
        "digest": _canonical_digest(evidence_payload),
        "accepted": True,
        "crm_transition_enabled": EVIDENCE_TO_STATUS[payload.evidence_type],
    }
    return OUTBOUND_EVIDENCE_LEDGER[evidence_id]

@app.post("/crm/transition/validate")
def validate_crm_transition(payload: CrmTransitionRequest):
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
