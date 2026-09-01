from __future__ import annotations

from dataclasses import dataclass
from statistics import mean, pstdev


@dataclass(frozen=True)
class AnomalyResult:
    detected: bool
    method: str
    baseline: float
    observed_value: float
    deviation: float
    severity: str
    explanation: str
    evidence_refs: tuple[str, ...] = ()


def _severity(score: float, trigger: float) -> str:
    if score < trigger:
        return 'INFO'
    ratio = score / trigger if trigger > 0 else float('inf')
    if ratio < 1.5:
        return 'MEDIUM'
    if ratio < 2.0:
        return 'HIGH'
    return 'CRITICAL'


def threshold_anomaly(observed: float, threshold: float, direction: str = 'above', evidence_refs: tuple[str, ...] = ()) -> AnomalyResult:
    if direction not in {'above', 'below'}:
        raise ValueError("direction must be 'above' or 'below'")
    deviation = observed - threshold if direction == 'above' else threshold - observed
    detected = deviation > 0
    score = max(deviation, 0.0)
    trigger = max(abs(threshold) * 0.05, 1e-9)
    return AnomalyResult(detected, 'THRESHOLD', threshold, observed, deviation, _severity(score, trigger) if detected else 'INFO', f'Observed value {observed} is {deviation:+.3f} from threshold baseline {threshold} ({direction}).', evidence_refs)


def rolling_zscore_anomaly(history: list[float], observed: float, z_threshold: float, evidence_refs: tuple[str, ...] = ()) -> AnomalyResult:
    if len(history) < 2:
        raise ValueError('history must contain at least 2 values')
    if z_threshold <= 0:
        raise ValueError('z_threshold must be > 0')
    baseline = mean(history)
    sigma = pstdev(history)
    zscore = 0.0 if sigma == 0 and observed == baseline else (float('inf') if sigma == 0 else abs(observed - baseline) / sigma)
    deviation = abs(observed - baseline)
    detected = zscore >= z_threshold
    return AnomalyResult(detected, 'ROLLING_ZSCORE', baseline, observed, deviation, _severity(zscore, z_threshold) if detected else 'INFO', f'Observed {observed} differs from rolling baseline {baseline:.3f} by {deviation:.3f}; z-score={zscore:.3f}.', evidence_refs)


def moving_average_deviation(history: list[float], observed: float, fractional_threshold: float, evidence_refs: tuple[str, ...] = ()) -> AnomalyResult:
    if not history:
        raise ValueError('history must not be empty')
    if fractional_threshold <= 0:
        raise ValueError('fractional_threshold must be > 0')
    baseline = mean(history)
    fractional = abs(observed - baseline) / max(abs(baseline), 1e-9)
    detected = fractional >= fractional_threshold
    return AnomalyResult(detected, 'MOVING_AVERAGE_DEVIATION', baseline, observed, abs(observed - baseline), _severity(fractional, fractional_threshold) if detected else 'INFO', f'Observed {observed} differs from moving-average baseline {baseline:.3f} by {fractional:.1%}.', evidence_refs)


def rate_of_change_anomaly(previous: float, observed: float, fractional_threshold: float, evidence_refs: tuple[str, ...] = ()) -> AnomalyResult:
    if fractional_threshold <= 0:
        raise ValueError('fractional_threshold must be > 0')
    fractional = abs(observed - previous) / max(abs(previous), 1e-9)
    detected = fractional >= fractional_threshold
    return AnomalyResult(detected, 'RATE_OF_CHANGE', previous, observed, abs(observed - previous), _severity(fractional, fractional_threshold) if detected else 'INFO', f'Observed change from baseline {previous} to {observed} is {fractional:.1%}.', evidence_refs)


def staleness_anomaly(age_seconds: float, threshold_seconds: float, evidence_refs: tuple[str, ...] = ()) -> AnomalyResult:
    if age_seconds < 0:
        raise ValueError('age_seconds must be >= 0')
    if threshold_seconds <= 0:
        raise ValueError('threshold_seconds must be > 0')
    ratio = age_seconds / threshold_seconds
    detected = age_seconds > threshold_seconds
    return AnomalyResult(detected, 'STALENESS', threshold_seconds, age_seconds, max(age_seconds - threshold_seconds, 0.0), _severity(ratio, 1.0) if detected else 'INFO', f'Signal age {age_seconds:.1f}s compared with staleness baseline {threshold_seconds:.1f}s.', evidence_refs)
