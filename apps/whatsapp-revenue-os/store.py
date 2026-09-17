from __future__ import annotations

import hashlib
import json
import os
from typing import Protocol

import httpx

from domain import HandoffSummary, LeadScore, QualificationSnapshot, utc_now_iso


def _stable_id(prefix: str, *parts: str) -> str:
    raw = "|".join(parts)
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]
    return f"{prefix}_{digest}"


def redact_phone(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) <= 4:
        return "***"
    return f"+***{digits[-4:]}"


class RevenueStore(Protocol):
    def upsert_contact(self, organization_id: str, phone_e164: str) -> str: ...
    def get_or_create_conversation(self, organization_id: str, contact_id: str) -> str: ...
    def record_message_meta(self, organization_id: str, conversation_id: str, message_id: str, direction: str, content_sha256: str, status: str) -> None: ...
    def save_qualification(self, organization_id: str, conversation_id: str, qualification: QualificationSnapshot, score: LeadScore) -> None: ...
    def save_appointment(self, organization_id: str, conversation_id: str, window: str, status: str = "proposed") -> None: ...
    def save_handoff(self, organization_id: str, handoff: HandoffSummary) -> None: ...
    def save_opt_out(self, organization_id: str, contact_id: str, source_message_id: str) -> None: ...
    def append_audit(self, organization_id: str, event_type: str, conversation_id: str | None, evidence: dict) -> None: ...
    def summary(self, organization_id: str) -> dict: ...


