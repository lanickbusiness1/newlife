from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


ProvenanceStatus = Literal["VERIFIED", "CORROBORATED", "OBSERVATION_ONLY", "REJECTED"]
AuditOutcome = Literal["ATTEMPTED", "SUCCEEDED", "DENIED", "FAILED"]


class SourceRecord(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=256)
    source_type: str = Field(min_length=1, max_length=64)
    license_class: str = Field(min_length=1, max_length=64)
    reliability_tier: int = Field(ge=1, le=5)
    active: bool = True
    allowed_hosts: list[str] = Field(default_factory=list, max_length=16)

    @field_validator("allowed_hosts")
    @classmethod
    def normalize_allowed_hosts(cls, value: list[str]) -> list[str]:
        normalized: list[str] = []
        for host in value:
            candidate = host.strip().lower().rstrip(".")
            if not candidate or len(candidate) > 253:
                raise ValueError("allowed hosts must be valid DNS host names")
            if "/" in candidate or "://" in candidate or "@" in candidate:
                raise ValueError("allowed hosts must contain host names only")
            if candidate not in normalized:
                normalized.append(candidate)
        return normalized


class CrawlTarget(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    source_id: str = Field(min_length=1, max_length=128)
    url: str = Field(min_length=8, max_length=2048)
    country_iso3: str = Field(min_length=3, max_length=3)
    event_type_hint: str = Field(min_length=1, max_length=64)
    sector: str | None = Field(default=None, max_length=128)
    sensitive: bool = False
    enabled: bool = True
    interval_seconds: int = Field(default=3600, ge=300, le=604800)
    next_due_at: datetime
    last_attempt_at: datetime | None = None
    last_success_at: datetime | None = None
    failure_count: int = Field(default=0, ge=0, le=1000)
    last_content_sha256: str | None = Field(default=None, min_length=64, max_length=64)
    last_error: str | None = Field(default=None, max_length=512)

    @field_validator("country_iso3")
    @classmethod
    def normalize_country_iso3(cls, value: str) -> str:
        return value.upper()

    @field_validator("last_content_sha256")
    @classmethod
    def validate_content_digest(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.lower()
        if any(character not in "0123456789abcdef" for character in normalized):
            raise ValueError("last_content_sha256 must be a hexadecimal SHA-256 digest")
        return normalized


class EventInput(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    event_type: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=512)
    country_iso3: str = Field(min_length=3, max_length=3)
    observed_at: datetime
    source_ids: list[str] = Field(min_length=1, max_length=16)
    confidence: float = Field(ge=0.0, le=1.0)
    corroboration_count: int = Field(ge=1, le=16)
    sensitive: bool = False
    lat: float | None = Field(default=None, ge=-90.0, le=90.0)
    lon: float | None = Field(default=None, ge=-180.0, le=180.0)
    summary: str | None = Field(default=None, max_length=4000)
    sector: str | None = Field(default=None, max_length=128)

    @field_validator("country_iso3")
    @classmethod
    def normalize_iso3(cls, value: str) -> str:
        return value.upper()

    @field_validator("source_ids")
    @classmethod
    def reject_blank_or_oversized_sources(cls, value: list[str]) -> list[str]:
        if any(not source_id.strip() for source_id in value):
            raise ValueError("source ids must be non-empty")
        if any(len(source_id) > 128 for source_id in value):
            raise ValueError("source ids must be at most 128 characters")
        return value


class ProvenanceDecision(BaseModel):
    accepted: bool
    status: ProvenanceStatus
    reasons: list[str] = Field(default_factory=list, max_length=16)


class AcceptedEvent(BaseModel):
    event: EventInput
    provenance: ProvenanceDecision


class AuditRecord(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    occurred_at: datetime
    action: str = Field(min_length=1, max_length=64)
    outcome: AuditOutcome
    resource: str = Field(min_length=1, max_length=512)
    reason: str | None = Field(default=None, max_length=512)
    source_id: str | None = Field(default=None, max_length=128)
    target_id: str | None = Field(default=None, max_length=128)
    details: dict[str, str | int | float | bool | None] = Field(default_factory=dict)

    @field_validator("details")
    @classmethod
    def bound_details(cls, value: dict[str, str | int | float | bool | None]):
        if len(value) > 16:
            raise ValueError("audit details support at most 16 fields")
        for key, item in value.items():
            if not key or len(key) > 64:
                raise ValueError("audit detail keys must be 1-64 characters")
            if isinstance(item, str) and len(item) > 256:
                raise ValueError("audit detail string values must be at most 256 characters")
        return value
