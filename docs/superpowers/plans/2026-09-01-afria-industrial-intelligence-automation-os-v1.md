# AfrIA Industrial Intelligence & Automation OS™ v1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only, offline-first industrial intelligence proof runtime that registers assets, ingests deterministic telemetry, computes industrial KPIs, detects explainable anomalies, produces readiness assessments, preserves tamper-evident evidence, and demonstrates the full flow in a React cockpit.

**Architecture:** Implement `apps/afria-industrial/` as a modular monolith. The backend is Python 3.12 + FastAPI + Pydantic with SQLite WAL behind repository interfaces; the frontend is React + TypeScript + Vite; simulator and protocol adapters feed one normalized read-only ingestion contract. All machine-control write paths are excluded.

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2, Uvicorn, pytest, httpx, SQLite WAL, React, TypeScript, Vite, Vitest, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-01-afria-industrial-intelligence-automation-os-v1-design.md`

## Global Constraints

- Canonical asset: `CAP-IND-AUTOMATION-001` under V4-DEC-030.
- Runtime lives in `apps/afria-industrial/` inside `lanickbusiness1/newlife`.
- Backend is Python 3.12 + FastAPI + Pydantic v2.
- Persistence for v1.0 proof is SQLite in WAL mode behind repository interfaces.
- Frontend is React + TypeScript + Vite.
- Proof authentication uses API keys from environment variables mapped to roles.
- Roles are `viewer`, `operator`, `engineer`, `admin`.
- No PLC/PAC/robot write-back method or endpoint may exist.
- Simulator data must always be labelled as simulated.
- Evidence ledger is append-only through the public API and tamper-evident via hash chaining.
- Core local operation must not require an external cloud dependency.
- Allowed release progression: `ARCHITECTURE → BUILDING → TEST_PROVEN → STAGING_READY → PILOT_READY → site-specific review → PRODUCTION_PROVEN`.
- Simulation-only evidence may never produce `PRODUCTION_PROVEN`, `DEPLOYED`, or `DELIVERED_*` claims.

---

## File Map

### Backend

- `apps/afria-industrial/backend/app/main.py` — FastAPI composition root.
- `apps/afria-industrial/backend/app/core/config.py` — environment configuration and proof API-key role mapping.
- `apps/afria-industrial/backend/app/core/security.py` — authentication/RBAC dependencies.
- `apps/afria-industrial/backend/app/domain/models.py` — immutable domain dataclasses/enums.
- `apps/afria-industrial/backend/app/domain/kpi.py` — KPI pure functions.
- `apps/afria-industrial/backend/app/domain/anomaly.py` — anomaly pure functions.
- `apps/afria-industrial/backend/app/domain/readiness.py` — readiness scoring pure functions.
- `apps/afria-industrial/backend/app/persistence/sqlite.py` — SQLite WAL connection/schema bootstrap.
- `apps/afria-industrial/backend/app/persistence/repositories.py` — repository implementations.
- `apps/afria-industrial/backend/app/services/telemetry.py` — ingestion/idempotency/data-quality orchestration.
- `apps/afria-industrial/backend/app/services/evidence.py` — evidence hash chain.
- `apps/afria-industrial/backend/app/services/alerts.py` — anomaly-to-alert orchestration.
- `apps/afria-industrial/backend/app/services/sync.py` — offline queue and mock upstream replay.
- `apps/afria-industrial/backend/app/adapters/contracts.py` — read-only adapter protocol.
- `apps/afria-industrial/backend/app/adapters/simulator.py` — simulator adapter.
- `apps/afria-industrial/backend/app/adapters/mqtt.py` — read-only reference stub/provider boundary.
- `apps/afria-industrial/backend/app/adapters/opcua.py` — read-only reference stub/provider boundary.
- `apps/afria-industrial/backend/app/api/*.py` — focused routers for health, assets, telemetry, analytics, readiness, evidence, sync.
- `apps/afria-industrial/backend/tests/*.py` — unit/integration/security/acceptance tests.

### Simulator

- `apps/afria-industrial/simulator/generator/scenarios.py` — deterministic scenario definitions.
- `apps/afria-industrial/simulator/generator/engine.py` — fixed-seed telemetry generation.
- `apps/afria-industrial/simulator/scenarios/default_factory.json` — initial synthetic plant topology.
- `apps/afria-industrial/simulator/tests/test_engine.py` — reproducibility and fault-window tests.

### Frontend

- `apps/afria-industrial/frontend/src/api/client.ts` — typed backend client.
- `apps/afria-industrial/frontend/src/domain/types.ts` — shared frontend types.
- `apps/afria-industrial/frontend/src/App.tsx` — cockpit shell and routing tabs.
- `apps/afria-industrial/frontend/src/features/overview/*` — site/fleet overview.
- `apps/afria-industrial/frontend/src/features/assets/*` — line/asset views.
- `apps/afria-industrial/frontend/src/features/alerts/*` — anomaly/alert UI.
- `apps/afria-industrial/frontend/src/features/readiness/*` — readiness UI.
- `apps/afria-industrial/frontend/src/features/system/*` — online/degraded/offline state and simulation banner.
- `apps/afria-industrial/frontend/src/**/*.test.tsx` — component tests.

### Operations / Docs

- `apps/afria-industrial/docker-compose.yml` — proof stack.
- `apps/afria-industrial/backend/Dockerfile` — backend image.
- `apps/afria-industrial/frontend/Dockerfile` — frontend image.
- `apps/afria-industrial/README.md` — operator quickstart and release truth.
- `apps/afria-industrial/docs/architecture.md` — deployed proof architecture.
- `apps/afria-industrial/docs/threat-model-ot.md` — S7+ threat model.
- `apps/afria-industrial/docs/readiness-assessment.md` — scoring contract.
- `apps/afria-industrial/docs/runbook.md` — start/stop/diagnostics/recovery.
- `apps/afria-industrial/docs/rollback.md` — rollback procedure.
- `apps/afria-industrial/docs/evidence-model.md` — ledger contract.
- `apps/afria-industrial/docs/m8-release-evidence.md` — M6/S7+/M8 proof pack.

---

### Task 1: Bootstrap the Industrial Backend and Health Contract

**Files:**
- Create: `apps/afria-industrial/backend/requirements.txt`
- Create: `apps/afria-industrial/backend/app/__init__.py`
- Create: `apps/afria-industrial/backend/app/core/config.py`
- Create: `apps/afria-industrial/backend/app/main.py`
- Create: `apps/afria-industrial/backend/tests/test_health.py`

**Interfaces:**
- Produces: `Settings`, `create_app() -> FastAPI`, `GET /health/live`, `GET /health/ready`, `GET /system/mode`.
- System modes: `ONLINE`, `DEGRADED`, `OFFLINE_EDGE`.

- [ ] **Step 1: Write the failing health tests**

```python
from fastapi.testclient import TestClient
from app.main import create_app


