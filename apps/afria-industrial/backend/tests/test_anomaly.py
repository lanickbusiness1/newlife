from app.domain.anomaly import moving_average_deviation, rate_of_change_anomaly, rolling_zscore_anomaly, staleness_anomaly, threshold_anomaly


def test_zscore_anomaly_explains_baseline_and_deviation():
    r = rolling_zscore_anomaly([10, 10, 11, 9, 10], 18, 3.0)
    assert r.detected is True
    assert r.method == 'ROLLING_ZSCORE'
    assert 'baseline' in r.explanation.lower()
    assert r.deviation > 0
    assert r.severity in {'MEDIUM', 'HIGH', 'CRITICAL'}


def test_threshold_below_limit_is_not_anomaly():
    r = threshold_anomaly(72.0, 80.0)
    assert r.detected is False
    assert r.severity == 'INFO'


def test_moving_average_and_rate_of_change_are_explainable():
    ma = moving_average_deviation([100, 101, 99, 100], 130, 0.15)
    roc = rate_of_change_anomaly(100, 130, 0.2)
    assert ma.detected is True and ma.method == 'MOVING_AVERAGE_DEVIATION'
    assert roc.detected is True and 'change' in roc.explanation.lower()


def test_staleness_uses_age_against_threshold():
    fresh = staleness_anomaly(age_seconds=10, threshold_seconds=60)
    stale = staleness_anomaly(age_seconds=120, threshold_seconds=60)
    assert fresh.detected is False
    assert stale.detected is True
    assert stale.method == 'STALENESS'
