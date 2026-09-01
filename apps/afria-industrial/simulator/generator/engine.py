from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from generator.scenarios import Scenario


def generate_scenario(seed: int, scenario: Scenario, count: int) -> list[dict[str, object]]:
    if count < 0:
        raise ValueError('count must be >= 0')
    rng = random.Random(seed)
    start = datetime(2026, 9, 1, tzinfo=timezone.utc)
    points: list[dict[str, object]] = []
    for index in range(count):
        in_fault = scenario.fault_start is not None and index >= scenario.fault_start
        interrupted = in_fault and scenario.interruption_duration > 0 and index < scenario.fault_start + scenario.interruption_duration
        drift_steps = 0 if not in_fault else index - scenario.fault_start
        value = scenario.baseline + rng.uniform(-scenario.noise, scenario.noise)
        if in_fault and not interrupted:
            value += scenario.fault_offset + scenario.fault_slope * drift_steps
        points.append({'index': index, 'timestamp': (start + timedelta(seconds=index * scenario.cadence_seconds)).isoformat().replace('+00:00', 'Z'), 'metric': scenario.metric, 'unit': scenario.unit, 'value': round(value, 6), 'available': not interrupted, 'scenario': scenario.name, 'source': 'SIMULATOR'})
    return points
