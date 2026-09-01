# M6 / S7+ / M8 Release Evidence — v1 proof candidate

Truth ceiling: simulator-backed evidence can permit at most `TEST_PROVEN`; never `PRODUCTION_PROVEN`, `DEPLOYED`, or `DELIVERED_*`.

| Gate | Control | Status | Evidence / command |
|---|---|---:|---|
| M6 | Backend automated suite | PASS | `cd backend && python -m pytest -q` → 47 passed locally |
| M6 | Deterministic simulator tests | PASS | `cd simulator && python -m pytest -q` → 3 passed locally |
| M6 | Full acceptance loop | PASS | `backend/tests/test_acceptance.py`, `acceptance/run_acceptance.sh` |
| M6 | 100 points/s proof target | PASS | `test_acceptance_environment_ingests_100_points_per_second` |
| M6 | Frontend typecheck/Vitest/build | NOT_RUN | Local npm registry unavailable; GitHub Actions is authority |
| M6 | Docker build / compose config | NOT_RUN | Local Docker unavailable; GitHub Actions is authority |
| S7+ | API-key auth/RBAC | PASS | `backend/tests/test_security.py` |
| S7+ | Mutation rate limit | PASS | 11th same-route mutation → 429 |
| S7+ | Read-only OT boundary | PASS | adapter contract + prohibited-path grep |
| S7+ | Evidence tamper detection | PASS | tamper test + `/health/ready` 503 |
| S7+ | Offline/replay/idempotency | PASS | `backend/tests/test_sync.py` |
| S7+ | Threat model | PASS | `docs/threat-model-ot.md` |
| S7+ | Secret scan | PASS | `.env.example` only has change-me values; no real proof secret committed |
| M8 | Evidence completeness review | NOT_RUN | Authorized governance review after CI is green |
| M8 | Economic viability review | NOT_RUN | Requires pilot baseline and commercial review |
| M8 | Sovereignty/data-residency review | NOT_RUN | Requires target-site jurisdiction, destination and authority |
| External | Safety-critical/regulated site review | NOT_RUN | Mandatory only when real-site risk profile triggers it |

This document records observed evidence; it does not self-promote catalogue state.