def test_live_and_ready_health_contract():
    client = TestClient(create_app())
    assert client.get('/health/live').json() == {'status': 'ok'}
    assert client.get('/health/ready').status_code == 200


def test_system_mode_defaults_to_online():
    client = TestClient(create_app())
    assert client.get('/system/mode').json() == {'mode': 'ONLINE', 'source': 'local'}
```

- [ ] **Step 2: Run the tests and confirm failure**

Run:

```bash
cd apps/afria-industrial/backend
python -m pytest tests/test_health.py -v
```

Expected: FAIL because `app.main` does not exist.

- [ ] **Step 3: Add the minimum runtime dependencies**

`requirements.txt`:

```text
fastapi>=0.115.0,<1.0
pydantic>=2.8.0,<3.0
pydantic-settings>=2.4.0,<3.0
uvicorn>=0.30.0,<1.0
pytest>=8.2.0,<9.0
httpx>=0.27.0,<1.0
```

- [ ] **Step 4: Implement config and FastAPI bootstrap**

`app/core/config.py`:

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix='AFRIA_INDUSTRIAL_', extra='ignore')
    database_path: str = './data/industrial.db'
    system_mode: str = 'ONLINE'
```

`app/main.py`:

```python
from fastapi import FastAPI
from app.core.config import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    cfg = settings or Settings()
    app = FastAPI(title='AfrIA Industrial Intelligence & Automation OS', version='0.1.0')

    @app.get('/health/live')
    def live() -> dict[str, str]:
        return {'status': 'ok'}

    @app.get('/health/ready')
    def ready() -> dict[str, str]:
        return {'status': 'ready'}

    @app.get('/system/mode')
    def system_mode() -> dict[str, str]:
        return {'mode': cfg.system_mode, 'source': 'local'}

    return app


app = create_app()
```

- [ ] **Step 5: Run the tests and commit**

```bash
python -m pytest tests/test_health.py -v
git add apps/afria-industrial/backend
git commit -m "feat(industrial): bootstrap backend health contract"
```

Expected: PASS.

---

### Task 2: Define the Domain Model and SQLite WAL Persistence

**Files:**
- Create: `apps/afria-industrial/backend/app/domain/models.py`
- Create: `apps/afria-industrial/backend/app/persistence/sqlite.py`
- Create: `apps/afria-industrial/backend/app/persistence/repositories.py`
- Create: `apps/afria-industrial/backend/tests/test_persistence.py`

**Interfaces:**
- Produces: `Site`, `Line`, `Asset`, `TelemetryPoint`, `Anomaly`, `Alert`, `EvidenceRecord`.
- Produces: `connect_sqlite(path: str) -> sqlite3.Connection`.
- Produces repositories with `create_*`, `list_*`, `insert_telemetry`, `get_telemetry`.

- [ ] **Step 1: Write failing persistence tests**

