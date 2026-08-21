from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


ProvenanceStatus = Literal["VERIFIED", "CORROBORATED", "OBSERVATION_ONLY", "REJECTED"]


class SourceRecord(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    source_type: str = Field(min_length=1)
    license_class: str = Field(min_length=1)
    reliability_tier: int = Field(ge=1, le=5)
    active: bool = True


class EventInput(BaseModel):
    id: str = Field(min_length=1)
    event_type: str = Field(min_length=1)
    title: str = Field(min_length=1)
    country_iso3: str = Field(min_length=3, max_length=3)
    observed_at: datetime
    source_ids: list[str] = Field(min_length=1)
    confidence: float = Field(ge=0.0, le=1.0)
    corroboration_count: int = Field(ge=1)
    sensitive: bool = False
    lat: float | None = Field(default=None, ge=-90.0, le=90.0)
    lon: float | None = Field(default=None, ge=-180.0, le=180.0)
    summary: str | None = None
    sector: str | None = None

    @field_validator("country_iso3")
    @classmethod
    def normalize_iso3(cls, value: str) -> str:
        return value.upper()

    @field_validator("source_ids")
    @classmethod
    def reject_blank_sources(cls, value: list[str]) -> list[str]:
        if any(not source_id.strip() for source_id in value):
            raise ValueError("source ids must be non-empty")
        return value


class ProvenanceDecision(BaseModel):
    accepted: bool
    status: ProvenanceStatus
    reasons: list[str] = Field(default_factory=list)


class AcceptedEvent(BaseModel):
    event: EventInput
    provenance: ProvenanceDecision
