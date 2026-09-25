import os
from dataclasses import dataclass
from typing import Literal

import httpx
from pydantic import BaseModel, Field


CANONICAL_CRM_DATA_SOURCE_ID = "bf3a6c6b-4304-4a2c-a96d-0b788dc08600"
DEFAULT_NOTION_API_VERSION = "2025-09-03"

CeaPrimaryIntent = Literal[
    "Identité",
    "Voyage",
    "Mémoire & Culture",
    "Installation",
    "Investissement",
    "Communauté",
]
CeaPriority = Literal[
    "P0 - Immédiat",
    "P1 - Cette semaine",
    "P2 - Ce mois",
    "P3 - Nurture",
]
CeaNextBestOffer = Literal[
    "Diagnostic gratuit",
    "Pack Dossier 150 USD",
    "Accueil Cotonou 600 USD",
    "Installation 1 500 USD",
    "Investissement 2 000 USD+",
]
CeaLanguage = Literal["EN", "FR", "PT"]
CeaPaymentStatus = Literal["Non proposé", "Lien envoyé", "Acompte payé", "Payé", "Remboursé"]


class CeaCrmLead(BaseModel):
    lead_id: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=200)
    email: str | None = Field(default=None, max_length=320)
    whatsapp: str | None = Field(default=None, max_length=64)
    country: str | None = Field(default=None, max_length=128)
    organization: str | None = Field(default=None, max_length=200)
    content_id: str = Field(min_length=1, max_length=128)
    narrative_source: str = Field(min_length=1, max_length=256)
    primary_intent: CeaPrimaryIntent
    next_best_offer: CeaNextBestOffer
    language: CeaLanguage
    consent_contact: bool
    revenue_attributed_usd: float = Field(default=0, ge=0)
    payment_status: CeaPaymentStatus = "Non proposé"
    priority: CeaPriority
    note: str | None = Field(default=None, max_length=1000)


@dataclass(frozen=True)
class NotionCrmConfig:
    token: str
    data_source_id: str = CANONICAL_CRM_DATA_SOURCE_ID
    api_version: str = DEFAULT_NOTION_API_VERSION

    @classmethod
    def from_env(cls) -> "NotionCrmConfig | None":
        token = os.getenv("NOTION_CRM_TOKEN", "").strip()
        if not token:
            return None
        return cls(
            token=token,
            data_source_id=os.getenv(
                "CEA_NOTION_CRM_DATA_SOURCE_ID",
                CANONICAL_CRM_DATA_SOURCE_ID,
            ).strip(),
            api_version=os.getenv(
                "NOTION_API_VERSION",
                DEFAULT_NOTION_API_VERSION,
            ).strip(),
        )


def _title(value: str) -> dict:
    return {"title": [{"type": "text", "text": {"content": value}}]}


def _rich_text(value: str) -> dict:
    return {"rich_text": [{"type": "text", "text": {"content": value}}]}


def _select(value: str) -> dict:
    return {"select": {"name": value}}


def _checkbox(value: bool) -> dict:
    return {"checkbox": value}


def _number(value: float) -> dict:
    return {"number": value}


def _email(value: str) -> dict:
    return {"email": value}


def _phone(value: str) -> dict:
    return {"phone_number": value}


def build_notion_crm_properties(payload: CeaCrmLead) -> dict:
    properties = {
        "Nom": _title(payload.name),
        "Content ID": _rich_text(payload.content_id),
        "Narrative Source": _rich_text(payload.narrative_source),
        "Primary Intent": _select(payload.primary_intent),
        "Next Best Offer": _select(payload.next_best_offer),
        "Langue": _select(payload.language),
        "Consentement Contact": _checkbox(payload.consent_contact),
        "Revenue Attributed USD": _number(payload.revenue_attributed_usd),
        "Payment Status": _select(payload.payment_status),
        "Priorité": _select(payload.priority),
        "Statut Lead": _select("Nouveau"),
        "Notes": _rich_text(
            "CEA_LEAD_ID="
            + payload.lead_id
            + ("; " + payload.note if payload.note else "")
        ),
    }
    if payload.email:
        properties["Email"] = _email(payload.email)
    if payload.whatsapp:
        properties["WhatsApp"] = _phone(payload.whatsapp)
    if payload.country:
        properties["Pays"] = _rich_text(payload.country)
    if payload.organization:
        properties["Organisation"] = _rich_text(payload.organization)
    return properties


class NotionCrmAdapter:
    def __init__(
        self,
        config: NotionCrmConfig,
        client: httpx.Client | None = None,
    ):
        self.config = config
        self.client = client or httpx.Client(timeout=10.0)

    @property
    def headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.config.token}",
            "Content-Type": "application/json",
            "Notion-Version": self.config.api_version,
        }

    def _consent_denied(self, payload: CeaCrmLead) -> dict:
        return {
            "persisted": False,
            "reason": "contact_consent_required_for_crm_persistence",
            "lead_id": payload.lead_id,
            "data_source_id": self.config.data_source_id,
        }

    def find_lead_page(self, lead_id: str) -> dict | None:
        marker = f"CEA_LEAD_ID={lead_id}"
        response = self.client.post(
            f"https://api.notion.com/v1/data_sources/{self.config.data_source_id}/query",
            headers=self.headers,
            json={
                "filter": {
                    "property": "Notes",
                    "rich_text": {"contains": marker},
                },
                "page_size": 1,
            },
        )
        response.raise_for_status()
        results = response.json().get("results", [])
        return results[0] if results else None

    def create_lead(self, payload: CeaCrmLead) -> dict:
        if not payload.consent_contact:
            return self._consent_denied(payload)

        response = self.client.post(
            "https://api.notion.com/v1/pages",
            headers=self.headers,
            json={
                "parent": {
                    "type": "data_source_id",
                    "data_source_id": self.config.data_source_id,
                },
                "properties": build_notion_crm_properties(payload),
            },
        )
        response.raise_for_status()
        body = response.json()
        return {
            "persisted": True,
            "reason": "notion_crm_page_created",
            "lead_id": payload.lead_id,
            "notion_page_id": body.get("id"),
            "notion_url": body.get("url"),
            "data_source_id": self.config.data_source_id,
            "persistence_boundary": "NOTION_CRM",
            "idempotent_upsert": True,
        }

    def update_lead(self, page_id: str, payload: CeaCrmLead) -> dict:
        if not payload.consent_contact:
            return self._consent_denied(payload)

        response = self.client.patch(
            f"https://api.notion.com/v1/pages/{page_id}",
            headers=self.headers,
            json={"properties": build_notion_crm_properties(payload)},
        )
        response.raise_for_status()
        body = response.json()
        return {
            "persisted": True,
            "reason": "notion_crm_page_updated",
            "lead_id": payload.lead_id,
            "notion_page_id": body.get("id", page_id),
            "notion_url": body.get("url"),
            "data_source_id": self.config.data_source_id,
            "persistence_boundary": "NOTION_CRM",
            "idempotent_upsert": True,
        }

    def upsert_lead(self, payload: CeaCrmLead) -> dict:
        if not payload.consent_contact:
            return self._consent_denied(payload)
        existing = self.find_lead_page(payload.lead_id)
        if existing and existing.get("id"):
            return self.update_lead(existing["id"], payload)
        return self.create_lead(payload)
