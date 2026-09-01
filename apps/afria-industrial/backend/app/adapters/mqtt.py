from __future__ import annotations

from app.domain.models import TelemetryPoint


class MqttReadAdapter:
    def connect(self) -> None:
        return None
    def health(self) -> dict[str, str]:
        return {'status': 'PROVIDER_PENDING', 'provider': 'MQTT'}
    def discover_readable_points(self) -> list[dict[str, str]]:
        return []
    def read_batch(self) -> list[TelemetryPoint]:
        return []
    def disconnect(self) -> None:
        return None
