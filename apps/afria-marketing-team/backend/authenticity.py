from typing import Literal
from pydantic import BaseModel, Field

PARENT_ASSET_ID = "PRD-MKT-TEAM-001"
CAPABILITY = "Human Signal & Authenticity Gate™"
MODEL_VERSION = "HSAG-1.0"


class AuthenticityAssessment(BaseModel):
    platform: Literal["linkedin", "youtube", "substack", "web", "other"]
    originality_score: float = Field(ge=0, le=100)
    evidence_score: float = Field(ge=0, le=100)
    specificity_score: float = Field(ge=0, le=100)
    human_contribution_score: float = Field(ge=0, le=100)
    information_density_score: float = Field(ge=0, le=100)
    generic_language_risk: float = Field(ge=0, le=100)
    verified_evidence_count: int = Field(default=0, ge=0)
    human_reviewed: bool = False


class AuthenticityResult(BaseModel):
    parent_asset_id: str = PARENT_ASSET_ID
    capability: str = CAPABILITY
    model_version: str = MODEL_VERSION
    new_product_created: bool = False
    platform: str
    quality_score: float
    risk_adjusted_score: float
    decision: Literal["pass", "revise", "block"]
    reasons: list[str]
    send_allowed: bool = False
    human_send_approval_required: bool = True


def assess_authenticity(payload: AuthenticityAssessment) -> AuthenticityResult:
    quality_score = round(
        (
            payload.originality_score
            + payload.evidence_score
            + payload.specificity_score
            + payload.human_contribution_score
            + payload.information_density_score
        )
        / 5,
        2,
    )
    risk_adjusted_score = round(max(0.0, quality_score - payload.generic_language_risk * 0.25), 2)

    reasons: list[str] = []
    if payload.verified_evidence_count == 0:
        reasons.append("Verified evidence is required before publication.")
    if payload.generic_language_risk >= 75:
        reasons.append("Generic or templated language risk is too high.")
    if payload.evidence_score < 60:
        reasons.append("Evidence density is below the publication threshold.")
    if payload.human_contribution_score < 60:
        reasons.append("Human contribution is not sufficiently visible.")
    if not payload.human_reviewed:
        reasons.append("Human review is required before publication.")

    if payload.verified_evidence_count == 0 or payload.generic_language_risk >= 75 or risk_adjusted_score < 45:
        decision: Literal["pass", "revise", "block"] = "block"
    elif risk_adjusted_score < 75 or payload.evidence_score < 60 or payload.human_contribution_score < 60 or not payload.human_reviewed:
        decision = "revise"
    else:
        decision = "pass"
        reasons.append("Content clears the authenticity quality threshold; SEND still requires the existing S7+ human gate.")

    return AuthenticityResult(
        platform=payload.platform,
        quality_score=quality_score,
        risk_adjusted_score=risk_adjusted_score,
        decision=decision,
        reasons=reasons,
    )
