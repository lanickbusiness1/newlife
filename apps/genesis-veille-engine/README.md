# Genesis Veille Engine — World State Core v0.1

First executable Africa-first world-state slice of the existing **Genesis Veille Engine SaaS** canonical product.

This directory does **not** create a new AfrIAgenesis product. It implements the World Monitor pattern absorption decision under GENESIS V4 using a clean-room codebase.

## What exists in v0.1

- Source Registry with license class, source type, reliability tier and activation state.
- Normalized event contract with ISO3, geospatial, temporal, confidence and source references.
- Provenance Gate enforcing **signal != proof**.
- Sensitive-event corroboration rule.
- Explainable country risk and opportunity scoring.
- FastAPI source/event/world-state API.
- Public Africa 54/54 cockpit with no account requirement.
- Explicit degraded mode: no fabricated live values when the API is unavailable.
- Docker build and CI smoke gate.

## Governance invariants

1. Unknown or inactive sources are rejected.
2. Sensitive events require at least two distinct active sources and corroboration count >= 2.
3. Single-source observations not meeting verification thresholds remain `OBSERVATION_ONLY`.
4. Every accepted event retains its source IDs and provenance decision.
5. No World Monitor AGPL code is copied into this implementation.
6. No offensive targeting, covert collection, biometric identification or person-tracking capability is included.
7. Public, licensed, client-private and institutional-private data must remain separate in later persistence layers.

## Local run

```bash
cd apps/genesis-veille-engine/backend
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/`.

## Tests

```bash
cd apps/genesis-veille-engine/backend
python -m pytest -q
```

## Container

```bash
cd apps/genesis-veille-engine
docker build -t genesis-veille-world-state:local .
docker run --rm -p 8000:8000 genesis-veille-world-state:local
```

## API

- `GET /`
- `GET /health`
- `GET /api/v1/sources`
- `POST /api/v1/sources`
- `GET /api/v1/events`
- `POST /api/v1/events`
- `GET /api/v1/world-state/countries/{iso3}`

## Current storage boundary

v0.1 deliberately uses in-memory storage. The objective of this slice is to stabilize contracts, provenance policy, deterministic aggregation and delivery before adding persistence and live collectors.

Next engineering slice after gates: persistent Event/Source ledger, source hashes and retrieval timestamps, then controlled public connectors.

## Release status

`v0.1` is a **release candidate / M6 candidate**, not production. Promotion requires the active GENESIS V4 M6 → S7+ → M8 → external-review sequence and authorized deployment infrastructure.