```python
from app.domain.models import Site, Asset
from app.persistence.sqlite import connect_sqlite, initialize_schema
from app.persistence.repositories import AssetRepository, SiteRepository


def test_sqlite_runs_in_wal_and_persists_asset(tmp_path):
    db = tmp_path / 'industrial.db'
    conn = connect_sqlite(str(db))
    initialize_schema(conn)
    assert conn.execute('PRAGMA journal_mode').fetchone()[0].lower() == 'wal'

    sites = SiteRepository(conn)
    assets = AssetRepository(conn)
    sites.create(Site(site_id='site-1', name='Demo', country='BJ', timezone='Africa/Porto-Novo', industry='agro', operating_status='active', data_residency_policy='local'))
    assets.create(Asset(asset_id='motor-1', site_id='site-1', line_id='line-1', asset_type='motor', manufacturer='Synthetic', model='M1', criticality='high', commissioning_date=None, protocol_profile='simulator', status='online'))
    assert assets.list_all()[0].asset_id == 'motor-1'
```

- [ ] **Step 2: Run test and verify failure**

```bash
python -m pytest tests/test_persistence.py -v
```

Expected: FAIL because domain and persistence modules are missing.

- [ ] **Step 3: Implement exact domain types**

Use frozen dataclasses/enums so pure engines cannot mutate domain inputs. Example:

```python
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

Quality = Literal['GOOD', 'STALE', 'INVALID', 'SUSPECT']

@dataclass(frozen=True)
class Site:
    site_id: str
    name: str
    country: str
    timezone: str
    industry: str
    operating_status: str
    data_residency_policy: str

@dataclass(frozen=True)
class Asset:
    asset_id: str
    site_id: str
    line_id: str
    asset_type: str
    manufacturer: str
    model: str
    criticality: str
    commissioning_date: str | None
    protocol_profile: str
    status: str
```

Define the remaining types using the exact property names from the spec.

- [ ] **Step 4: Implement WAL connection and schema bootstrap**

```python
import sqlite3


def connect_sqlite(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA foreign_keys=ON')
    return conn
```

Schema must create focused tables for `sites`, `lines`, `assets`, `telemetry`, `anomalies`, `alerts`, `evidence`, and `sync_queue` with primary keys and unique idempotency keys.

- [ ] **Step 5: Implement repositories and run tests**

Repository methods must map rows explicitly back to domain types. No business calculation may exist in repositories.

```bash
python -m pytest tests/test_persistence.py -v
git add apps/afria-industrial/backend/app/domain apps/afria-industrial/backend/app/persistence apps/afria-industrial/backend/tests/test_persistence.py
git commit -m "feat(industrial): add domain model and sqlite persistence"
```

Expected: PASS.

---

### Task 3: Implement the Pure KPI Engine

**Files:**
- Create: `apps/afria-industrial/backend/app/domain/kpi.py`
- Create: `apps/afria-industrial/backend/tests/test_kpi.py`

**Interfaces:**
- Produces: `KpiResult`.
- Produces: `calculate_oee(planned_minutes, run_minutes, actual_output, theoretical_output, good_units, total_units) -> KpiResult`.
- Produces: `calculate_mtbf(operating_minutes, failures) -> KpiResult`.
- Produces: `calculate_mttr(repair_minutes, repairs) -> KpiResult`.
- Produces: `calculate_energy_per_unit(kwh, good_units) -> KpiResult`.

- [ ] **Step 1: Write failing formula and denominator tests**

```python
import pytest
from app.domain.kpi import calculate_energy_per_unit, calculate_oee


def test_oee_exposes_factors_and_product():
    result = calculate_oee(480, 420, 800, 840, 760, 800)
    assert round(result.availability, 4) == 0.875
    assert round(result.performance, 4) == round(800 / 840, 4)
    assert round(result.quality, 4) == 0.95
    assert round(result.value, 4) == round(0.875 * (800 / 840) * 0.95, 4)


def test_energy_per_unit_rejects_zero_good_units():
    with pytest.raises(ValueError, match='good_units must be > 0'):
        calculate_energy_per_unit(25.0, 0)
```

- [ ] **Step 2: Verify failure**

```bash
python -m pytest tests/test_kpi.py -v
```

- [ ] **Step 3: Implement pure functions**

Use one immutable `KpiResult` with `value`, `data_quality`, `denominator_valid`, `components`, and `evidence_refs`. Raise `ValueError` on invalid denominators; never coerce invalid formulas to zero.

- [ ] **Step 4: Add MTBF/MTTR edge tests and pass all KPI tests**

```bash
python -m pytest tests/test_kpi.py -v
git add apps/afria-industrial/backend/app/domain/kpi.py apps/afria-industrial/backend/tests/test_kpi.py
git commit -m "feat(industrial): add deterministic KPI engine"
```

Expected: PASS.

---

### Task 4: Build the Deterministic Industrial Simulator

**Files:**
- Create: `apps/afria-industrial/simulator/generator/scenarios.py`
- Create: `apps/afria-industrial/simulator/generator/engine.py`
- Create: `apps/afria-industrial/simulator/scenarios/default_factory.json`
- Create: `apps/afria-industrial/simulator/tests/test_engine.py`
- Create: `apps/afria-industrial/backend/app/adapters/contracts.py`
- Create: `apps/afria-industrial/backend/app/adapters/simulator.py`

