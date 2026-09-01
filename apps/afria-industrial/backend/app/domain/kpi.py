from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class KpiResult:
    value: float
    data_quality: str
    denominator_valid: bool
    source_completeness: float
    calculation_period: tuple[str, str]
    components: dict[str, float] = field(default_factory=dict)
    evidence_refs: tuple[str, ...] = ()


def _validate_completeness(source_completeness: float) -> None:
    if not 0.0 <= source_completeness <= 1.0:
        raise ValueError('source_completeness must be between 0 and 1')


def _quality(source_completeness: float) -> str:
    return 'GOOD' if source_completeness == 1.0 else 'SUSPECT'


def calculate_oee(
    planned_minutes: float,
    run_minutes: float,
    actual_output: float,
    theoretical_output: float,
    good_units: float,
    total_units: float,
    source_completeness: float,
    period: tuple[str, str],
    evidence_refs: tuple[str, ...] = (),
) -> KpiResult:
    _validate_completeness(source_completeness)
    if planned_minutes <= 0:
        raise ValueError('planned_minutes must be > 0')
    if theoretical_output <= 0:
        raise ValueError('theoretical_output must be > 0')
    if total_units <= 0:
        raise ValueError('total_units must be > 0')
    if run_minutes < 0 or actual_output < 0 or good_units < 0:
        raise ValueError('OEE inputs must be non-negative')

    availability = run_minutes / planned_minutes
    performance = actual_output / theoretical_output
    quality = good_units / total_units
    value = availability * performance * quality
    return KpiResult(
        value=value,
        data_quality=_quality(source_completeness),
        denominator_valid=True,
        source_completeness=source_completeness,
        calculation_period=period,
        components={'availability': availability, 'performance': performance, 'quality': quality},
        evidence_refs=evidence_refs,
    )


def calculate_mtbf(operating_minutes: float, failures: int, source_completeness: float, period: tuple[str, str], evidence_refs: tuple[str, ...] = ()) -> KpiResult:
    _validate_completeness(source_completeness)
    if failures <= 0:
        raise ValueError('failures must be > 0')
    if operating_minutes < 0:
        raise ValueError('operating_minutes must be >= 0')
    return KpiResult(operating_minutes / failures, _quality(source_completeness), True, source_completeness, period, {'operating_minutes': operating_minutes, 'failures': float(failures)}, evidence_refs)


def calculate_mttr(repair_minutes: float, repairs: int, source_completeness: float, period: tuple[str, str], evidence_refs: tuple[str, ...] = ()) -> KpiResult:
    _validate_completeness(source_completeness)
    if repairs <= 0:
        raise ValueError('repairs must be > 0')
    if repair_minutes < 0:
        raise ValueError('repair_minutes must be >= 0')
    return KpiResult(repair_minutes / repairs, _quality(source_completeness), True, source_completeness, period, {'repair_minutes': repair_minutes, 'repairs': float(repairs)}, evidence_refs)


def calculate_energy_per_unit(kwh: float, good_units: float, source_completeness: float, period: tuple[str, str], evidence_refs: tuple[str, ...] = ()) -> KpiResult:
    _validate_completeness(source_completeness)
    if good_units <= 0:
        raise ValueError('good_units must be > 0')
    if kwh < 0:
        raise ValueError('kwh must be >= 0')
    return KpiResult(kwh / good_units, _quality(source_completeness), True, source_completeness, period, {'kwh': kwh, 'good_units': good_units}, evidence_refs)
