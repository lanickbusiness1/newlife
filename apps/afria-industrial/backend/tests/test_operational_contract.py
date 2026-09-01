from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def test_env_example_contains_no_real_secret():
    text=(ROOT/'.env.example').read_text();assert 'change-me' in text;assert 'sk-' not in text;assert 'engineer-secret' not in text
def test_backend_dockerfile_pins_python_312(): assert 'python:3.12-slim' in (ROOT/'backend'/'Dockerfile').read_text()
def test_compose_persists_data_and_healthchecks_backend():
    text=(ROOT/'docker-compose.yml').read_text();assert '/health/ready' in text;assert 'industrial-data' in text
