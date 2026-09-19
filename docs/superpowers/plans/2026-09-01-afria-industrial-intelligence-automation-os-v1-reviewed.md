# AfrIA Industrial Intelligence & Automation OS™ v1.0 Implementation Plan — Self-Reviewed

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only, offline-first industrial intelligence proof runtime that registers industrial assets, ingests deterministic telemetry, computes KPIs, detects explainable anomalies, produces readiness assessments, preserves tamper-evident evidence, and demonstrates the complete controlled loop in a React cockpit.

**Architecture:** `apps/afria-industrial/` is a modular monolith inside `lanickbusiness1/newlife`. Python 3.12 + FastAPI + Pydantic v2 provide the API and domain runtime; SQLite WAL sits behind repository interfaces; React + TypeScript + Vite provide the cockpit; deterministic simulator plus MQTT/OPC-UA provider boundaries feed one normalized read-only adapter contract. No machine-control write path exists.

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2, pydantic-settings, Uvicorn, pytest, httpx, SQLite WAL, React, TypeScript, Vite, Vitest, Testing Library, Docker Compose, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-01-afria-industrial-intelligence-automation-os-v1-design.md`

## Global Constraints

- Canonical asset: `CAP-IND-AUTOMATION-001` under V4-DEC-030.
- Runtime path: `apps/afria-industrial/`.
- Backend: Python 3.12 + FastAPI + Pydantic v2.
- Persistence: SQLite WAL behind interfaces.
- Frontend: React + TypeScript + Vite.
- Proof authentication: API keys from environment variables mapped to `viewer`, `operator`, `engineer`, `admin`.
- No PLC/PAC/robot write-back method, route, adapter capability, command queue, or UI affordance may exist.
- Simulator provenance must be visible in API responses and UI.
- Evidence ledger is append-only through the application API and tamper-evident via SHA-256 hash chaining.
- Local core operation must survive loss of upstream connectivity.
- Sync envelopes must carry destination, purpose, data class, retention, legal/contractual authority, and encryption state.
- API must enforce bounded telemetry batches and rate limits on exposed mutations.
- Secure CORS and bind defaults must be explicit.
- Allowed truth progression: `ARCHITECTURE → BUILDING → TEST_PROVEN → STAGING_READY → PILOT_READY → site-specific review → PRODUCTION_PROVEN`.
- Simulator-only proof can at most produce `TEST_PROVEN`.

---

## File Map

### Backend
- `apps/afria-industrial/backend/app/main.py` — FastAPI composition root.
- `apps/afria-industrial/backend/app/core/config.py` — environment configuration.
- `apps/afria-industrial/backend/app/core/security.py` — API-key auth and RBAC.
- `apps/afria-industrial/backend/app/core/rate_limit.py` — fixed-window proof rate limiter.
- `apps/afria-industrial/backend/app/core/observability.py` — in-process operational counters.
- `apps/afria-industrial/backend/app/domain/models.py` — immutable domain types.
- `apps/afria-industrial/backend/app/domain/kpi.py` — pure KPI engine.
- `apps/afria-industrial/backend/app/domain/anomaly.py` — pure anomaly engine.
- `apps/afria-industrial/backend/app/domain/readiness.py` — readiness engine.
- `apps/afria-industrial/backend/app/persistence/sqlite.py` — WAL connection/schema.
- `apps/afria-industrial/backend/app/persistence/repositories.py` — repository implementations.
- `apps/afria-industrial/backend/app/services/telemetry.py` — ingestion/idempotency/data quality.
- `apps/afria-industrial/backend/app/services/evidence.py` — hash-chain ledger.
- `apps/afria-industrial/backend/app/services/alerts.py` — anomaly → alert → evidence.
- `apps/afria-industrial/backend/app/services/sync.py` — offline queue and mock upstream.
- `apps/afria-industrial/backend/app/adapters/contracts.py` — read-only protocol.
- `apps/afria-industrial/backend/app/adapters/simulator.py` — deterministic simulator adapter.
- `apps/afria-industrial/backend/app/adapters/mqtt.py` — read-only provider boundary.
- `apps/afria-industrial/backend/app/adapters/opcua.py` — read-only provider boundary.
- `apps/afria-industrial/backend/app/api/health.py` — live/ready/mode/metrics.
- `apps/afria-industrial/backend/app/api/assets.py` — site/line/asset registry.
- `apps/afria-industrial/backend/app/api/telemetry.py` — telemetry endpoints.
- `apps/afria-industrial/backend/app/api/analytics.py` — KPI/anomaly/alert endpoints.
- `apps/afria-industrial/backend/app/api/readiness.py` — readiness endpoints.
- `apps/afria-industrial/backend/app/api/evidence.py` — evidence endpoint.
- `apps/afria-industrial/backend/app/api/sync.py` — sync endpoint.

### Simulator
- `apps/afria-industrial/simulator/generator/scenarios.py` — deterministic scenario definitions.
- `apps/afria-industrial/simulator/generator/engine.py` — fixed-seed generation.
- `apps/afria-industrial/simulator/scenarios/default_factory.json` — synthetic topology.
- `apps/afria-industrial/simulator/tests/test_engine.py` — reproducibility/fault tests.

### Frontend
- `apps/afria-industrial/frontend/src/api/client.ts` — typed API client.
- `apps/afria-industrial/frontend/src/domain/types.ts` — frontend types.
- `apps/afria-industrial/frontend/src/App.tsx` — cockpit shell.
- `apps/afria-industrial/frontend/src/features/overview/*` — site/line KPI overview.
- `apps/afria-industrial/frontend/src/features/assets/*` — asset telemetry.
- `apps/afria-industrial/frontend/src/features/alerts/*` — alerts/anomalies.
- `apps/afria-industrial/frontend/src/features/readiness/*` — assessment.
- `apps/afria-industrial/frontend/src/features/system/*` — mode/provenance/staleness.

### Operations / Evidence
- `apps/afria-industrial/docker-compose.yml`
- `apps/afria-industrial/backend/Dockerfile`
- `apps/afria-industrial/frontend/Dockerfile`
- `.github/workflows/afria-industrial-proof.yml`
- `apps/afria-industrial/README.md`
- `apps/afria-industrial/docs/architecture.md`
- `apps/afria-industrial/docs/threat-model-ot.md`
- `apps/afria-industrial/docs/readiness-assessment.md`
- `apps/afria-industrial/docs/runbook.md`
- `apps/afria-industrial/docs/rollback.md`
- `apps/afria-industrial/docs/evidence-model.md`
- `apps/afria-industrial/docs/m8-release-evidence.md`

---

### Task 1: Bootstrap Backend, Configuration, and Health Contract

**Files:**
- Create: `apps/afria-industrial/backend/requirements.txt`
- Create: `apps/afria-industrial/backend/app/__init__.py`
- Create: `apps/afria-industrial/backend/app/core/config.py`
- Create: `apps/afria-industrial/backend/app/api/health.py`
- Create: `apps/afria-industrial/backend/app/main.py`
- Test: `apps/afria-industrial/backend/tests/test_health.py`

**Interfaces:**
- Produces `Settings`.
- Produces `create_app(settings: Settings | None = None) -> FastAPI`.
- Produces `GET /health/live`, `GET /health/ready`, `GET /system/mode`.

- [ ] **Step 1: Write failing health tests**

```python
from fastapi.testclient import TestClient
from app.main import create_app


def test_health_and_mode_contract():
    client = TestClient(create_app())
    assert client.get('/health/live').json() == {'status': 'ok'}
    assert client.get('/health/ready').status_code == 200
    assert client.get('/system/mode').json() == {'mode': 'ONLINE', 'source': 'LOCAL'}
```

- [ ] **Step 2: Verify RED**

```bash
cd apps/afria-industrial/backend
python -m pytest tests/test_health.py -v
```

Expected: import failure because runtime does not exist.

- [ ] **Step 3: Add exact dependency floor**

```text
fastapi>=0.115.0,<1.0
pydantic>=2.8.0,<3.0
pydantic-settings>=2.4.0,<3.0
uvicorn>=0.30.0,<1.0
pytest>=8.2.0,<9.0
httpx>=0.27.0,<1.0
```

- [ ] **Step 4: Implement settings**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix='AFRIA_INDUSTRIAL_', extra='ignore')
    database_path: str = './data/industrial.db'
    system_mode: str = 'ONLINE'
    cors_origins: str = 'http://localhost:5173'
    bind_host: str = '127.0.0.1'
```

- [ ] **Step 5: Implement health router and composition root**

`health.py` returns `LOCAL` provenance and accepts only `ONLINE`, `DEGRADED`, `OFFLINE_EDGE`. `main.py` registers the router.

- [ ] **Step 6: Verify GREEN and commit**

```bash
python -m pytest tests/test_health.py -v
git add apps/afria-industrial/backend
git commit -m "feat(industrial): bootstrap backend health contract"
```

---

### Task 2: Define Domain Types and SQLite WAL Repositories

**Files:**
- Create: `apps/afria-industrial/backend/app/domain/models.py`
- Create: `apps/afria-industrial/backend/app/persistence/sqlite.py`
- Create: `apps/afria-industrial/backend/app/persistence/repositories.py`
- Test: `apps/afria-industrial/backend/tests/test_persistence.py`

**Interfaces:**
- Produces immutable `Site`, `Line`, `Asset`, `TelemetryPoint`, `ProductionEvent`, `Anomaly`, `Alert`, `EvidenceRecord`, `SyncEnvelope`.
- Produces `connect_sqlite(path: str) -> sqlite3.Connection` and `initialize_schema(conn)`.

- [ ] **Step 1: Write failing WAL/repository test**

```python
from app.domain.models import Site
from app.persistence.sqlite import connect_sqlite, initialize_schema
from app.persistence.repositories import SiteRepository


def test_sqlite_wal_and_site_round_trip(tmp_path):
    conn = connect_sqlite(str(tmp_path / 'industrial.db'))
    initialize_schema(conn)
    assert conn.execute('PRAGMA journal_mode').fetchone()[0].lower() == 'wal'
    repo = SiteRepository(conn)
    repo.create(Site('s1', 'Demo', 'BJ', 'Africa/Porto-Novo', 'agro', 'active', 'local'))
    assert repo.list_all()[0].site_id == 's1'
```

- [ ] **Step 2: Verify RED**

```bash
python -m pytest tests/test_persistence.py -v
```

- [ ] **Step 3: Implement exact immutable types**

```python
from dataclasses import dataclass
from typing import Literal

Quality = Literal['GOOD', 'STALE', 'INVALID', 'SUSPECT']
SourceKind = Literal['SIMULATOR', 'MQTT', 'OPCUA']

@dataclass(frozen=True)
class Site:
    site_id: str
    name: str
    country: str
    timezone: str
    industry: str
    operating_status: str
    data_residency_policy: str
```

Define the remaining types with the exact fields in the spec; `TelemetryPoint` contains both event timestamp and receipt timestamp.

- [ ] **Step 4: Implement schema**

Tables: `sites`, `lines`, `assets`, `telemetry`, `production_events`, `anomalies`, `alerts`, `readiness_assessments`, `evidence`, `sync_queue`, `ingestion_batches`. Add unique constraints for telemetry point IDs, batch IDs, sync event IDs, and evidence sequence.

- [ ] **Step 5: Implement repositories without business logic**

Repositories only store/query domain values. No KPI/anomaly/readiness logic is allowed here.

- [ ] **Step 6: Verify GREEN and commit**

```bash
python -m pytest tests/test_persistence.py -v
git add apps/afria-industrial/backend/app/domain apps/afria-industrial/backend/app/persistence apps/afria-industrial/backend/tests/test_persistence.py
git commit -m "feat(industrial): add domain model and sqlite persistence"
```

---

### Task 3: Implement KPI Engine with Data Completeness Metadata

**Files:**
- Create: `apps/afria-industrial/backend/app/domain/kpi.py`
- Test: `apps/afria-industrial/backend/tests/test_kpi.py`

**Interfaces:**
- Produces `KpiResult(value, data_quality, denominator_valid, source_completeness, calculation_period, components, evidence_refs)`.
- Produces `calculate_oee`, `calculate_mtbf`, `calculate_mttr`, `calculate_energy_per_unit`.

- [ ] **Step 1: Write failing OEE/denominator/completeness tests**

```python
import pytest
from app.domain.kpi import calculate_energy_per_unit, calculate_oee


def test_oee_exposes_factors_and_completeness():
    r = calculate_oee(480, 420, 800, 840, 760, 800, source_completeness=1.0, period=('2026-09-01T00:00:00Z', '2026-09-01T08:00:00Z'))
    assert round(r.components['availability'], 4) == 0.875
    assert round(r.components['quality'], 4) == 0.95
    assert r.source_completeness == 1.0
    assert r.denominator_valid is True


def test_energy_per_unit_rejects_zero_denominator():
    with pytest.raises(ValueError, match='good_units must be > 0'):
        calculate_energy_per_unit(25.0, 0, 1.0, ('a', 'b'))
```

- [ ] **Step 2: Verify RED**

```bash
python -m pytest tests/test_kpi.py -v
```

- [ ] **Step 3: Implement pure formulas**

Never silently return 0 for invalid denominators. `data_quality='GOOD'` is permitted only when completeness is 1.0 and all required sources are valid.

- [ ] **Step 4: Add MTBF/MTTR tests and verify GREEN**

```bash
python -m pytest tests/test_kpi.py -v
git add apps/afria-industrial/backend/app/domain/kpi.py apps/afria-industrial/backend/tests/test_kpi.py
git commit -m "feat(industrial): add deterministic kpi engine"
```

---

### Task 4: Build Deterministic Simulator and Read-Only Adapter Boundaries

**Files:**
- Create: `apps/afria-industrial/simulator/generator/scenarios.py`
- Create: `apps/afria-industrial/simulator/generator/engine.py`
- Create: `apps/afria-industrial/simulator/scenarios/default_factory.json`
- Test: `apps/afria-industrial/simulator/tests/test_engine.py`
- Create: `apps/afria-industrial/backend/app/adapters/contracts.py`
- Create: `apps/afria-industrial/backend/app/adapters/simulator.py`
- Create: `apps/afria-industrial/backend/app/adapters/mqtt.py`
- Create: `apps/afria-industrial/backend/app/adapters/opcua.py`
- Test: `apps/afria-industrial/backend/tests/test_adapter_contract.py`

**Interfaces:**
- Produces `ReadOnlyAdapter` with exactly `connect`, `health`, `discover_readable_points`, `read_batch`, `disconnect`.
- Produces named deterministic scenarios.

- [ ] **Step 1: Write simulator reproducibility test**

```python
from generator.engine import generate_scenario
from generator.scenarios import bearing_temperature_drift


def test_fixed_seed_is_reproducible():
    assert generate_scenario(42, bearing_temperature_drift(60), 120) == generate_scenario(42, bearing_temperature_drift(60), 120)
```

- [ ] **Step 2: Write adapter safety test**

```python
from app.adapters.contracts import ReadOnlyAdapter


def test_adapter_contract_has_no_actuation_members():
    names = set(ReadOnlyAdapter.__dict__)
    assert not {'write', 'set', 'command', 'actuate'} & names
```

- [ ] **Step 3: Verify RED**

```bash
cd apps/afria-industrial/simulator && python -m pytest tests/test_engine.py -v
cd ../backend && python -m pytest tests/test_adapter_contract.py -v
```

- [ ] **Step 4: Implement named scenarios**

Required constructors: `healthy_motor`, `bearing_temperature_drift`, `pump_cavitation`, `conveyor_microstops`, `energy_inefficiency_drift`, `quality_degradation`, `network_interruption`.

- [ ] **Step 5: Implement provider boundaries**

`mqtt.py` and `opcua.py` implement the read-only interface but return `PROVIDER_PENDING` health when optional provider libraries/config are absent. They must not block simulator acceptance.

- [ ] **Step 6: Verify GREEN and commit**

```bash
cd apps/afria-industrial/simulator && python -m pytest -v
cd ../backend && python -m pytest tests/test_adapter_contract.py -v
git add apps/afria-industrial/simulator apps/afria-industrial/backend/app/adapters apps/afria-industrial/backend/tests/test_adapter_contract.py
git commit -m "feat(industrial): add deterministic simulator and read-only adapters"
```

---

### Task 5: Add Telemetry Ingestion, Idempotency, Clock Skew, and Data Quality

**Files:**
- Create: `apps/afria-industrial/backend/app/services/telemetry.py`
- Create: `apps/afria-industrial/backend/app/api/telemetry.py`
- Test: `apps/afria-industrial/backend/tests/test_telemetry_ingestion.py`
- Modify: `apps/afria-industrial/backend/app/main.py`

**Interfaces:**
- Produces `TelemetryService.ingest_batch(batch_id: str, points: list[TelemetryPoint]) -> IngestionResult`.
- API: `POST /telemetry/batch`, `GET /telemetry`.

- [ ] **Step 1: Write failing idempotency/batch-size tests**

```python
def test_duplicate_batch_is_idempotent(client, valid_batch):
    first = client.post('/telemetry/batch', json=valid_batch, headers={'X-API-Key': 'engineer-secret'})
    second = client.post('/telemetry/batch', json=valid_batch, headers={'X-API-Key': 'engineer-secret'})
    assert first.status_code == 202
    assert second.status_code == 200
    assert second.json()['duplicate'] is True


def test_more_than_1000_points_is_rejected(client, oversized_batch):
    assert client.post('/telemetry/batch', json=oversized_batch, headers={'X-API-Key': 'engineer-secret'}).status_code == 413
```

- [ ] **Step 2: Write failing clock-skew test**

```python
def test_future_timestamp_is_retained_but_marked_suspect(telemetry_service, future_point):
    result = telemetry_service.ingest_batch('b1', [future_point])
    assert result.accepted == 1
    assert result.points[0].quality == 'SUSPECT'
    assert result.points[0].received_at != result.points[0].timestamp
```

- [ ] **Step 3: Verify RED**

```bash
python -m pytest tests/test_telemetry_ingestion.py -v
```

- [ ] **Step 4: Implement `MAX_BATCH_POINTS = 1000` and explicit provenance**

Structural invalidity returns 422. Source values outside `SIMULATOR|MQTT|OPCUA` are rejected. Suspicious timestamps are retained with `SUSPECT` quality and a separate receipt timestamp.

- [ ] **Step 5: Verify GREEN and commit**

```bash
python -m pytest tests/test_telemetry_ingestion.py -v
git add apps/afria-industrial/backend/app/services/telemetry.py apps/afria-industrial/backend/app/api/telemetry.py apps/afria-industrial/backend/app/main.py apps/afria-industrial/backend/tests/test_telemetry_ingestion.py
git commit -m "feat(industrial): add telemetry ingestion and quality gates"
```

---

### Task 6: Implement Explainable Anomaly Engine

**Files:**
- Create: `apps/afria-industrial/backend/app/domain/anomaly.py`
- Test: `apps/afria-industrial/backend/tests/test_anomaly.py`

**Interfaces:**
- Produces `threshold_anomaly`, `rolling_zscore_anomaly`, `moving_average_deviation`, `rate_of_change_anomaly`, `staleness_anomaly`.
- Every positive result includes method, baseline, observed value, deviation, severity, explanation, evidence refs.

- [ ] **Step 1: Write failing z-score explanation test**

```python
from app.domain.anomaly import rolling_zscore_anomaly


def test_zscore_anomaly_explains_baseline_and_deviation():
    r = rolling_zscore_anomaly([10, 10, 11, 9, 10], 18, 3.0)
    assert r.detected is True
    assert r.method == 'ROLLING_ZSCORE'
    assert 'baseline' in r.explanation.lower()
    assert r.deviation > 0
```

- [ ] **Step 2: Verify RED**

```bash
python -m pytest tests/test_anomaly.py -v
```

- [ ] **Step 3: Implement pure methods and severity rules**

Severity is derived deterministically from configured deviation bands; no opaque ML model is required.

- [ ] **Step 4: Verify GREEN and commit**

```bash
python -m pytest tests/test_anomaly.py -v
git add apps/afria-industrial/backend/app/domain/anomaly.py apps/afria-industrial/backend/tests/test_anomaly.py
git commit -m "feat(industrial): add explainable anomaly engine"
```

---

### Task 7: Add Tamper-Evident Evidence and Alert Orchestration

**Files:**
- Create: `apps/afria-industrial/backend/app/services/evidence.py`
- Create: `apps/afria-industrial/backend/app/services/alerts.py`
- Create: `apps/afria-industrial/backend/app/api/evidence.py`
- Test: `apps/afria-industrial/backend/tests/test_evidence_alerts.py`

**Interfaces:**
- Produces `EvidenceService.append(event_type, actor, scope, payload, source_refs) -> EvidenceRecord`.
- Produces `EvidenceService.verify_chain() -> bool`.
- Alert acknowledgement and evidence append share one transaction.

- [ ] **Step 1: Write failing tamper test**

```python
def test_evidence_chain_detects_tampering(evidence_service, connection):
    evidence_service.append('ASSET_REGISTERED', 'engineer', {'asset_id': 'a1'}, {'asset_id': 'a1'}, [])
    evidence_service.append('ALERT_ACKNOWLEDGED', 'operator', {'alert_id': 'x'}, {'alert_id': 'x'}, [])
    assert evidence_service.verify_chain() is True
    connection.execute("UPDATE evidence SET output_hash='tampered' WHERE sequence=1")
    connection.commit()
    assert evidence_service.verify_chain() is False
```

- [ ] **Step 2: Verify RED**

```bash
python -m pytest tests/test_evidence_alerts.py -v
```

- [ ] **Step 3: Implement canonical SHA-256 chaining**

Canonical serialization uses `json.dumps(payload, sort_keys=True, separators=(',', ':'))`; next hash includes previous output hash. Public service exposes no update/delete.

- [ ] **Step 4: Implement alert creation and acknowledgement transaction**

Acknowledge changes state to `ACKNOWLEDGED`, captures actor/time, and appends evidence atomically.

- [ ] **Step 5: Verify GREEN and commit**

```bash
python -m pytest tests/test_evidence_alerts.py -v
git add apps/afria-industrial/backend/app/services/evidence.py apps/afria-industrial/backend/app/services/alerts.py apps/afria-industrial/backend/app/api/evidence.py apps/afria-industrial/backend/tests/test_evidence_alerts.py
git commit -m "feat(industrial): add evidence chain and alert workflow"
```

---

### Task 8: Implement Readiness Assessment™

**Files:**
- Create: `apps/afria-industrial/backend/app/domain/readiness.py`
- Create: `apps/afria-industrial/backend/app/api/readiness.py`
- Test: `apps/afria-industrial/backend/tests/test_readiness.py`

**Interfaces:**
- Produces exactly twelve spec dimensions.
- Produces `score_readiness(inputs) -> ReadinessAssessment`.

- [ ] **Step 1: Write failing evidence-confidence test**

```python
from app.domain.readiness import DimensionInput, score_dimension


def test_observed_evidence_has_higher_confidence_than_declared():
    observed = score_dimension(DimensionInput(80, 'OBSERVED', []))
    declared = score_dimension(DimensionInput(80, 'DECLARED', []))
    assert observed.confidence > declared.confidence
```

- [ ] **Step 2: Verify RED**

```bash
python -m pytest tests/test_readiness.py -v
```

- [ ] **Step 3: Implement exact dimension keys**

```text
asset_visibility
instrumentation_coverage
protocol_interoperability
data_quality
ot_network_resilience
cybersecurity_baseline
maintenance_maturity
energy_production_observability
edge_offline_readiness
governance_sovereignty
skills_operating_ownership
business_case_readiness
```

Each result contains score, confidence, evidence status, gaps, risk, recommended action, implementation horizon.

- [ ] **Step 4: Persist assessment and append evidence**

- [ ] **Step 5: Verify GREEN and commit**

```bash
python -m pytest tests/test_readiness.py -v
git add apps/afria-industrial/backend/app/domain/readiness.py apps/afria-industrial/backend/app/api/readiness.py apps/afria-industrial/backend/tests/test_readiness.py
git commit -m "feat(industrial): add readiness assessment engine"
```

---

### Task 9: Add API-Key Authentication, RBAC, Rate Limiting, and Secure HTTP Defaults

**Files:**
- Create: `apps/afria-industrial/backend/app/core/security.py`
- Create: `apps/afria-industrial/backend/app/core/rate_limit.py`
- Test: `apps/afria-industrial/backend/tests/test_security.py`
- Modify: `apps/afria-industrial/backend/app/core/config.py`
- Modify: `apps/afria-industrial/backend/app/main.py`
- Modify: all mutating routers.

**Interfaces:**
- Produces `Principal(key_id: str, role: str)`.
- Produces `require_role(*roles)`.
- Produces `FixedWindowRateLimiter(max_requests: int, window_seconds: int)`.
- Env format: `AFRIA_INDUSTRIAL_API_KEYS=viewer1:viewer:secret1,engineer1:engineer:secret2`.

- [ ] **Step 1: Write failing RBAC tests**

```python
def test_viewer_cannot_mutate_assets(client, asset_payload):
    assert client.post('/assets', json=asset_payload, headers={'X-API-Key': 'viewer-secret'}).status_code == 403


def test_engineer_can_mutate_assets(client, asset_payload):
    assert client.post('/assets', json=asset_payload, headers={'X-API-Key': 'engineer-secret'}).status_code == 201
```

- [ ] **Step 2: Write failing rate-limit test**

```python
def test_mutation_rate_limit_returns_429(client, asset_payload):
    headers = {'X-API-Key': 'engineer-secret'}
    for i in range(10):
        client.post('/assets', json={**asset_payload, 'asset_id': f'a{i}'}, headers=headers)
    assert client.post('/assets', json={**asset_payload, 'asset_id': 'overflow'}, headers=headers).status_code == 429
```

- [ ] **Step 3: Verify RED**

```bash
python -m pytest tests/test_security.py -v
```

- [ ] **Step 4: Implement constant-time secret comparison and role levels**

```python
ROLE_LEVEL = {'viewer': 10, 'operator': 20, 'engineer': 30, 'admin': 40}
```

Use `hmac.compare_digest`; never place raw API keys in logs, evidence, responses, or frontend bundles.

- [ ] **Step 5: Implement fixed-window proof limiter and secure CORS**

Limiter key = principal `key_id` + route. Default mutation policy = 10 requests / 60 seconds in proof mode. CORS origins come only from configured allowlist; credentials default false.

- [ ] **Step 6: Add no-actuation OpenAPI test**

```python
def test_openapi_exposes_no_machine_control_paths(client):
    paths = client.get('/openapi.json').json()['paths']
    forbidden = ('write', 'actuate', 'command', 'plc/set', 'pac/set')
    assert not any(any(token in path.lower() for token in forbidden) for path in paths)
```

- [ ] **Step 7: Verify GREEN and commit**

```bash
python -m pytest tests/test_security.py -v
git add apps/afria-industrial/backend/app/core apps/afria-industrial/backend/app/main.py apps/afria-industrial/backend/app/api apps/afria-industrial/backend/tests/test_security.py
git commit -m "feat(industrial): enforce authentication rbac and api limits"
```

---

### Task 10: Implement Sovereign Offline Queue and Mock Upstream Replay

**Files:**
- Create: `apps/afria-industrial/backend/app/services/sync.py`
- Create: `apps/afria-industrial/backend/app/api/sync.py`
- Test: `apps/afria-industrial/backend/tests/test_sync.py`

**Interfaces:**
- Produces `SyncEnvelope(event_id, destination, purpose, data_class, retention, authority, encryption_state, payload)`.
- Produces `MockUpstreamTransport(available: bool)`.
- Produces `SyncService.enqueue`, `replay`, `status`.

- [ ] **Step 1: Write failing outage/replay test**

```python
def test_queue_replays_in_order(sync_service, transport, envelope_factory):
    transport.available = False
    sync_service.enqueue(envelope_factory('e1', {'n': 1}))
    sync_service.enqueue(envelope_factory('e2', {'n': 2}))
    assert sync_service.status().mode == 'OFFLINE_EDGE'
    transport.available = True
    result = sync_service.replay()
    assert result.sent_event_ids == ['e1', 'e2']
    assert sync_service.status().queue_depth == 0
```

- [ ] **Step 2: Write failing metadata-conflict test**

```python
def test_same_event_id_with_different_payload_is_conflict(sync_service, envelope_factory):
    sync_service.enqueue(envelope_factory('e1', {'n': 1}))
    result = sync_service.enqueue(envelope_factory('e1', {'n': 2}))
    assert result.status == 'CONFLICT'
```

- [ ] **Step 3: Verify RED**

```bash
python -m pytest tests/test_sync.py -v
```

- [ ] **Step 4: Implement state machine**

`OFFLINE_EDGE`: upstream unavailable and local runtime healthy. `DEGRADED`: partial/local subsystem failure. `ONLINE`: upstream healthy and no blocked replay. Identical duplicate event IDs are idempotent; different payload for same ID returns conflict.

- [ ] **Step 5: Append evidence for outage/recovery/replay and commit**

```bash
python -m pytest tests/test_sync.py -v
git add apps/afria-industrial/backend/app/services/sync.py apps/afria-industrial/backend/app/api/sync.py apps/afria-industrial/backend/tests/test_sync.py
git commit -m "feat(industrial): add sovereign offline queue and replay"
```

---

### Task 11: Compose Complete API, Registry Routes, Analytics Routes, and Operational Metrics

**Files:**
- Create: `apps/afria-industrial/backend/app/api/assets.py`
- Create: `apps/afria-industrial/backend/app/api/analytics.py`
- Create: `apps/afria-industrial/backend/app/core/observability.py`
- Test: `apps/afria-industrial/backend/tests/test_api_contract.py`
- Modify: `apps/afria-industrial/backend/app/api/health.py`
- Modify: `apps/afria-industrial/backend/app/main.py`

**Interfaces:**
- Required spec paths plus additive `GET /system/metrics`.

- [ ] **Step 1: Write failing OpenAPI path test**

```python
REQUIRED = {
    '/health/live', '/health/ready', '/system/mode', '/sites', '/lines', '/assets',
    '/telemetry/batch', '/telemetry', '/kpis/site/{site_id}', '/kpis/line/{line_id}',
    '/kpis/asset/{asset_id}', '/anomalies', '/alerts', '/alerts/{alert_id}/acknowledge',
    '/readiness/assessments', '/readiness/assessments/{assessment_id}', '/evidence', '/sync/status'
}


def test_required_paths_exist(client):
    assert REQUIRED <= set(client.get('/openapi.json').json()['paths'])
```

- [ ] **Step 2: Write failing readiness-health test**

```python
def test_ready_fails_when_evidence_chain_is_invalid(client, tamper_evidence):
    tamper_evidence()
    assert client.get('/health/ready').status_code == 503
```

- [ ] **Step 3: Verify RED**

```bash
python -m pytest tests/test_api_contract.py -v
```

- [ ] **Step 4: Implement registry and KPI routes**

KPI responses include value, components, source completeness, data quality, denominator validity, calculation period, evidence refs.

- [ ] **Step 5: Implement operational counters**

Expose JSON counters for ingestion accepted/rejected, telemetry freshness, anomaly count by severity, alert backlog, sync queue depth, persistence errors, adapter health, system mode, evidence integrity.

- [ ] **Step 6: Make `/health/ready` depend on database accessibility and evidence-chain integrity**

Live remains process-only. Ready returns 503 on unavailable database or invalid evidence chain.

- [ ] **Step 7: Verify GREEN and commit**

```bash
python -m pytest -v
git add apps/afria-industrial/backend/app apps/afria-industrial/backend/tests/test_api_contract.py
git commit -m "feat(industrial): compose complete api and operational health"
```

---

### Task 12: Build React/Vite Cockpit with Provenance and Staleness Safety

**Files:**
- Create: frontend toolchain files.
- Create: `src/api/client.ts`, `src/domain/types.ts`, `src/App.tsx`.
- Create feature components under `src/features/{overview,assets,alerts,readiness,system}/`.
- Test corresponding `*.test.tsx` files.

**Interfaces:**
- Consumes read APIs and alert acknowledgement.
- API key is injected at runtime, not source-controlled.

- [ ] **Step 1: Create package and failing simulation-banner test**

```tsx
import { render, screen } from '@testing-library/react';
import { SystemBanner } from './SystemBanner';

test('simulated source is unmistakably labelled', () => {
  render(<SystemBanner mode="ONLINE" source="SIMULATOR" />);
  expect(screen.getByText(/simulation/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify RED**

```bash
cd apps/afria-industrial/frontend
npm install
npm test -- --run
```

- [ ] **Step 3: Implement typed client and system banner**

Client reads API base URL and proof key from runtime environment/injected configuration. Do not commit a secret value.

- [ ] **Step 4: Implement required views**

Site Overview, Line/Process, Asset, Alerts, Energy & Yield, Readiness, System State. Every view has loading, empty, error, and stale-data states.

- [ ] **Step 5: Add stale-data safety test**

```tsx
test('stale telemetry is never labelled live', () => {
  render(<TelemetryStatus quality="STALE" />);
  expect(screen.queryByText(/^live$/i)).not.toBeInTheDocument();
  expect(screen.getByText(/stale/i)).toBeInTheDocument();
});
```

- [ ] **Step 6: Verify typecheck/tests/build and commit**

```bash
npm run typecheck
npm test -- --run
npm run build
git add apps/afria-industrial/frontend
git commit -m "feat(industrial): add operator cockpit"
```

---

### Task 13: Containerize Proof Runtime and Add Dedicated CI

**Files:**
- Create: `apps/afria-industrial/backend/Dockerfile`
- Create: `apps/afria-industrial/frontend/Dockerfile`
- Create: `apps/afria-industrial/docker-compose.yml`
- Create: `apps/afria-industrial/.env.example`
- Create: `.github/workflows/afria-industrial-proof.yml`
- Test: `apps/afria-industrial/backend/tests/test_operational_contract.py`

**Interfaces:**
- Local start: `docker compose up --build`.
- SQLite persists on mounted volume.

- [ ] **Step 1: Write failing no-secret config test**

```python
from pathlib import Path


def test_env_example_contains_no_real_secret():
    text = Path('../.env.example').read_text()
    assert 'change-me' in text
    assert 'sk-' not in text
```

- [ ] **Step 2: Implement backend/frontend Dockerfiles**

Backend base `python:3.12-slim`. Frontend uses Node build stage and static serving stage.

- [ ] **Step 3: Implement compose health and persistence**

Backend healthcheck hits `/health/ready`; frontend depends on backend health. Simulator is explicitly enabled for demo mode. Persist `./data` or named volume.

- [ ] **Step 4: Implement GitHub Actions workflow**

Workflow triggers on changes under `apps/afria-industrial/**` and plan/spec files. Jobs: backend pytest, frontend typecheck/test/build, grep no-actuation, Docker build. Use `actions/checkout@v4`, `actions/setup-python@v5`, `actions/setup-node@v4`.

- [ ] **Step 5: Smoke test locally**

```bash
cd apps/afria-industrial
docker compose build
docker compose up -d
curl --fail http://localhost:8000/health/ready
docker compose ps
docker compose down
```

- [ ] **Step 6: Commit**

```bash
git add apps/afria-industrial .github/workflows/afria-industrial-proof.yml
git commit -m "build(industrial): add proof containers and ci"
```

---

### Task 14: Prove Failure Modes, Throughput Target, and Full Acceptance Loop

**Files:**
- Create: `apps/afria-industrial/backend/tests/test_failure_modes.py`
- Create: `apps/afria-industrial/backend/tests/test_acceptance.py`
- Create: `apps/afria-industrial/acceptance/scenarios/demo_factory.py`
- Create: `apps/afria-industrial/acceptance/run_acceptance.sh`

**Interfaces:**
- Produces evidence required to permit `TEST_PROVEN` after gate review.

- [ ] **Step 1: Add stale-source service-level test**

```python
def test_stale_source_is_not_live(telemetry_service, stale_point):
    telemetry_service.ingest_batch('stale', [stale_point])
    state = telemetry_service.source_state(stale_point.asset_id)
    assert state.data_state == 'STALE'
    assert state.live is False
```

- [ ] **Step 2: Add failure-mode tests**

Explicitly cover malformed payload, duplicate batch, upstream outage/recovery, SQLite lock/recovery, clock skew, simulator exception, evidence tampering.

- [ ] **Step 3: Add local 100-points/second proof benchmark**

```python
import time


def test_acceptance_environment_ingests_100_points_per_second(telemetry_service, hundred_points):
    started = time.perf_counter()
    result = telemetry_service.ingest_batch('perf-100', hundred_points)
    elapsed = time.perf_counter() - started
    assert result.accepted == 100
    assert elapsed < 1.0
```

This is a proof-environment target, not a contractual SLA.

- [ ] **Step 4: Write full acceptance test**

Acceptance flow must:
1. seed site/line/motor/pump/conveyor;
2. ingest simulator telemetry;
3. calculate OEE/MTBF/MTTR/energy;
4. detect declared injected anomaly within its expected window;
5. create explainable alert;
6. verify evidence chain;
7. disable mock upstream;
8. continue local analytics in `OFFLINE_EDGE`;
9. re-enable upstream and replay in order;
10. generate readiness assessment;
11. verify simulation provenance remains visible.

- [ ] **Step 5: Run complete backend/frontend/container verification**

```bash
cd apps/afria-industrial/backend && python -m pytest -v
cd ../frontend && npm run typecheck && npm test -- --run && npm run build
cd .. && docker compose build
```

- [ ] **Step 6: Commit**

```bash
git add apps/afria-industrial/backend/tests apps/afria-industrial/acceptance
git commit -m "test(industrial): prove failure modes and acceptance loop"
```

---

### Task 15: Produce Operator Docs, OT Threat Model, Rollback, and M6/S7+/M8 Pack

**Files:**
- Create: `apps/afria-industrial/README.md`
- Create: `apps/afria-industrial/docs/architecture.md`
- Create: `apps/afria-industrial/docs/threat-model-ot.md`
- Create: `apps/afria-industrial/docs/readiness-assessment.md`
- Create: `apps/afria-industrial/docs/runbook.md`
- Create: `apps/afria-industrial/docs/rollback.md`
- Create: `apps/afria-industrial/docs/evidence-model.md`
- Create: `apps/afria-industrial/docs/m8-release-evidence.md`

**Interfaces:**
- Produces reviewable release evidence; no truth-state promotion is automatic.

- [ ] **Step 1: Write README release truth**

It must contain exactly these statements:

```text
Release truth: simulator-backed proof only.
Maximum allowed state after passing acceptance: TEST_PROVEN.
This release contains no machine actuation capability.
```

- [ ] **Step 2: Document threat model**

Cover API-key abuse, telemetry spoofing, replay, stale data, compromised edge host, evidence tampering, adapter compromise, data exfiltration, and explicit absence of actuation.

- [ ] **Step 3: Document sovereignty and readiness evidence rules**

For every outbound data class document destination, purpose, retention, authority, encryption state. Readiness docs distinguish OBSERVED, DECLARED, ASSUMED.

- [ ] **Step 4: Document runbook and rollback**

Runbook: start/stop, health, mode, metrics, queue, evidence verification, backup, restore, outage simulation, recovery. Rollback: image/tag rollback plus SQLite backup restore and integrity verification.

- [ ] **Step 5: Build M6/S7+/M8 evidence matrix**

Each row is `PASS`, `FAIL`, or `NOT_RUN` with exact command/evidence reference. M8 remains `NOT_RUN` until reviewed; no file may self-promote the release.

- [ ] **Step 6: Scan placeholders and prohibited control paths**

```bash
! grep -RniE 'TODO|TBD' apps/afria-industrial
! grep -RniE 'def (write|actuate|command)|/write|/actuate|/command|/plc/set|/pac/set' apps/afria-industrial/backend/app
```

- [ ] **Step 7: Run final verification and commit docs**

```bash
cd apps/afria-industrial/backend && python -m pytest -v
cd ../frontend && npm run typecheck && npm test -- --run && npm run build
cd .. && docker compose build
git add apps/afria-industrial/README.md apps/afria-industrial/docs
git commit -m "docs(industrial): add release controls and evidence pack"
```

---

## Final Verification Gate

Run from repository root:

```bash
cd apps/afria-industrial/backend
python -m pytest -v
cd ../frontend
npm run typecheck
npm test -- --run
npm run build
cd ..
docker compose build
docker compose up -d
curl --fail http://localhost:8000/health/ready
curl --fail http://localhost:8000/system/metrics
docker compose ps
docker compose down
```

Then:

```bash
! grep -RniE 'TODO|TBD' apps/afria-industrial
! grep -RniE 'def (write|actuate|command)|/write|/actuate|/command|/plc/set|/pac/set' apps/afria-industrial/backend/app
```

Only after all tests, frontend verification, Docker build, healthcheck, throughput proof, acceptance loop, evidence-chain verification, security controls, and human M6/S7+/M8 review are green may catalogue truth advance to `TEST_PROVEN`. `PRODUCTION_PROVEN` remains forbidden until a real site-specific deployment and review exist.
