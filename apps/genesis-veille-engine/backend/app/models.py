from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


ProvenanceStatus = Literal["VERIFIED", "CORROBORATED", "OBSERVATION_ONLY", "REJECTED"]


class SourceRecord(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=256)
    source_type: str = Field(min_length=1, max_length=64)
    license_class: str = Field(min_length=1, max_length=64)
    reliability_tier: int = Field(ge=1, le=5)
    active: bool = True


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
