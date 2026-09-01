from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Scenario:
    name: str
    metric: str
    unit: str
    baseline: float
    noise: float
    fault_start: int | None = None
    fault_slope: float = 0.0
    fault_offset: float = 0.0
    interruption_duration: int = 0
    cadence_seconds: int = 60


def healthy_motor() -> Scenario:
    return Scenario('healthy_motor', 'temperature_c', 'C', 62.0, 0.5)


def bearing_temperature_drift(fault_start: int = 60) -> Scenario:
    return Scenario('bearing_temperature_drift', 'bearing_temperature_c', 'C', 58.0, 0.4, fault_start, 0.18)


def pump_cavitation(fault_start: int = 60) -> Scenario:
    return Scenario('pump_cavitation', 'vibration_mm_s', 'mm/s', 2.1, 0.12, fault_start, 0.02, 2.2)


def conveyor_microstops(fault_start: int = 60) -> Scenario:
    return Scenario('conveyor_microstops', 'speed_m_min', 'm/min', 32.0, 0.3, fault_start, -0.04, -7.0)


def energy_inefficiency_drift(fault_start: int = 60) -> Scenario:
    return Scenario('energy_inefficiency_drift', 'energy_kw', 'kW', 85.0, 0.8, fault_start, 0.22)


def quality_degradation(fault_start: int = 60) -> Scenario:
    return Scenario('quality_degradation', 'reject_rate_pct', '%', 1.5, 0.08, fault_start, 0.03, 1.0)


def network_interruption(fault_start: int = 60, duration: int = 10) -> Scenario:
    return Scenario('network_interruption', 'heartbeat', 'bool', 1.0, 0.0, fault_start, 0.0, 0.0, duration)