**Interfaces:**
- Produces: `ReadOnlyAdapter` protocol with `connect`, `health`, `discover_readable_points`, `read_batch`, `disconnect`.
- Produces: `ScenarioDefinition`, `TelemetrySample`, `generate_scenario(seed, scenario, points) -> list[TelemetrySample]`.

- [ ] **Step 1: Write failing reproducibility and fault-window tests**

```python
from generator.engine import generate_scenario
from generator.scenarios import bearing_temperature_drift


def test_same_seed_produces_identical_samples():
    a = generate_scenario(42, bearing_temperature_drift(), 120)
    b = generate_scenario(42, bearing_temperature_drift(), 120)
    assert a == b


def test_fault_begins_at_declared_index():
    samples = generate_scenario(42, bearing_temperature_drift(fault_index=60), 120)
    assert max(x.value for x in samples[:60]) < min(x.value for x in samples[90:])
```

- [ ] **Step 2: Verify failure**

```bash
cd apps/afria-industrial/simulator
python -m pytest tests/test_engine.py -v
```

- [ ] **Step 3: Implement scenarios with fixed seed and explicit fault metadata**

Implement these named scenario constructors exactly: `healthy_motor`, `bearing_temperature_drift`, `pump_cavitation`, `conveyor_microstops`, `energy_inefficiency_drift`, `quality_degradation`, `network_interruption`.

- [ ] **Step 4: Define the read-only adapter contract**

```python
from typing import Protocol

class ReadOnlyAdapter(Protocol):
    def connect(self) -> None: ...
    def health(self) -> dict[str, str]: ...
    def discover_readable_points(self) -> list[str]: ...
    def read_batch(self) -> list[dict]: ...
    def disconnect(self) -> None: ...
```

There must be no `write`, `set`, `command`, or `actuate` method.

- [ ] **Step 5: Implement simulator adapter and commit**

```bash
python -m pytest tests/test_engine.py -v
cd ../../backend
python -m pytest -v
git add apps/afria-industrial/simulator apps/afria-industrial/backend/app/adapters
git commit -m "feat(industrial): add deterministic simulator and read-only adapter contract"
```

Expected: all simulator/backend tests PASS.

---

### Task 5: Add Telemetry Ingestion, Idempotency, and Data Quality

**Files:**
- Create: `apps/afria-industrial/backend/app/services/telemetry.py`
- Create: `apps/afria-industrial/backend/app/api/telemetry.py`
- Create: `apps/afria-industrial/backend/tests/test_telemetry_ingestion.py`
- Modify: `apps/afria-industrial/backend/app/main.py`

**Interfaces:**
- Consumes: repository layer from Task 2.
- Produces: `TelemetryService.ingest_batch(batch_id: str, points: list[TelemetryPoint]) -> IngestionResult`.
- API: `POST /telemetry/batch`, `GET /telemetry`.

- [ ] **Step 1: Write failing ingestion tests**

```python
def test_duplicate_batch_is_idempotent(client, seeded_asset, telemetry_payload):
    first = client.post('/telemetry/batch', json=telemetry_payload, headers={'X-API-Key': 'engineer-key'})
    second = client.post('/telemetry/batch', json=telemetry_payload, headers={'X-API-Key': 'engineer-key'})
    assert first.status_code == 202
    assert second.status_code == 200
    assert second.json()['duplicate'] is True


def test_oversize_batch_rejected(client):
    payload = {'batch_id': 'x', 'points': [{'point_id': str(i), 'asset_id': 'a', 'metric': 'temp', 'unit': 'C', 'timestamp': '2026-09-01T00:00:00Z', 'value': 1, 'quality': 'GOOD', 'source': 'SIMULATOR', 'provenance_id': 'p'} for i in range(1001)]}
    assert client.post('/telemetry/batch', json=payload, headers={'X-API-Key': 'engineer-key'}).status_code == 413
```

- [ ] **Step 2: Verify failure**

```bash
python -m pytest tests/test_telemetry_ingestion.py -v
```

- [ ] **Step 3: Implement validation and batch-id idempotency**

Set `MAX_BATCH_POINTS = 1000`. Store receipt timestamp separately from event timestamp. Mark impossible/old/future timestamps `SUSPECT`; reject structurally invalid data with 422.

- [ ] **Step 4: Expose the router and pass tests**

```bash
python -m pytest tests/test_telemetry_ingestion.py -v
git add apps/afria-industrial/backend/app/services/telemetry.py apps/afria-industrial/backend/app/api/telemetry.py apps/afria-industrial/backend/app/main.py apps/afria-industrial/backend/tests/test_telemetry_ingestion.py
git commit -m "feat(industrial): add telemetry ingestion and data quality gates"
```

Expected: PASS.

---

### Task 6: Implement Explainable Anomalies, Alerts, and Tamper-Evident Evidence