class InMemoryRevenueStore:
    def __init__(self) -> None:
        self.contacts: dict[str, dict] = {}
        self.conversations: dict[str, dict] = {}
        self.messages: list[dict] = []
        self.qualifications: list[dict] = []
        self.appointments: list[dict] = []
        self.handoffs: list[dict] = []
        self.opt_outs: list[dict] = []
        self.audit: list[dict] = []

    def upsert_contact(self, organization_id: str, phone_e164: str) -> str:
        contact_id = _stable_id("contact", organization_id, phone_e164)
        self.contacts[contact_id] = {
            "id": contact_id,
            "organization_id": organization_id,
            "phone_e164": phone_e164,
            "phone_redacted": redact_phone(phone_e164),
            "updated_at": utc_now_iso(),
        }
        return contact_id

    def get_or_create_conversation(self, organization_id: str, contact_id: str) -> str:
        conversation_id = _stable_id("conv", organization_id, contact_id)
        self.conversations.setdefault(
            conversation_id,
            {
                "id": conversation_id,
                "organization_id": organization_id,
                "contact_id": contact_id,
                "state": "NEW",
                "automated_followups_sent": 0,
                "created_at": utc_now_iso(),
            },
        )
        return conversation_id

    def record_message_meta(self, organization_id: str, conversation_id: str, message_id: str, direction: str, content_sha256: str, status: str) -> None:
        self.messages.append({
            "id": _stable_id("msg", organization_id, message_id),
            "organization_id": organization_id,
            "conversation_id": conversation_id,
            "external_message_id": message_id,
            "direction": direction,
            "content_sha256": content_sha256,
            "status": status,
            "created_at": utc_now_iso(),
        })

    def save_qualification(self, organization_id: str, conversation_id: str, qualification: QualificationSnapshot, score: LeadScore) -> None:
        self.qualifications.append({
            "id": _stable_id("qual", organization_id, conversation_id, utc_now_iso()),
            "organization_id": organization_id,
            "conversation_id": conversation_id,
            "snapshot": qualification.model_dump(),
            "score": score.model_dump(),
            "created_at": utc_now_iso(),
        })
        if conversation_id in self.conversations:
            self.conversations[conversation_id]["state"] = "QUALIFIED" if score.temperature == "hot" else "QUALIFYING"

    def save_appointment(self, organization_id: str, conversation_id: str, window: str, status: str = "proposed") -> None:
        self.appointments.append({
            "id": _stable_id("appt", organization_id, conversation_id, window),
            "organization_id": organization_id,
            "conversation_id": conversation_id,
            "window": window,
            "status": status,
            "created_at": utc_now_iso(),
        })
        if conversation_id in self.conversations:
            self.conversations[conversation_id]["state"] = "APPOINTMENT_PROPOSED"

    def save_handoff(self, organization_id: str, handoff: HandoffSummary) -> None:
        self.handoffs.append({
            "id": _stable_id("handoff", organization_id, handoff.conversation_id, handoff.created_at),
            "organization_id": organization_id,
            **handoff.model_dump(),
        })
        if handoff.conversation_id in self.conversations:
            self.conversations[handoff.conversation_id]["state"] = "HANDOFF"

    def save_opt_out(self, organization_id: str, contact_id: str, source_message_id: str) -> None:
        self.opt_outs.append({
            "id": _stable_id("optout", organization_id, contact_id),
            "organization_id": organization_id,
            "contact_id": contact_id,
            "source_message_id": source_message_id,
            "created_at": utc_now_iso(),
        })
        for conversation in self.conversations.values():
            if conversation["organization_id"] == organization_id and conversation["contact_id"] == contact_id:
                conversation["state"] = "OPTED_OUT"

    def append_audit(self, organization_id: str, event_type: str, conversation_id: str | None, evidence: dict) -> None:
        self.audit.append({
            "id": _stable_id("audit", organization_id, event_type, conversation_id or "none", utc_now_iso()),
            "organization_id": organization_id,
            "event_type": event_type,
            "conversation_id": conversation_id,
            "evidence": evidence,
            "created_at": utc_now_iso(),
        })

    def summary(self, organization_id: str) -> dict:
        qualifications = [q for q in self.qualifications if q["organization_id"] == organization_id]
        return {
            "inbound_leads": sum(1 for c in self.conversations.values() if c["organization_id"] == organization_id),
            "qualified": len(qualifications),
            "hot": sum(1 for q in qualifications if q["score"]["temperature"] == "hot"),
            "appointments": sum(1 for a in self.appointments if a["organization_id"] == organization_id),
            "handoffs": sum(1 for h in self.handoffs if h["organization_id"] == organization_id),
            "opt_outs": sum(1 for o in self.opt_outs if o["organization_id"] == organization_id),
            "outbound_sent": sum(1 for m in self.messages if m["organization_id"] == organization_id and m["direction"] == "outbound" and m["status"] == "sent"),
            "outbound_blocked": sum(1 for a in self.audit if a["organization_id"] == organization_id and a["event_type"] == "outbound_blocked"),
        }


