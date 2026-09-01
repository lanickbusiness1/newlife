from generator.engine import generate_scenario
from generator.scenarios import bearing_temperature_drift, network_interruption


def test_fixed_seed_is_reproducible():
    assert generate_scenario(42, bearing_temperature_drift(60), 120) == generate_scenario(42, bearing_temperature_drift(60), 120)


def test_fault_window_changes_signal_after_injection():
    points = generate_scenario(7, bearing_temperature_drift(10), 30)
    before = [p['value'] for p in points[:10]]
    after = [p['value'] for p in points[20:]]
    assert sum(after) / len(after) > sum(before) / len(before)


def test_network_interruption_marks_points_unavailable():
    points = generate_scenario(3, network_interruption(5, 4), 15)
    assert [p['available'] for p in points[5:9]] == [False, False, False, False]
