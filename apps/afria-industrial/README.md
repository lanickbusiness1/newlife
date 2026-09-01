# AfrIA Industrial Intelligence & Automation OS™ v1.0

Canonical asset: `CAP-IND-AUTOMATION-001` · authority: `V4-DEC-030`.

Release truth: simulator-backed proof only.
Maximum allowed state after passing acceptance: TEST_PROVEN.
This release contains no machine actuation capability.

This runtime observes industrial assets, ingests normalized telemetry, computes explainable KPIs, detects explainable anomalies, produces a 12-dimension Industrial AI & Automation Readiness Assessment™, preserves tamper-evident evidence, and remains locally useful when an upstream control plane is unavailable.

## Safety boundary
The v1 adapter interface contains only `connect`, `health`, `discover_readable_points`, `read_batch`, and `disconnect`. There is no PLC/PAC/robot write API, command queue, actuation endpoint, or hidden control path. A future write capability requires a separate ADR, safety engineering review, site-specific interlocks, and M6/S7+/M8 review.

## Quickstart
1. Copy `.env.example` to `.env` and replace every `change-me-*` proof secret.
2. Run `docker compose up --build`.
3. Confirm `GET http://localhost:8000/health/ready` returns HTTP 200 with `evidence_integrity: true`.
4. Open `http://localhost:8080`; the cockpit must visibly state `MODE SIMULATION` while synthetic data is used.
5. Run `./acceptance/run_acceptance.sh` in an environment with Python dependencies installed.

The frontend proof key is runtime-injected. A real secret must never be committed to Git, images, documentation, logs, evidence, or generated frontend source.

## Proof commands
```bash
cd backend && python -m pytest -v
cd ../simulator && python -m pytest -v
cd ../frontend && npm install --no-audit --no-fund && npm run typecheck && npm test -- --run && npm run build
cd .. && docker compose build
```
A green simulator-backed build is not production proof. Real-site deployment requires target hardware benchmarking, site threat modelling, data/residency authorization, rollback rehearsal, and the applicable external review gate.
