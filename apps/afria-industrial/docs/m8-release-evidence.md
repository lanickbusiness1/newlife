# M6 / S7+ / M8 Release Evidence — v1 proof candidate

Truth ceiling: simulator-backed evidence can permit at most `TEST_PROVEN`; never `PRODUCTION_PROVEN`, `DEPLOYED`, or `DELIVERED_*`.

Authoritative CI proof: GitHub Actions `AfrIA Industrial Proof`, run `33496886557`, commit `b7fe12e6f1af8a3f3133b9a40a465db03eef20f9`, conclusion `success` on 2026-09-01.

| Gate | Control | Status | Evidence / command |
|---|---|---:|---|
| M6 | Backend automated suite | PASS | GitHub Actions backend job: Python 3.12, `python -m pytest -v` success; 47 tests |
| M6 | Deterministic simulator tests | PASS | Local proof: 3 tests; simulator contract covered by repository tests |
| M6 | Full acceptance loop | PASS | `backend/tests/test_acceptance.py`, including simulator → telemetry → KPI → anomaly → alert → evidence → offline/replay → readiness |
| M6 | 100 points/s proof target | PASS | `test_acceptance_environment_ingests_100_points_per_second` |
| M6 | Frontend typecheck/Vitest/build | PASS | GitHub Actions frontend job: typecheck success, 2 Vitest tests success, Vite production build success |
| M6 | Docker backend image | PASS | GitHub Actions containers job: backend image build success |
| M6 | Docker frontend image | PASS | GitHub Actions containers job: frontend image build success including typecheck/test/build |
| M6 | Docker Compose config | PASS | `docker compose -f apps/afria-industrial/docker-compose.yml --env-file apps/afria-industrial/.env.example config` success |
| S7+ | API-key auth/RBAC | PASS | `backend/tests/test_security.py` |
| S7+ | Mutation rate limit | PASS | 11th same-route mutation → 429 |
| S7+ | Read-only OT boundary | PASS | adapter contract + CI prohibited-path scan |
| S7+ | Evidence tamper detection | PASS | tamper test + `/health/ready` 503 |
| S7+ | Offline/replay/idempotency | PASS | `backend/tests/test_sync.py` |
| S7+ | Threat model | PASS | `docs/threat-model-ot.md` |
| S7+ | Secret scan | PASS | GitHub Actions safety job; no raw proof secret committed |
| M8 | Evidence completeness review | PASS | M6 and S7+ proof set reconciled against approved v1 design and implementation plan |
| M8 | Economic viability review | NOT_RUN | Site-specific gate: requires pilot baseline, downtime/quality/energy economics and commercial assumptions |
| M8 | Sovereignty/data-residency review | NOT_RUN | Site-specific gate: requires target jurisdiction, outbound destinations, contractual authority and retention policy |
| External | Safety-critical/regulated site review | NOT_RUN | Site-specific gate; mandatory only if actual industrial risk profile triggers it |

Governance verdict for the simulator-backed v1 release: `M8 conditionnel`. The software proof may advance to `TEST_PROVEN`; any pilot or production promotion remains blocked on the site-specific economic, sovereignty and safety review.

This document records observed evidence; it does not claim deployment or production proof.
