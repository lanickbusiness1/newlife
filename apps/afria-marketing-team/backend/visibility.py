from typing import Literal
from pydantic import BaseModel, Field

PARENT_ASSET_ID = "PRD-MKT-TEAM-001"
CAPABILITY = "AfrIA AI Visibility Intelligence™"
METRIC = "African Enterprise Visibility Gap™"
MISSING_DATA_POLICY = "mark_missing_never_invent"


class VisibilityAssessment(BaseModel):
    enterprise_name: str = Field(min_length=1)
    country: str = Field(min_length=1)
    verified_identity: bool = False
    verified_source_count: int = Field(default=0, ge=0)
    website_present: bool = False
    search_presence: float | None = Field(default=None, ge=0, le=100)
    ai_presence: float | None = Field(default=None, ge=0, le=100)
    media_presence: float | None = Field(default=None, ge=0, le=100)
    professional_presence: float | None = Field(default=None, ge=0, le=100)
    marketplace_presence: float | None = Field(default=None, ge=0, le=100)
    institutional_presence: float | None = Field(default=None, ge=0, le=100)
    investor_presence: float | None = Field(default=None, ge=0, le=100)


class VisibilityResult(BaseModel):
    parent_asset_id: str = PARENT_ASSET_ID
    capability: str = CAPABILITY
    metric: str = METRIC
    new_product_created: bool = False
    enterprise_name: str
    country: str
    visibility_score: float
    visibility_gap: float
    priority: Literal["critical", "high", "medium", "low"]
    confidence: Literal["high", "medium", "low"]
    observed_dimension_ratio: float
    missing_dimensions: list[str]
    recommended_actions: list[str]
    missing_data_policy: str = MISSING_DATA_POLICY


SCORE_WEIGHTS = {
    "verified_identity": 10.0,
    "verified_source_count": 5.0,
    "website_present": 5.0,
    "search_presence": 15.0,
    "ai_presence": 20.0,
    "media_presence": 10.0,
    "professional_presence": 10.0,
    "marketplace_presence": 10.0,
    "institutional_presence": 7.5,
    "investor_presence": 7.5,
}

OBSERVATION_FIELDS = [
    "search_presence",
    "ai_presence",
    "media_presence",
    "professional_presence",
    "marketplace_presence",
    "institutional_presence",
    "investor_presence",
]


def _score(payload: VisibilityAssessment) -> float:
    score = 0.0
    score += SCORE_WEIGHTS["verified_identity"] if payload.verified_identity else 0.0
    score += min(payload.verified_source_count, 5) / 5 * SCORE_WEIGHTS["verified_source_count"]
    score += SCORE_WEIGHTS["website_present"] if payload.website_present else 0.0
    for field in OBSERVATION_FIELDS:
        value = getattr(payload, field)
        normalized = 0.0 if value is None else value / 100
        score += normalized * SCORE_WEIGHTS[field]
    return round(score, 2)


def _priority(gap: float) -> Literal["critical", "high", "medium", "low"]:
    if gap >= 70:
        return "critical"
    if gap >= 50:
        return "high"
    if gap >= 30:
        return "medium"
    return "low"


def _confidence(payload: VisibilityAssessment) -> tuple[Literal["high", "medium", "low"], float, list[str]]:
    missing = [field for field in OBSERVATION_FIELDS if getattr(payload, field) is None]
    observed = len(OBSERVATION_FIELDS) - len(missing)
    ratio = round(observed / len(OBSERVATION_FIELDS), 2)
    if ratio >= 0.8:
        level: Literal["high", "medium", "low"] = "high"
    elif ratio >= 0.5:
        level = "medium"
    else:
        level = "low"
    return level, ratio, missing


def _actions(payload: VisibilityAssessment) -> list[str]:
    actions: list[tuple[float, str]] = []
    if not payload.verified_identity or payload.verified_source_count < 3:
        actions.append((15.0, "Renforcer l’Enterprise Visibility Profile™ avec identité et sources vérifiables."))
    if not payload.website_present:
        actions.append((5.0, "Créer ou vérifier le site canonique et les données structurées de l’entreprise."))

    channel_actions = {
        "search_presence": "Renforcer la découvrabilité Search/SEO avec pages canoniques, entités et preuves sourcées.",
        "ai_presence": "Renforcer la visibilité IA/AEO-GEO-LLMO avec faits structurés, citations et contenus répondant aux prompts acheteurs.",
        "media_presence": "Construire un media kit prouvé et des angles éditoriaux sans fabriquer de réputation.",
        "professional_presence": "Renforcer la présence sur les réseaux professionnels avec dirigeants, expertise et preuves commerciales.",
        "marketplace_presence": "Publier les offres vérifiées sur les marketplaces et répertoires sectoriels pertinents.",
        "institutional_presence": "Améliorer la présence dans les registres, annuaires et sources institutionnelles vérifiables.",
        "investor_presence": "Préparer un profil investisseur sourcé et les éléments de data room nécessaires à la découvrabilité financière.",
    }
    for field, action in channel_actions.items():
        value = getattr(payload, field)
        effective = 0.0 if value is None else value
        if effective < 50:
            deficit = SCORE_WEIGHTS[field] * (1 - effective / 100)
            actions.append((deficit, action))

    actions.sort(key=lambda item: item[0], reverse=True)
    return [text for _, text in actions[:5]]


def assess_visibility(payload: VisibilityAssessment) -> VisibilityResult:
    score = _score(payload)
    gap = round(100 - score, 2)
    confidence, observed_ratio, missing = _confidence(payload)
    return VisibilityResult(
        enterprise_name=payload.enterprise_name,
        country=payload.country,
        visibility_score=score,
        visibility_gap=gap,
        priority=_priority(gap),
        confidence=confidence,
        observed_dimension_ratio=observed_ratio,
        missing_dimensions=missing,
        recommended_actions=_actions(payload),
    )