**Files:**
- Create: `apps/afria-industrial/backend/app/domain/anomaly.py`
- Create: `apps/afria-industrial/backend/app/services/evidence.py`
- Create: `apps/afria-industrial/backend/app/services/alerts.py`
- Create: `apps/afria-industrial/backend/app/api/analytics.py`
- Create: `apps/afria-industrial/backend/app/api/evidence.py`
- Create: `apps/afria-industrial/backend/tests/test_anomaly_evidence.py`
- Modify: `apps/afria-industrial/backend/app/main.py`

**Interfaces:**
- Produces pure functions: `threshold_anomaly`, `rolling_zscore_anomaly`, `moving_average_deviation`, `rate_of_change_anomaly`, `staleness_anomaly`.
- Produces: `EvidenceService.append(...) -> EvidenceRecord`, `EvidenceService.verify_chain() -> bool`.
- API: `GET /anomalies`, `GET /alerts`, `POST /alerts/{alert_id}/acknowledge`, `GET /evidence`.

- [ ] **Step 1: Write failing anomaly explanation test**

```python
from app.domain.anomaly import rolling_zscore_anomaly


def test_zscore_anomaly_is_explainable():
    result = rolling_zscore_anomaly([10, 10, 11, 9, 10], observed=18, threshold=3.0)
    assert result.detected is True
    assert result.method == 'ROLLING_ZSCORE'
    assert 'baseline' in result.explanation.lower()
    assert result.deviation > 0
```

- [ ] **Step 2: Write failing hash-chain tamper test**

```python
def test_evidence_chain_detects_tampering(evidence_service, connection):
    evidence_service.append('ASSET_REGISTERED', 'engineer', {'asset_id': 'a1'})
    evidence_service.append('ALERT_ACKNOWLEDGED', 'operator', {'alert_id': 'x'})
    assert evidence_service.verify_chain() is True
    connection.execute("UPDATE evidence SET output_hash='tampered' WHERE sequence=1")
    connection.commit()
    assert evidence_service.verify_chain() is False
```

- [ ] **Step 3: Verify failures**

```bash
python -m pytest tests/test_anomaly_evidence.py -v
```

- [ ] **Step 4: Implement pure anomaly functions**

Every positive anomaly result must contain `method`, `baseline`, `observed_value`, `deviation`, `severity`, `explanation`, and `evidence_refs`.

- [ ] **Step 5: Implement SHA-256 evidence chain**

Hash canonical JSON using `sort_keys=True` and include previous record hash in the next input. The service must never expose a delete/update method.

- [ ] **Step 6: Implement alert orchestration and acknowledgement evidence**

Acknowledgement must update alert state and append an evidence record in one transaction.

- [ ] **Step 7: Run and commit**

```bash
python -m pytest tests/test_anomaly_evidence.py -v
git add apps/afria-industrial/backend/app/domain/anomaly.py apps/afria-industrial/backend/app/services/evidence.py apps/afria-industrial/backend/app/services/alerts.py apps/afria-industrial/backend/app/api/analytics.py apps/afria-industrial/backend/app/api/evidence.py apps/afria-industrial/backend/app/main.py apps/afria-industrial/backend/tests/test_anomaly_evidence.py
git commit -m "feat(industrial): add explainable anomalies alerts and evidence ledger"
```

Expected: PASS.

---

### Task 7: Implement Industrial Readiness Assessment™

**Files:**
- Create: `apps/afria-industrial/backend/app/domain/readiness.py`
- Create: `apps/afria-industrial/backend/app/api/readiness.py`
- Create: `apps/afria-industrial/backend/tests/test_readiness.py`
- Modify: `apps/afria-industrial/backend/app/main.py`

**Interfaces:**
- Produces twelve exact dimensions from the spec.
- Produces: `score_readiness(inputs: ReadinessInput) -> ReadinessAssessment`.
- API: `POST /readiness/assessments`, `GET /readiness/assessments/{assessment_id}`.

- [ ] **Step 1: Write failing evidence-vs-declaration scoring test**

```python
from app.domain.readiness import DimensionInput, score_dimension


def test_declared_data_is_scored_weaker_than_observed_evidence():
    observed = score_dimension(DimensionInput(score=80, evidence_status='OBSERVED', gaps=[]))
    declared = score_dimension(DimensionInput(score=80, evidence_status='DECLARED', gaps=[]))
    assert observed.confidence > declared.confidence
```

- [ ] **Step 2: Verify failure**

```bash
python -m pytest tests/test_readiness.py -v
```

- [ ] **Step 3: Implement the twelve dimensions**

Use exact keys:

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

Each dimension returns `score`, `confidence`, `evidence_status`, `gaps`, `risk`, `recommended_action`, `implementation_horizon`.

- [ ] **Step 4: Persist assessment, append evidence, and commit**

```bash
python -m pytest tests/test_readiness.py -v
git add apps/afria-industrial/backend/app/domain/readiness.py apps/afria-industrial/backend/app/api/readiness.py apps/afria-industrial/backend/app/main.py apps/afria-industrial/backend/tests/test_readiness.py
git commit -m "feat(industrial): add readiness assessment engine"
```

