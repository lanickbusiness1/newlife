# Genesis Veille Engine World State Core v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first executable Africa-first world-state slice for Genesis Veille Engine with provenance governance, deterministic country state, API endpoints, public shell, and CI evidence.

**Architecture:** A clean-room FastAPI service stores registered sources and accepted events in memory, applies a provenance gate before storage, derives explainable country scores, and exposes stable REST contracts. A public no-login HTML shell consumes the API. GitHub Actions is the verification authority for this slice.

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2, pytest, httpx, static HTML/CSS/JS, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-21-genesis-veille-world-state-design.md`

## Global Constraints

- This is a capability slice of Genesis Veille Engine SaaS, not a new product.
- Do not copy World Monitor AGPL code.
- `signal != proof`; sensitive events require corroboration.
- No offensive targeting, covert collection, biometric or person-tracking capability.
- Public shell requires no login.
- No persistence migration in v1; use in-memory repositories.
- Every behavioral change is test-first.

---

### Task 1: Provenance contracts and gate

**Files:**
- Create: `apps/genesis-veille-engine/backend/app/__init__.py`
- Create: `apps/genesis-veille-engine/backend/app/models.py`
- Create: `apps/genesis-veille-engine/backend/app/source_registry.py`
- Create: `apps/genesis-veille-engine/backend/app/provenance.py`
- Test: `apps/genesis-veille-engine/backend/tests/test_provenance.py`
- Create: `apps/genesis-veille-engine/backend/requirements.txt`

**Interfaces:**
- Produces: `SourceRecord`, `EventInput`, `ProvenanceDecision`, `SourceRegistry`, `ProvenanceGate.evaluate(event)`.
- `SourceRegistry.get(source_id: str) -> SourceRecord | None`
- `ProvenanceGate.evaluate(event: EventInput) -> ProvenanceDecision`

- [ ] **Step 1: Write failing provenance tests**

Tests must prove unknown sources are rejected, sensitive single-source events are rejected, corroborated sensitive events are accepted, and low-confidence single-source events remain observation-only.

- [ ] **Step 2: Run `pytest apps/genesis-veille-engine/backend/tests/test_provenance.py -v` and confirm RED**

Expected failure: import/module not found because implementation does not exist yet.

- [ ] **Step 3: Implement minimal contracts, registry, and provenance gate**

Use Pydantic validation for source and event fields. Keep all policy decisions in `provenance.py`.

- [ ] **Step 4: Run the provenance tests and confirm GREEN**

- [ ] **Step 5: Commit provenance core**

Commit message: `feat: add Genesis Veille provenance core`

### Task 2: World-state aggregation

**Files:**
- Create: `apps/genesis-veille-engine/backend/app/world_state.py`
- Test: `apps/genesis-veille-engine/backend/tests/test_world_state.py`

**Interfaces:**
- Consumes: `EventInput`, `ProvenanceDecision`.
- Produces: `WorldStateStore.add(event, decision)`, `WorldStateStore.list_events()`, `WorldStateStore.country_state(iso3)`.

- [ ] **Step 1: Write failing aggregation tests**

Tests must assert deterministic event counts, provenance counts, risk/opportunity scores, average confidence, and uppercase ISO3 normalization.

- [ ] **Step 2: Run the world-state tests and confirm RED**

- [ ] **Step 3: Implement the minimal in-memory ledger and aggregation rules from the spec**

- [ ] **Step 4: Run both test modules and confirm GREEN**

- [ ] **Step 5: Commit world-state core**

Commit message: `feat: add explainable country world state`

### Task 3: FastAPI transport layer

**Files:**
- Create: `apps/genesis-veille-engine/backend/app/main.py`
- Test: `apps/genesis-veille-engine/backend/tests/test_api.py`

**Interfaces:**
- Produces: FastAPI app with `/health`, source, event and country-state routes.
- HTTP 409 is reserved for provenance rejection.

- [ ] **Step 1: Write failing API tests with `fastapi.testclient.TestClient`**

Tests must prove health contract, source registration, accepted event ingestion, provenance rejection, and country-state response.

- [ ] **Step 2: Run API tests and confirm RED**

- [ ] **Step 3: Implement route layer using only the registry, gate and store interfaces**

- [ ] **Step 4: Run all backend tests and confirm GREEN**

- [ ] **Step 5: Commit API layer**

Commit message: `feat: expose Genesis Veille world-state API`

### Task 4: Public Africa shell

**Files:**
- Create: `apps/genesis-veille-engine/frontend/index.html`
- Create: `apps/genesis-veille-engine/README.md`

**Interfaces:**
- Consumes: `GET /api/v1/world-state/countries/{iso3}` and `GET /api/v1/events`.
- Produces: no-login public shell with Africa-first country selector, risk/opportunity cards, event stream, provenance labels and API status.

- [ ] **Step 1: Create the static shell with semantic HTML and no authentication dependency**

- [ ] **Step 2: Verify that all API calls are relative and failure states are visible**

- [ ] **Step 3: Document local run commands and governance rules in README**

- [ ] **Step 4: Commit frontend shell**

Commit message: `feat: add public Africa intelligence shell`

### Task 5: CI gate and evidence

**Files:**
- Create: `.github/workflows/genesis-veille-world-state.yml`

**Interfaces:**
- Produces: GitHub Actions run on branch/PR changes under `apps/genesis-veille-engine/**`.

- [ ] **Step 1: Add a Python 3.12 workflow that installs requirements and runs `pytest -q`**

- [ ] **Step 2: Push test-only RED state first and record failing workflow evidence**

- [ ] **Step 3: Push implementation and obtain GREEN workflow evidence**

- [ ] **Step 4: Open PR against `main` with spec, risk controls, test evidence and rollback statement**

- [ ] **Step 5: Update Notion with repository, branch, PR and CI status**

Commit message for workflow: `ci: gate Genesis Veille world-state core`
