# MODULE 06 — Mining Local Content, Workforce & Value Retention Intelligence

**Canonical parent:** BP-MINING-GN-001 — AfrIAgenesis® Sovereign Mining OS™ Guinée  
**Version:** BP-MINING-GN-001 / MODULE-06 / v1.5-G4B-PERSISTENT-SECURITY-TEST_PROVEN  
**Build branch:** `feature/mining-local-content-module-06`  
**Draft PR:** `#9`  
**Technical status:** synthetic sandbox engineering and persistent operational-security adapters are TEST_PROVEN; not deployed; not production-certified.

## Implemented scope

### Domain and governed service

- sourced, versioned and fingerprinted legal-rule objects;
- legal effectivity and expiry controls;
- mandatory human `LEGAL_APPROVER` and `HR_APPROVER` gates;
- workforce records by project, category and national/expatriate status;
- national ratio, target gap and evidence coverage;
- explicit `NO_DATA` instead of false compliance;
- advisory-only assessments;
- succession readiness;
- tenant and project isolation;
- governed audit events and Mission Control counters.

### HTTP and identity controls

- governed API routes for rules, workforce, assessments, succession, audit and Mission Control;
- JSON-only requests, byte limits, controlled errors and correlation identifiers;
- native RS256 JWT signature verification;
- issuer, audience, `kid`, `iat`, `nbf`, `exp`, tenant, actor and role validation;
- Bearer identity context that does not trust caller-supplied tenant or role fields;
- request rate limiting and idempotency enforcement;
- tenant emergency-stop guard.

### PostgreSQL operational adapters

`PostgresIdempotencyStore` and `PostgresEmergencyStopGuard` now provide real PostgreSQL runtime adapters for the security schemas created by migration `003_security_operations.sql`.

The adapters use:

- parameterized SQL only;
- short `BEGIN` / `COMMIT` transactions;
- `select set_config('app.tenant_id', $1, true)` inside every transaction;
- non-owner application-role execution;
- RLS `FOR ALL`, `WITH CHECK` and `FORCE ROW LEVEL SECURITY`;
- rollback on any query or mapping failure;
- fail-closed emergency-control behavior when PostgreSQL is unavailable;
- durable idempotency replay and expiry cleanup.

The in-memory repository and in-memory operational adapters remain deterministic test components only.

## Security and governance invariants

1. A draft legal rule cannot be evaluated.
2. An AI agent cannot validate a legal rule or approve succession.
3. Legal sources and approval evidence require tenant-bound SHA-256 integrity.
4. Rules apply only in the correct jurisdiction and effective period.
5. Workforce and succession records cannot cross tenant or project boundaries.
6. Assessments remain `ADVISORY`; no legal certification is produced.
7. Empty datasets return `NO_DATA`.
8. PostgreSQL references are tenant-bound through composite foreign keys.
9. Tenant tables use RLS with `FORCE ROW LEVEL SECURITY`.
10. Audit rows are append-only at database level.
11. Idempotency records persist across process instances and expire deterministically.
12. A tenant-A application session cannot read a tenant-B idempotency record.
13. Emergency-control database failure blocks protected access instead of failing open.
14. No real employee data, biometrics, production secrets or credentials are committed.

## Authoritative verification evidence

- **Code evidence SHA:** `442c202fb6bd2777ebc3f0e7c3558388aba2ce78`
- **GitHub Actions run:** `31016382802` — SUCCESS
- **Node:** 22
- **Strict TypeScript type-check:** SUCCESS
- **Automated tests:** **40 passed / 0 failed**
- **Dependency audit:** 0 vulnerabilities reported
- **PostgreSQL 16:** healthy
- **Migrations `001`, `002`, `003`:** SUCCESS
- **Non-owner role `workforce_app`:** configured with `BYPASSRLS = false`
- **Persistent idempotency create/reload/expiry:** SUCCESS
- **Persistent emergency stop/resume/fail-closed:** SUCCESS
- **Explicit cross-tenant RLS read test:** SUCCESS
- **SQL security-control tests:** SUCCESS
- **Migration 003 rollback, removal assertions and re-apply:** SUCCESS

## Database assets

### `002_mining_local_content.sql`

- mining projects;
- legal sources and rules;
- workforce records;
- assessments;
- succession plans;
- composite tenant-safe foreign keys;
- tenant RLS policies and indexes.

### `003_security_operations.sql`

- tenant module enable/stop state;
- append-only local-content audit events;
- durable idempotency records;
- integrity constraints and tenant-bound foreign keys;
- RLS hardening for security and base workforce tables.

### Runtime adapters

- `src/mining-local-content-postgres-security.ts`;
- `tests/mining-local-content-postgres-security.test.ts`;
- CI role and integration-test configuration in `.github/workflows/afria-workforce-rc2.yml`.

## Gate status

- **G0 Legal Source Gate — OPEN:** verified Guinean primary sources, hashes and human legal approval are still required.
- **G1 Data Gate — OPEN:** official HR/ERP contracts, quality, privacy, retention and minimisation remain open.
- **G2 API Gate — TEST_PROVEN:** governed service and HTTP contract implemented.
- **G3 E2E Gate — TEST_PROVEN:** full synthetic service and HTTP flow reproduced.
- **G4a M6/S7+ — TEST_PROVEN FOR SANDBOX:** threat model, abuse tests, RLS and CI hardening are green.
- **G4b Identity — PARTIALLY TEST_PROVEN:** native JWT verification is green; institutional issuer/JWKS, rotation and revocation remain open.
- **G4b Persistent security adapters — TEST_PROVEN:** PostgreSQL idempotency and emergency-stop adapters, non-owner RLS and fail-closed behavior are green.
- **G4b Business persistence — OPEN:** the business `LocalContentRepository` and audit event must still commit atomically in PostgreSQL.
- **G5 M8 — PRE-REVIEW COMPLETED:** 6.5/10; GO conditionnel for Build Factory and synthetic demo; NO-GO merge/release/production.
- **G6 External Gate — OPEN:** legal and Big4-type review required.

## Next build increment

1. Add a transaction-capable business repository port.
2. Prove that a failed audit append rolls back the corresponding business mutation.
3. Implement the PostgreSQL repository for rules, workforce, assessments, succession, audit and Mission Control.
4. Test transaction rollback, concurrency and non-owner RLS for all business tables.
5. Wire persistent adapters into the institutional runtime composition root.

No deployment, production, legal-compliance, certification or commercial-performance claim is authorised until all gates close with evidence.