Expected: PASS.

---

### Task 8: Add API-Key Authentication and RBAC Boundaries

**Files:**
- Create: `apps/afria-industrial/backend/app/core/security.py`
- Create: `apps/afria-industrial/backend/tests/test_security.py`
- Modify: `apps/afria-industrial/backend/app/core/config.py`
- Modify routers with mutation dependencies.

**Interfaces:**
- Produces: `Principal(role, key_id)`.
- Produces: `require_role(*roles)` FastAPI dependency.
- Consumes env vars: `AFRIA_INDUSTRIAL_API_KEYS` formatted as comma-separated `key_id:role:secret` tuples.

- [ ] **Step 1: Write failing role tests**

```python
def test_viewer_cannot_create_asset(client):
    response = client.post('/assets', json={'asset_id': 'a1'}, headers={'X-API-Key': 'viewer-secret'})
    assert response.status_code == 403


def test_engineer_can_create_asset(client, valid_asset_payload):
    response = client.post('/assets', json=valid_asset_payload, headers={'X-API-Key': 'engineer-secret'})
    assert response.status_code == 201
```

- [ ] **Step 2: Verify failure**

```bash
python -m pytest tests/test_security.py -v
```

- [ ] **Step 3: Implement constant-time API-key comparison and role ordering**

Use `hmac.compare_digest`. Never return raw secrets in principals, logs, evidence, or errors.

Role ordering:

```python
ROLE_LEVEL = {'viewer': 10, 'operator': 20, 'engineer': 30, 'admin': 40}
```

- [ ] **Step 4: Protect all mutations and add “no actuation route” test**

```python
def test_openapi_contains_no_actuation_paths(client):
    paths = client.get('/openapi.json').json()['paths']
    forbidden = ('write', 'actuate', 'command', 'plc/set')
    assert not any(any(token in path.lower() for token in forbidden) for path in paths)
```

- [ ] **Step 5: Run and commit**

```bash
python -m pytest tests/test_security.py -v
git add apps/afria-industrial/backend/app/core apps/afria-industrial/backend/app/api apps/afria-industrial/backend/tests/test_security.py
git commit -m "feat(industrial): enforce proof authentication and rbac"
```

Expected: PASS.

---

### Task 9: Implement Offline Queue, Mock Upstream, and Replay Semantics

**Files:**
- Create: `apps/afria-industrial/backend/app/services/sync.py`
- Create: `apps/afria-industrial/backend/app/api/sync.py`
- Create: `apps/afria-industrial/backend/tests/test_sync.py`
- Modify: `apps/afria-industrial/backend/app/main.py`

**Interfaces:**
- Produces: `SyncTransport.send(event_id: str, payload: dict) -> SyncResult`.
- Produces: `MockUpstreamTransport(available: bool)`.
- Produces: `SyncService.enqueue`, `SyncService.replay`, `SyncService.status`.
- API: `GET /sync/status`.

- [ ] **Step 1: Write failing outage/replay test**

```python
def test_offline_queue_replays_in_order_and_is_idempotent(sync_service, mock_transport):
    mock_transport.available = False
    sync_service.enqueue('e1', {'n': 1})
    sync_service.enqueue('e2', {'n': 2})
    assert sync_service.status().mode == 'OFFLINE_EDGE'
    assert sync_service.status().queue_depth == 2

    mock_transport.available = True
    result = sync_service.replay()
    assert result.sent_event_ids == ['e1', 'e2']
    assert sync_service.status().queue_depth == 0
    assert sync_service.replay().sent_event_ids == []
```

- [ ] **Step 2: Verify failure**

```bash
python -m pytest tests/test_sync.py -v
```

- [ ] **Step 3: Implement queue state machine**

Rules:
- unavailable upstream + queued work => `OFFLINE_EDGE`;
- local subsystem healthy + transient upstream error => `DEGRADED`;
- replay complete + upstream healthy => `ONLINE`;
- `event_id` unique constraint prevents duplicate delivery records.

- [ ] **Step 4: Run and commit**

```bash
python -m pytest tests/test_sync.py -v
git add apps/afria-industrial/backend/app/services/sync.py apps/afria-industrial/backend/app/api/sync.py apps/afria-industrial/backend/app/main.py apps/afria-industrial/backend/tests/test_sync.py
git commit -m "feat(industrial): add offline queue and deterministic replay"
```

Expected: PASS.

---

### Task 10: Compose the Complete Industrial API Surface

**Files:**
- Create: `apps/afria-industrial/backend/app/api/assets.py`
- Create: `apps/afria-industrial/backend/app/api/kpis.py`
- Create: `apps/afria-industrial/backend/tests/test_api_contract.py`
- Modify: `apps/afria-industrial/backend/app/main.py`

**Interfaces:**
- API must include the full spec surface: health, system mode, sites, lines, assets, telemetry, KPI scopes, anomalies, alerts, readiness, evidence, sync.

