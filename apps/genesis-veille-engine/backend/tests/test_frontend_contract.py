from pathlib import Path
import re


FRONTEND = Path(__file__).resolve().parents[2] / "frontend" / "index.html"

AFRICA_ISO3 = {
    "DZA", "AGO", "BEN", "BWA", "BFA", "BDI", "CPV", "CMR", "CAF", "TCD",
    "COM", "COG", "COD", "CIV", "DJI", "EGY", "GNQ", "ERI", "SWZ", "ETH",
    "GAB", "GMB", "GHA", "GIN", "GNB", "KEN", "LSO", "LBR", "LBY", "MDG",
    "MWI", "MLI", "MRT", "MUS", "MAR", "MOZ", "NAM", "NER", "NGA", "RWA",
    "STP", "SEN", "SYC", "SLE", "SOM", "ZAF", "SSD", "SDN", "TZA", "TGO",
    "TUN", "UGA", "ZMB", "ZWE",
}


def html() -> str:
    return FRONTEND.read_text(encoding="utf-8")


def test_public_shell_exists_and_has_no_auth_gate():
    content = html()

    assert "<title>Genesis Veille" in content
    assert "type=\"password\"" not in content
    assert "login-form" not in content
    assert "Sign in to continue" not in content


def test_public_shell_contains_all_54_african_country_codes():
    content = html()
    declared_codes = set(re.findall(r'iso3:\s*"([A-Z]{3})"', content))

    assert declared_codes == AFRICA_ISO3


def test_public_shell_calls_relative_world_state_api_and_surfaces_provenance():
    content = html()

    assert 'fetch("/health")' in content
    assert "/api/v1/world-state/countries/" in content
    assert "/api/v1/events" in content
    assert "provenance" in content.lower()
    assert "OBSERVATION_ONLY" in content
    assert "Mode dégradé" in content


def test_public_shell_has_no_runtime_third_party_map_dependency():
    content = html().lower()

    assert "unpkg.com" not in content
    assert "leaflet" not in content
    assert "tilelayer" not in content
    assert "openstreetmap.org" not in content
    assert not re.search(r'<script[^>]+src=["\']https?://', content)
    assert not re.search(r'<link[^>]+href=["\']https?://', content)
    assert 'id="africa-field"' in content
    assert "data-sovereign-map" in content
