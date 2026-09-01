from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

Quality = Literal['GOOD', 'STALE', 'INVALID', 'SUSPECT']
Severity = Literal['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
AlertState = Literal['OPEN', 'ACKNOWLEDGED', 'RESOLVED']


@dataclass(frozen=True)
class Site:
    site_id: str
    name: str
    country: str
    timezone: str
    industry: str
    operating_status: str
    data_residency_policy: str


@dataclass(frozen=True)
class Line:
    line_id: str
    site_id: str
    name: str
    process_type: str
    rated_capacity: float
    unit: str


@dataclass(frozen=True)
class Asset:
    asset_id: str
    site_id: str
    line_id: str
    asset_type: str
    manufacturer: str
    model: str
    criticality: str
    commissioning_date: str | None
    protocol_profile: str
    status: str


@dataclass(frozen=True)
class TelemetryPoint:
    point_id: str
    asset_id: str
    metric: str
    unit: str
    timestamp: str
    value: float
    quality: Quality
    source: str
    provenance_id: str
    receipt_timestamp: str | None = None


@dataclass(frozen=True)
class ProductionEvent:
    event_id: str
    line_id: str
    timestamp: str
    event_type: str
    quantity: float
    unit: str
    duration_minutes: float | None = None


@dataclass(frozen=True)
class Anomaly:
    anomaly_id: str
    asset_id: str
    metric: str
    detected_at: str
    method: str
    baseline: float
    observed_value: float
    deviation: float
    severity: Severity
    explanation: str
    evidence_refs: tuple[str, ...] = ()


@dataclass(frozen=True)
class Alert:
    alert_id: str
    site_id: str
    asset_id: str
    severity: Severity
    state: AlertState
    raised_at: str
    recommendation: str
    anomaly_id: str | None = None
    rule_id: str | None = None
    acknowledged_at: str | None = None
    acknowledged_by: str | None = None
    evidence_refs: tuple[str, ...] = ()


@dataclass(frozen=True)
class EvidenceRecord:
    evidence_id: str
    sequence: int
    event_type: str
    actor: str
    scope: dict[str, Any]
    timestamp: str
    input_hash: str
    output_hash: str
    previous_hash: str
    source_refs: tuple[str, ...]
    decision: str | None
    metadata: dict[str, Any]
