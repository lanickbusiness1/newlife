# Release Certificate — v0.2.0

Asset: `PRD-AFRIAPAY-001 / Merchant-to-Credit Runtime P0`

Status: `TEST_PROVEN_SANDBOX / PILOT_ONLY`

Regulatory boundary: `NON_LENDER_NON_CUSTODIAL`

Release gates closed in this package:
- Functional FastAPI runtime: PASS
- Pilot operator console: PASS
- HTTP Basic console protection / fail closed: PASS
- Merchant onboarding: PASS
- CSV transaction import: PASS
- Deterministic readiness policy: PASS
- Idempotent transaction ingestion: PASS
- API-key fail-closed boundary: PASS
- Partner decision ownership separation: PASS
- Evidence ledger: PASS
- PostgreSQL-compatible persistence model: PASS (code path; external DB connectivity remains environment-dependent)

External gates still required before real-credit production:
- Regulated partner agreement / sandbox credentials
- Local legal/regulatory review for target jurisdiction
- Production secrets and managed PostgreSQL
- External M8/S7+ review and live environment health evidence
- HTTPS-enabled live deployment target
