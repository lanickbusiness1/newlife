import hashlib
import json
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field


CeaPrimaryIntent = Literal[
    "Identité",
    "Voyage",
    "Mémoire & Culture",
    "Installation",
    "Investissement",
    "Communauté",
]
CeaHorizon = Literal["<30d", "30-90d", "3-12m", ">12m"]
CeaLanguage = Literal["EN", "FR", "PT"]
HeritageSensitivity = Literal["PUBLIC_N0", "COMMUNITY_N1", "INITIATIC_N2", "SACRED_N3", "RESTRICTED_N4"]
HeritageEventType = Literal[
    "CONTENT_VIEW",
    "KNOWLEDGE_CARD_OPEN",
    "CTA_CLICK",
    "WHATSAPP_START",
    "LEAD_CREATED",
    "DIAGNOSTIC_BOOKED",
    "OFFER_SENT",
    "PAYMENT_CONFIRMED",
    "TRIP_STARTED",
    "HERITAGE_SITE_VISIT",
    "EXPERIENCE_COMPLETED",
    "INVESTMENT_LEAD_CREATED",
    "REFERRAL_CREATED",
]


class CeaReturnLeadInput(BaseModel):
    content_id: str = Field(min_length=1, max_length=128)
    narrative_source: str = Field(min_length=1, max_length=256)
    primary_intent: CeaPrimaryIntent
    horizon: CeaHorizon
    budget_usd: float = Field(ge=0)
    investment_project: str | None = Field(default=None, max_length=2000)
    consent_contact: bool = False
    language: CeaLanguage = "FR"


class HeritageAttributionEvent(BaseModel):
    client_event_id: str = Field(min_length=1, max_length=128)
    session_id: str = Field(min_length=1, max_length=128)
    lead_id: str | None = Field(default=None, max_length=128)
    content_id: str = Field(min_length=1)
    source_campaign: str = Field(min_length=1, max_length=256)
    narrative_source: str = Field(min_length=1)
    event_type: HeritageEventType
    heritage_sensitivity: HeritageSensitivity = "PUBLIC_N0"
    consent_contact: bool = False
    proof_ref: str | None = Field(default=None, max_length=2048)
    economic_value_usd: float | None = Field(default=None, ge=0)
    occurred_at: str | None = None


HERITAGE_ATTRIBUTION_LEDGER: dict[str, dict] = {}