- [ ] **Step 1: Write failing OpenAPI contract test**

```python
EXPECTED_PATHS = {
    '/health/live', '/health/ready', '/system/mode', '/sites', '/lines', '/assets',
    '/telemetry/batch', '/telemetry', '/kpis/site/{site_id}', '/kpis/line/{line_id}',
    '/kpis/asset/{asset_id}', '/anomalies', '/alerts', '/alerts/{alert_id}/acknowledge',
    '/readiness/assessments', '/readiness/assessments/{assessment_id}', '/evidence', '/sync/status'
}


def test_openapi_contains_exact_required_paths(client):
    paths = set(client.get('/openapi.json').json()['paths'])
    assert EXPECTED_PATHS <= paths
```

- [ ] **Step 2: Verify failure**

```bash
python -m pytest tests/test_api_contract.py -v
```

- [ ] **Step 3: Add missing focused routers and service wiring**

KPI routes must return `value`, component factors where applicable, `data_quality`, `denominator_valid`, calculation window, and evidence refs.

- [ ] **Step 4: Run full backend suite and commit**

```bash
python -m pytest -v
git add apps/afria-industrial/backend/app/api apps/afria-industrial/backend/app/main.py apps/afria-industrial/backend/tests/test_api_contract.py
git commit -m "feat(industrial): compose complete v1 api surface"
```

Expected: all backend tests PASS.

---

### Task 11: Build the React/Vite Industrial Cockpit

**Files:**
- Create: `apps/afria-industrial/frontend/package.json`
- Create: `apps/afria-industrial/frontend/tsconfig.json`
- Create: `apps/afria-industrial/frontend/vite.config.ts`
- Create: `apps/afria-industrial/frontend/index.html`
- Create: `apps/afria-industrial/frontend/src/main.tsx`
- Create: `apps/afria-industrial/frontend/src/App.tsx`
- Create: `apps/afria-industrial/frontend/src/api/client.ts`
- Create: `apps/afria-industrial/frontend/src/domain/types.ts`
- Create focused feature components and tests under `src/features/`.

**Interfaces:**
- Consumes backend read APIs and alert acknowledgement.
- Produces visible simulation label and system-mode indicator.

- [ ] **Step 1: Add frontend test toolchain and failing simulation-banner test**

`package.json` dependencies must include React, React DOM, Vite, TypeScript, Vitest, Testing Library, and jsdom.

```tsx
import { render, screen } from '@testing-library/react';
import { SystemBanner } from './SystemBanner';

test('simulation mode is unmistakably labelled', () => {
  render(<SystemBanner mode="ONLINE" source="SIMULATOR" />);
  expect(screen.getByText(/simulation/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify failure**

```bash
cd apps/afria-industrial/frontend
npm install
npm test -- --run
```

- [ ] **Step 3: Implement typed API client and domain types**

`client.ts` must attach `X-API-Key` only from runtime configuration; never hard-code secrets.

- [ ] **Step 4: Implement cockpit sections**

Required visible sections: Site Overview, Line/Process, Asset, Alerts, Energy & Yield, Readiness, System State. Each must have loading, error, stale-data, and empty states.

- [ ] **Step 5: Add component tests for stale data and alert acknowledgement**

Test that stale telemetry never renders as “live”, and successful acknowledgement changes state to `ACKNOWLEDGED`.

- [ ] **Step 6: Run typecheck/tests/build and commit**

```bash
npm run typecheck
npm test -- --run
npm run build
git add apps/afria-industrial/frontend
git commit -m "feat(industrial): add operator cockpit"
```

Expected: all commands PASS.

---

### Task 12: Containerize the Proof Stack and Add Operational Health

**Files:**
- Create: `apps/afria-industrial/backend/Dockerfile`
- Create: `apps/afria-industrial/frontend/Dockerfile`
- Create: `apps/afria-industrial/docker-compose.yml`
- Create: `apps/afria-industrial/.env.example`
- Create: `apps/afria-industrial/backend/tests/test_operational_contract.py`

**Interfaces:**
- Produces one command: `docker compose up --build`.
- Persists SQLite under a named/mounted volume.

- [ ] **Step 1: Write failing config-security test**

```python
from pathlib import Path


def test_env_example_contains_no_real_secret():
    text = Path('../.env.example').read_text()
    assert 'change-me' in text
    assert 'sk-' not in text
    assert 'password=' not in text.lower()