class SupabaseRevenueStore:
    def __init__(self, url: str | None = None, service_role_key: str | None = None) -> None:
        self.url = (url or os.getenv("SUPABASE_URL", "")).rstrip("/")
        self.service_role_key = service_role_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        if not self.url or not self.service_role_key:
            raise RuntimeError("Supabase store requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        self.client = httpx.Client(timeout=12.0, headers={
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
        })

    def _post(self, table: str, payload: dict, upsert: bool = False) -> None:
        headers = {"Prefer": "resolution=merge-duplicates,return=minimal"} if upsert else {"Prefer": "return=minimal"}
        response = self.client.post(f"{self.url}/rest/v1/{table}", content=json.dumps(payload), headers=headers)
        response.raise_for_status()

    def _count(self, table: str, organization_id: str, extra: str = "") -> int:
        query = f"organization_id=eq.{organization_id}&select=id{extra}"
        response = self.client.get(f"{self.url}/rest/v1/{table}?{query}")
        response.raise_for_status()
        return len(response.json())

    def upsert_contact(self, organization_id: str, phone_e164: str) -> str:
        contact_id = _stable_id("contact", organization_id, phone_e164)
        self._post("wa_contacts", {
            "id": contact_id,
            "organization_id": organization_id,
            "phone_e164": phone_e164,
            "phone_redacted": redact_phone(phone_e164),
            "updated_at": utc_now_iso(),
        }, upsert=True)
        return contact_id

    def get_or_create_conversation(self, organization_id: str, contact_id: str) -> str:
        conversation_id = _stable_id("conv", organization_id, contact_id)
        self._post("wa_conversations", {
            "id": conversation_id,
            "organization_id": organization_id,
            "contact_id": contact_id,
            "state": "NEW",
            "automated_followups_sent": 0,
            "updated_at": utc_now_iso(),
        }, upsert=True)
        return conversation_id

    def record_message_meta(self, organization_id: str, conversation_id: str, message_id: str, direction: str, content_sha256: str, status: str) -> None:
        self._post("wa_messages_meta", {
            "id": _stable_id("msg", organization_id, message_id),
            "organization_id": organization_id,
            "conversation_id": conversation_id,
            "external_message_id": message_id,
            "direction": direction,
            "content_sha256": content_sha256,
            "status": status,
        }, upsert=True)

    def save_qualification(self, organization_id: str, conversation_id: str, qualification: QualificationSnapshot, score: LeadScore) -> None:
        self._post("wa_qualification_snapshots", {
            "id": _stable_id("qual", organization_id, conversation_id, utc_now_iso()),
            "organization_id": organization_id,
            "conversation_id": conversation_id,
            "snapshot": qualification.model_dump(),
            "score": score.model_dump(),
        })

    def save_appointment(self, organization_id: str, conversation_id: str, window: str, status: str = "proposed") -> None:
        self._post("wa_appointments", {
            "id": _stable_id("appt", organization_id, conversation_id, window),
            "organization_id": organization_id,
            "conversation_id": conversation_id,
            "window": window,
            "status": status,
        }, upsert=True)

    def save_handoff(self, organization_id: str, handoff: HandoffSummary) -> None:
        self._post("wa_handoffs", {
            "id": _stable_id("handoff", organization_id, handoff.conversation_id, handoff.created_at),
            "organization_id": organization_id,
            "conversation_id": handoff.conversation_id,
            "phone_redacted": handoff.phone_redacted,
            "reason": handoff.reason,
            "qualification": handoff.qualification.model_dump(),
            "score": handoff.score.model_dump(),
            "created_at": handoff.created_at,
        })

    def save_opt_out(self, organization_id: str, contact_id: str, source_message_id: str) -> None:
        self._post("wa_opt_outs", {
            "id": _stable_id("optout", organization_id, contact_id),
            "organization_id": organization_id,
            "contact_id": contact_id,
            "source_message_id": source_message_id,
        }, upsert=True)

    def append_audit(self, organization_id: str, event_type: str, conversation_id: str | None, evidence: dict) -> None:
        self._post("wa_audit_events", {
            "id": _stable_id("audit", organization_id, event_type, conversation_id or "none", utc_now_iso()),
            "organization_id": organization_id,
            "event_type": event_type,
            "conversation_id": conversation_id,
            "evidence": evidence,
        })

    def summary(self, organization_id: str) -> dict:
        qualified = self._count("wa_qualification_snapshots", organization_id)
        hot_response = self.client.get(
            f"{self.url}/rest/v1/wa_qualification_snapshots?organization_id=eq.{organization_id}&select=score"
        )
        hot_response.raise_for_status()
        hot = sum(1 for row in hot_response.json() if (row.get("score") or {}).get("temperature") == "hot")
        return {
            "inbound_leads": self._count("wa_conversations", organization_id),
            "qualified": qualified,
            "hot": hot,
            "appointments": self._count("wa_appointments", organization_id),
            "handoffs": self._count("wa_handoffs", organization_id),
            "opt_outs": self._count("wa_opt_outs", organization_id),
            "outbound_sent": 0,
            "outbound_blocked": 0,
        }