OFFER_BY_INTENT = {
    "Identité": ("Pack Dossier 150 USD", 150),
    "Voyage": ("Accueil Cotonou 600 USD", 600),
    "Mémoire & Culture": ("Accueil Cotonou 600 USD", 600),
    "Installation": ("Installation 1 500 USD", 1500),
    "Investissement": ("Investissement 2 000 USD+", 2000),
    "Communauté": ("Diagnostic gratuit", 0),
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _canonical_digest(payload: dict) -> str:
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def qualify_cea_return_lead(payload: CeaReturnLeadInput) -> dict:
    offer, estimated_value_usd = OFFER_BY_INTENT[payload.primary_intent]
    has_concrete_investment = (
        payload.primary_intent == "Investissement"
        and payload.budget_usd > 0
        and bool((payload.investment_project or "").strip())
    )

    if has_concrete_investment:
        priority = "P0 - Immédiat"
    elif payload.primary_intent == "Installation" and payload.horizon in {"<30d", "30-90d"}:
        priority = "P0 - Immédiat"
    elif payload.primary_intent in {"Identité", "Voyage", "Mémoire & Culture"}:
        priority = "P1 - Cette semaine"
    elif payload.primary_intent == "Communauté" and payload.horizon == ">12m":
        priority = "P3 - Nurture"
    else:
        priority = "P2 - Ce mois"

    return {
        "profile": "CEA_RETURN",
        "content_id": payload.content_id,
        "narrative_source": payload.narrative_source,
        "primary_intent": payload.primary_intent,
        "language": payload.language,
        "priority": priority,
        "next_best_offer": offer,
        "estimated_value_usd": estimated_value_usd,
        "payment_status": "Non proposé",
        "revenue_attributed_usd": 0,
        "contact_allowed": payload.consent_contact,
        "crm_record": {
            "Content ID": payload.content_id,
            "Narrative Source": payload.narrative_source,
            "Primary Intent": payload.primary_intent,
            "Next Best Offer": offer,
            "Langue": payload.language,
            "Consentement Contact": "__YES__" if payload.consent_contact else "__NO__",
            "Revenue Attributed USD": 0,
            "Payment Status": "Non proposé",
            "Priorité": priority,
        },
    }


def normalize_heritage_event(payload: HeritageAttributionEvent) -> dict:
    base = {
        "client_event_id": payload.client_event_id,
        "session_id": payload.session_id,
        "lead_id": payload.lead_id,
        "content_id": payload.content_id,
        "source_campaign": payload.source_campaign,
        "narrative_source": payload.narrative_source,
        "event_type": payload.event_type,
        "heritage_sensitivity": payload.heritage_sensitivity,
        "consent_contact": payload.consent_contact,
        "proof_ref": payload.proof_ref,
        "economic_value_usd": payload.economic_value_usd,
        "occurred_at": payload.occurred_at or _now_iso(),
    }

    if payload.heritage_sensitivity != "PUBLIC_N0":
        return {
            **base,
            "accepted": False,
            "blocked": True,
            "reason": "non_public_heritage_not_eligible_for_public_revenue_funnel",
            "attribution_level": "NONE",
            "revenue_attributable": False,
        }

    lead_required = {
        "LEAD_CREATED",
        "DIAGNOSTIC_BOOKED",
        "OFFER_SENT",
        "PAYMENT_CONFIRMED",
        "TRIP_STARTED",
        "HERITAGE_SITE_VISIT",
        "EXPERIENCE_COMPLETED",
        "INVESTMENT_LEAD_CREATED",
        "REFERRAL_CREATED",
    }
    if payload.event_type in lead_required and not payload.lead_id:
        return {
            **base,
            "accepted": False,
            "blocked": True,
            "reason": "lead_id_required_for_attributed_event",
            "attribution_level": "NONE",
            "revenue_attributable": False,
        }

    if payload.event_type == "PAYMENT_CONFIRMED":
        if not payload.proof_ref:
            return {
                **base,
                "accepted": False,
                "blocked": True,
                "reason": "payment_proof_required",
                "attribution_level": "NONE",
                "revenue_attributable": False,
            }
        if not payload.economic_value_usd or payload.economic_value_usd <= 0:
            return {
                **base,
                "accepted": False,
                "blocked": True,
                "reason": "positive_economic_value_required",
                "attribution_level": "NONE",
                "revenue_attributable": False,
            }

    if payload.event_type in {"CONTENT_VIEW", "KNOWLEDGE_CARD_OPEN", "CTA_CLICK"}:
        attribution_level = "OBSERVED"
    elif payload.event_type in {"WHATSAPP_START", "LEAD_CREATED"}:
        attribution_level = "ASSOCIATED"
    else:
        attribution_level = "ATTRIBUTED"

    event_id_seed = {
        "client_event_id": payload.client_event_id,
        "session_id": payload.session_id,
        "content_id": payload.content_id,
        "source_campaign": payload.source_campaign,
    }
    event_id = f"HER-EVT-{_canonical_digest(event_id_seed)[:16].upper()}"
    record = {
        **base,
        "event_id": event_id,
        "accepted": True,
        "blocked": False,
        "reason": "accepted",
        "attribution_level": attribution_level,
        "revenue_attributable": payload.event_type == "PAYMENT_CONFIRMED",
        "contact_allowed": payload.consent_contact,
        "storage_boundary": "STAGING_MEMORY_ONLY",
    }
    HERITAGE_ATTRIBUTION_LEDGER[event_id] = record
    return record
