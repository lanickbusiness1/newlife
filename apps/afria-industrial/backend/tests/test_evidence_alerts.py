from app.domain.models import Alert, Asset, Line, Site
from app.persistence.repositories import AssetRepository, LineRepository, SiteRepository
from app.persistence.sqlite import connect_sqlite, initialize_schema


def _connection(tmp_path):
    conn = connect_sqlite(str(tmp_path / 'evidence.db'))
    initialize_schema(conn)
    return conn


def test_evidence_chain_detects_tampering(tmp_path):
    from app.services.evidence import EvidenceService
    connection = _connection(tmp_path)
    evidence_service = EvidenceService(connection)
    evidence_service.append('ASSET_REGISTERED', 'engineer', {'asset_id': 'a1'}, {'asset_id': 'a1'}, [])
    evidence_service.append('ALERT_ACKNOWLEDGED', 'operator', {'alert_id': 'x'}, {'alert_id': 'x'}, [])
    assert evidence_service.verify_chain() is True
    connection.execute("UPDATE evidence SET output_hash='tampered' WHERE sequence=1")
    connection.commit()
    assert evidence_service.verify_chain() is False


def test_alert_acknowledgement_and_evidence_are_atomic(tmp_path):
    from app.services.alerts import AlertService
    from app.services.evidence import EvidenceService
    conn = _connection(tmp_path)
    SiteRepository(conn).create(Site('s1', 'Demo', 'BJ', 'Africa/Porto-Novo', 'agro', 'active', 'local'))
    LineRepository(conn).create(Line('l1', 's1', 'Line', 'packing', 100.0, 'units/hour'))
    AssetRepository(conn).create(Asset('a1', 's1', 'l1', 'motor', 'Synthetic', 'M1', 'high', None, 'simulator', 'online'))
    service = AlertService(conn, EvidenceService(conn))
    created = service.create(Alert('al1', 's1', 'a1', 'HIGH', 'OPEN', '2026-09-01T00:00:00Z', 'Inspect bearing', rule_id='r1'))
    assert created.state == 'OPEN'
    acknowledged = service.acknowledge('al1', actor='operator', acknowledged_at='2026-09-01T00:05:00Z')
    assert acknowledged.state == 'ACKNOWLEDGED'
    assert acknowledged.acknowledged_by == 'operator'
    row = conn.execute("SELECT event_type, actor FROM evidence ORDER BY sequence DESC LIMIT 1").fetchone()
    assert tuple(row) == ('ALERT_ACKNOWLEDGED', 'operator')
    assert EvidenceService(conn).verify_chain() is True


def test_public_evidence_api_has_no_update_or_delete_route(tmp_path):
    from fastapi.testclient import TestClient
    from app.core.config import Settings
    from app.main import create_app
    app = create_app(Settings(database_path=str(tmp_path / 'api.db')))
    paths = {route.path for route in app.routes}
    assert '/evidence' in paths
    assert not any(path.startswith('/evidence/') for path in paths)
    client = TestClient(app)
    assert client.put('/evidence', json={}).status_code == 405
    assert client.delete('/evidence').status_code == 405
