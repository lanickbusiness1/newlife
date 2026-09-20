from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field


ASSET_ID = "PRD-WA-AGENT-FACTORY-001"
PILOT_NUMBER = "+224611406262"

ConversationState = Literal[
    "NEW",
    "QUALIFYING",
    "QUALIFIED",
    "APPOINTMENT_PROPOSED",
    "HANDOFF",
    "OPTED_OUT",
    "CLOSED",
]
LeadTemperature = Literal["cold", "warm", "hot"]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class InboundMessage(BaseModel):
    organization_id: str = Field(min_length=1)
    message_id: str = Field(min_length=1)
    from_number: str = Field(min_length=4)
    text: str = Field(min_length=1, max_length=4096)
    received_at: str = Field(default_factory=utc_now_iso)


class QualificationSnapshot(BaseModel):
    intent: Literal["buy", "rent"] | None = None
    property_type: Literal["land", "house", "apartment", "office", "commercial"] | None = None
    zone: str | None = None
    budget_xof: int | None = Field(default=None, ge=0)
    timeline: str | None = None
    name: str | None = None
    consent_contact: bool = True


class LeadScore(BaseModel):
    points: int = Field(ge=0, le=100)
    temperature: LeadTemperature
    reasons: list[str] = Field(default_factory=list)


class PolicyDecision(BaseModel):
    opt_out: bool = False
    allow_automated_reply: bool = True
    escalate_human: bool = False
    blocked_reason: str | None = None


class HandoffSummary(BaseModel):
    conversation_id: str
    phone_redacted: str
    reason: str
    qualification: QualificationSnapshot
    score: LeadScore
    created_at: str = Field(default_factory=utc_now_iso)


class OrchestrationResult(BaseModel):
    conversation_id: str
    state: ConversationState
    qualification: QualificationSnapshot | None = None
    score: LeadScore | None = None
    reply_text: str | None = None
    reply_sent: bool = False
    appointment_proposed: bool = False
    handoff_created: bool = False
    opt_out: bool = False
    policy_reason: str | None = None
