from fastapi.testclient import TestClient
from app.main import create_app


def test_live_and_ready_health_contract():
    client = TestClient(create_app())
    assert client.get('/health/live').json() == {'status': 'ok'}
    assert client.get('/health/ready').status_code == 200


def test_system_mode_defaults_to_online():
    client = TestClient(create_app())
    assert client.get('/system/mode').json() == {'mode': 'ONLINE', 'source': 'local'}