```

- [ ] **Step 2: Add Dockerfiles**

Backend uses `python:3.12-slim`; frontend uses a Node build stage and static server stage. Bind only required ports.

- [ ] **Step 3: Add compose health checks and persistent data volume**

Backend healthcheck must call `/health/ready`. Frontend depends on backend health. Simulator is enabled only through an explicit demo profile or environment flag.

- [ ] **Step 4: Build and smoke-test**

```bash
cd apps/afria-industrial
docker compose build
docker compose up -d
curl --fail http://localhost:8000/health/ready
docker compose ps
docker compose down
```

Expected: ready endpoint returns HTTP 200 and containers are healthy.

- [ ] **Step 5: Commit**

```bash
git add apps/afria-industrial/backend/Dockerfile apps/afria-industrial/frontend/Dockerfile apps/afria-industrial/docker-compose.yml apps/afria-industrial/.env.example apps/afria-industrial/backend/tests/test_operational_contract.py
git commit -m "build(industrial): containerize offline-first proof stack"
```

---

### Task 13: Add Failure-Mode, Security, and End-to-End Acceptance Tests

**Files:**
- Create: `apps/afria-industrial/backend/tests/test_failure_modes.py`
- Create: `apps/afria-industrial/backend/tests/test_acceptance.py`
- Create: `apps/afria-industrial/acceptance/scenarios/demo_factory.py`
- Create: `apps/afria-industrial/acceptance/run_acceptance.sh`

**Interfaces:**
- Proves the single-command flow required for `TEST_PROVEN`.

- [ ] **Step 1: Write failure-mode tests**

Cover exact scenarios:
- stale telemetry;
- malformed telemetry;
- duplicate batch;
- upstream outage/recovery;
- SQLite lock/recovery path;
- clock skew;
- simulator internal exception.

Example:

```python
def test_stale_source_is_not_claimed_live(client, stale_seed):
    response = client.get('/assets/a1/health', headers={'X-API-Key': 'viewer-secret'})
    assert response.json()['data_state'] == 'STALE'
    assert response.json()['live'] is False
```

- [ ] **Step 2: Write end-to-end acceptance test**

The test must seed a site, line, motor/pump/conveyor assets, inject telemetry, trigger a declared simulator anomaly, confirm alert explanation, confirm evidence-chain integrity, force upstream outage, confirm local KPI continuity, restore upstream, verify ordered replay, and create readiness assessment.

- [ ] **Step 3: Verify the acceptance test fails before final wiring**

```bash
python -m pytest tests/test_acceptance.py -v
```

- [ ] **Step 4: Make only the wiring fixes required for green acceptance**

No new feature beyond the approved spec may be added during this step.

- [ ] **Step 5: Run complete verification**

```bash
cd apps/afria-industrial/backend
python -m pytest -v
cd ../frontend
npm run typecheck
npm test -- --run
npm run build
cd ..
docker compose build
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/afria-industrial/backend/tests apps/afria-industrial/acceptance
git commit -m "test(industrial): prove failure modes and end-to-end acceptance"
```

---

### Task 14: Produce Runbooks, Threat Model, and M6/S7+/M8 Evidence Pack

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
- Produces human-reviewable release evidence and exact deployment truth.

- [ ] **Step 1: Write architecture and operator quickstart**

README must state exactly:

```text
Release truth: simulator-backed proof only.
Maximum allowed state after passing acceptance: TEST_PROVEN.
This release contains no machine actuation capability.
```

- [ ] **Step 2: Document OT threat model**

Threat model must cover trust boundaries, API-key abuse, telemetry spoofing, replay, stale data, compromised edge host, evidence tampering, protocol-adapter compromise, and explicit absence of actuation.

- [ ] **Step 3: Document runbook and rollback**

Runbook must include start, health verification, mode interpretation, queue inspection, backup, restore, evidence-chain verification, outage simulation, and recovery. Rollback must include exact Docker image/tag rollback and SQLite backup restoration procedure.

- [ ] **Step 4: Build M6/S7+/M8 evidence table**

`m8-release-evidence.md` must record each gate as `PASS`, `FAIL`, or `NOT_RUN`, link exact test/build commands, and keep M8 as `NOT_RUN` until the evidence is actually reviewed.

- [ ] **Step 5: Search for prohibited claims and placeholders**

Run:

```bash
grep -RniE 'TODO|TBD|PRODUCTION_PROVEN|DELIVERED_|DEPLOYED' apps/afria-industrial
```

Expected: no TODO/TBD. Any truth-state mentions must be explanatory, not claims.

- [ ] **Step 6: Run final suite and commit docs**

```bash
cd apps/afria-industrial/backend && python -m pytest -v
cd ../frontend && npm run typecheck && npm test -- --run && npm run build
cd .. && docker compose build
git add apps/afria-industrial/README.md apps/afria-industrial/docs
git commit -m "docs(industrial): add release controls and evidence pack"
```

Expected: all verification commands PASS before the commit is considered release-ready.

---

## Final Verification Gate

Before claiming implementation complete, run from repository root:

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
docker compose ps
docker compose down
```

Then verify:

```bash
! grep -RniE 'TODO|TBD' apps/afria-industrial
! grep -RniE 'def (write|actuate|command)|/write|/actuate|/command' apps/afria-industrial/backend/app
```

If and only if the full automated suite, frontend verification, Docker build, healthcheck, acceptance scenario, evidence-chain verification, and S7+ controls pass, update the release evidence to `TEST_PROVEN`. Do not claim `PRODUCTION_PROVEN`.
