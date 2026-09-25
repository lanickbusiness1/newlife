from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from main import FRONTEND_DIST, app


client = TestClient(app)


def test_retour_sources_spa_route_is_served_after_frontend_build():
    if not Path(FRONTEND_DIST).exists():
        pytest.skip("frontend dist is created by the production build before backend CI")
    response = client.get("/retour-sources")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert 'id="root"' in response.text


def test_api_route_wins_before_spa_fallback():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["asset_id"] == "PRD-MKT-TEAM-001"
