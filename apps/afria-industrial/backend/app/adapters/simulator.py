from __future__ import annotations

from collections.abc import Iterable

from app.domain.models import TelemetryPoint


class SimulatorReadAdapter:
    def __init__(self, points: Iterable[TelemetryPoint] = ()) -> None:
        self._points = list(points)
        self._connected = False
    def connect(self) -> None:
        self._connected = True
    def health(self) -> dict[str, str]:
        return {'status': 'OK' if self._connected else 'DISCONNECTED', 'provider': 'SIMULATOR'}
    def discover_readable_points(self) -> list[dict[str, str]]:
        seen = {(p.asset_id, p.metric, p.unit) for p in self._points}
        return [{'asset_id': asset_id, 'metric': metric, 'unit': unit} for asset_id, metric, unit in sorted(seen)]
    def read_batch(self) -> list[TelemetryPoint]:
        if not self._connected:
            raise RuntimeError('simulator adapter is not connected')
        return list(self._points)
    def disconnect(self) -> None:
        self._connected = False
