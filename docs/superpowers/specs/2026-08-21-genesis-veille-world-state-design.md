# Genesis Veille Engine — World State Core v1 Design

## Status

Canonical implementation slice for **Genesis Veille Engine SaaS**. This is not a new product. It implements the first executable unit of the World Monitor pattern absorption decision under GENESIS V4.

## Goal

Create an Africa-first, provenance-governed world-state core that turns heterogeneous public signals into normalized events, rejects uncorroborated sensitive claims, exposes country state through an API, and provides a public map shell that can later consume live connectors.

## Canonical chain

`Signal → Source Registry → Provenance Gate → Normalized Event → Country World State → STRATEX-99 consumer → Action Router → Evidence Pack → R.E.M.E`

## Scope of v1

This slice implements exactly five capabilities:

1. **Source Registry** — register sources with type, license class, reliability tier and activation state.
2. **Event Schema** — normalize observations into a stable event contract.
3. **Provenance Gate** — enforce `signal != proof`, confidence bounds, source traceability and corroboration rules.
4. **World State API** — expose health, sources, events and country state endpoints.
5. **Africa Map Shell** — public no-login interface that renders the 54-country operating context and calls the API.

Live ACLED/GDELT/AIS/ADS-B/weather/cyber connectors are deliberately outside this first slice. They are added only after the contract and provenance rules are green in CI.

## Architecture

```text
Source Registry
    ↓
Observation/Event Input
    ↓
Provenance Gate
    ↓
Accepted Event Store (in-memory v1)
    ↓
Country State Aggregator
    ↓
FastAPI
    ↓
Public Africa Map Shell
```

The v1 store is intentionally in-memory so the first loop tests contracts, governance and behavior without prematurely locking persistence. Persistence moves to Supabase/Postgres in the next slice after the API contract is stable.

## Package boundary

`apps/genesis-veille-engine/`

- `backend/app/models.py` — Pydantic contracts only.
- `backend/app/source_registry.py` — source registration and retrieval.
- `backend/app/provenance.py` — provenance rules and acceptance decisions.
- `backend/app/world_state.py` — in-memory event ledger and country aggregation.
- `backend/app/main.py` — FastAPI transport layer only.
- `backend/tests/` — behavioral tests.
- `frontend/index.html` — public Africa shell with no login requirement.
- `.github/workflows/genesis-veille-world-state.yml` — CI gate for this slice.

Each unit has one responsibility and can be replaced without changing consumers as long as contracts remain stable.

## Data contracts

### Source

Required fields:

- `id: str`
- `name: str`
- `source_type: str`
- `license_class: str`
- `reliability_tier: int` in `1..5`
- `active: bool`

### Event

Required fields:

- `id: str`
- `event_type: str`
- `title: str`
- `country_iso3: str`
- `observed_at: datetime`
- `source_ids: list[str]`
- `confidence: float` in `0..1`
- `corroboration_count: int >= 1`
- `sensitive: bool`
- optional `lat`, `lon`, `summary`, `sector`

### Provenance decision

The gate returns:

- `accepted: bool`
- `status: VERIFIED | CORROBORATED | OBSERVATION_ONLY | REJECTED`
- `reasons: list[str]`

Rules:

1. Every event must reference at least one active registered source.
2. Confidence must be between 0 and 1.
3. Sensitive events require at least two distinct active sources and `corroboration_count >= 2`.
4. A single-source non-sensitive event may be stored only as `OBSERVATION_ONLY` unless its source reliability tier is 1 or 2 and confidence is at least 0.80.
5. Unknown or inactive sources cause rejection.
6. The API never upgrades provenance status implicitly.

## Country state

For an ISO3 country code, the aggregator returns:

- accepted event count;
- latest observed timestamp;
- event-type counts;
- sector counts;
- average confidence;
- count by provenance status;
- derived `risk_score` and `opportunity_score` in `0..100`.

v1 scores are deterministic heuristic scores, not ML predictions. They exist to prove the scoring interface and auditability.

Risk event types: `conflict`, `cyber`, `internet_outage`, `natural_hazard`, `energy_disruption`, `maritime_disruption`.

Opportunity event types: `funding`, `investment`, `tender`, `infrastructure_launch`, `market_growth`, `technology_launch`.

Each accepted matching event contributes 10 points, capped at 100. Confidence below 0.50 halves the contribution. This simple rule is fully explainable and replaceable later.

## API

- `GET /health`
- `GET /api/v1/sources`
- `POST /api/v1/sources`
- `POST /api/v1/events`
- `GET /api/v1/events`
- `GET /api/v1/world-state/countries/{iso3}`

`POST /api/v1/events` returns HTTP 422 for schema violations and HTTP 409 for provenance rejection.

## Public access

The frontend requires no login. It presents the value before account creation. Authentication is deferred to Analyst/Professional/Sovereign tiers and therefore not introduced in this slice.

## Security and legal constraints

- No offensive targeting functionality.
- No covert collection.
- No biometric or person-tracking feature.
- Public or licensed data only in this slice.
- World Monitor AGPL code is not copied. The implementation is clean-room and uses only architectural patterns.
- Sensitive events require corroboration.
- Every event remains attributable to source IDs.

## Test strategy

CI must prove:

1. valid sources can be registered;
2. unknown sources are rejected;
3. sensitive single-source events are rejected;
4. corroborated sensitive events are accepted;
5. low-confidence single-source observations are classified as observation-only;
6. world-state aggregation is deterministic;
7. health and country API endpoints return stable contracts.

## Release gate

The slice may be marked `M6 candidate` only when all tests pass in GitHub Actions on a feature branch. It is not production-ready until S7+, M8 and external review requirements are satisfied.

## Rollback

The change is isolated under `apps/genesis-veille-engine` plus one workflow. Rollback is branch/PR revert with no migration and no effect on existing applications.
