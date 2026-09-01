import pytest

from app.domain.kpi import calculate_energy_per_unit, calculate_mtbf, calculate_mttr, calculate_oee


def test_oee_exposes_factors_and_completeness():
    r = calculate_oee(480, 420, 800, 840, 760, 800, source_completeness=1.0, period=('2026-09-01T00:00:00Z', '2026-09-01T08:00:00Z'))
    assert round(r.components['availability'], 4) == 0.875
    assert round(r.components['performance'], 4) == round(800 / 840, 4)
    assert round(r.components['quality'], 4) == 0.95
    assert r.source_completeness == 1.0
    assert r.denominator_valid is True
    assert r.data_quality == 'GOOD'


def test_energy_per_unit_rejects_zero_denominator():
    with pytest.raises(ValueError, match='good_units must be > 0'):
        calculate_energy_per_unit(25.0, 0, 1.0, ('a', 'b'))


def test_mtbf_and_mttr_preserve_period_and_partial_quality():
    mtbf = calculate_mtbf(600.0, 3, 0.9, ('a', 'b'))
    mttr = calculate_mttr(120.0, 3, 0.9, ('a', 'b'))
    assert mtbf.value == 200.0
    assert mttr.value == 40.0
    assert mtbf.calculation_period == ('a', 'b')
    assert mtbf.data_quality == 'SUSPECT'


def test_completeness_outside_zero_one_is_rejected():
    with pytest.raises(ValueError, match='source_completeness'):
        calculate_mtbf(10.0, 1, 1.2, ('a', 'b'))
