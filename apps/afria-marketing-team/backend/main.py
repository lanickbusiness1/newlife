from typing import Literal
from fastapi import FastAPI
from pydantic import BaseModel, Field
from visibility import VisibilityAssessment, assess_visibility

PRODUCT_STANDARD = "Production Product"
ASSET_ID = "PRD-MKT-TEAM-001"
PRODUCTION_REVENUE_READY = False
SENSITIVE = {"SEND", "PAY", "DELETE", "EXPORT"}

app = FastAPI(title="AfrIA Marketing Team Production Product", version="1.0.0")

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

@app.get("/health")
def health():
    return {
        "service": "afria-marketing-team-production",
        "asset_id": ASSET_ID,
        "product_standard": PRODUCT_STANDARD,
        "production_revenue_ready": PRODUCTION_REVENUE_READY,
        "literal": "PRODUCTION_REVENUE_READY=false",
        "gates": ["S7+", "M6", "CyberAudit", "M8", "Big4"],
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

@app.post("/export/evidence")
def export_evidence(payload: EvidenceRequest):
    valid = payload.asset_id == ASSET_ID and payload.product_standard == PRODUCT_STANDARD and payload.production_revenue_ready is False
    return {"valid": valid, "asset_id": payload.asset_id, "production_revenue_ready": payload.production_revenue_ready}
