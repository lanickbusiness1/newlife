# MODULE 06 — Mining Local Content, Workforce & Value Retention Intelligence

**Canonical parent:** BP-MINING-GN-001 — AfrIAgenesis® Sovereign Mining OS™ Guinée  
**Version:** BP-MINING-GN-001 / MODULE-06 / v1.4-G4B-M8-PREVIEW-TEST_PROVEN  
**Build branch:** `feature/mining-local-content-module-06`  
**Draft PR:** `#9`  
**Technical status:** TEST_PROVEN for synthetic sandbox engineering; not deployed; not production-certified.

## Implemented scope

### Domain kernel

- sourced and versioned legal-rule object;
- SHA-256 fingerprint for legal sources and approval evidence;
- effective and expiry date controls;
- mandatory human `LEGAL_APPROVER` gate;
- mining workforce records by project, category and nationality status;
- national/expatriate ratio, target gap and evidence coverage;
- explicit `NO_DATA` instead of false compliance;
- advisory-only assessments;
- tenant and mining-project isolation;
- succession readiness and mandatory human `HR_APPROVER` gate.

### Governed application service

`MiningLocalContentService` provides role-gated operations for:

- rule registration by `LEGAL_EDITOR`;
- rule validation by human `LEGAL_APPROVER`;
- workforce ingestion by `DATA_STEWARD`;
- advisory assessment by `COMPLIANCE_ANALYST`;
- succession proposal by `HR_PLANNER`;
- succession approval by human `HR_APPROVER`;
- Mission Control and audit access by `AUDITOR`.

Every mutation creates an audit event. Duplicate identities are rejected. Succession plans require an expatriate source record and a national candidate in the same tenant and project.

### HTTP contract

The API adapter exposes:

- `GET /health`;
- `POST /v1/rules`;
- `POST /v1/rules/:id/validate`;
- `POST /v1/workforce/batch`;
- `POST /v1/assessments`;
- `POST /v1/succession-plans`;
- `POST /v1/succession-plans/:id/approve`;
- `GET /v1/mission-control`;
- `GET /v1/audit-trail`.

Implemented controls include JSON-only input, body-size limits, correlation identifiers, controlled status/error mapping, `no-store`, `nosniff` and no stack leakage.

### G4b operational security controls

- native RS256 JWT signature verification;
- issuer, audience, `kid`, issue-time, expiry, actor-kind and role validation;
- abstract signing-key provider suitable for institutional JWKS integration;
- Bearer auth resolver that does not trust caller identity headers;
- tenant emergency-stop guard;
- fixed-window tenant/actor/path rate limiter;
- idempotency requirement, replay and conflict protection for mutations;
- append-only persistent audit schema with hash-chain fields;
- persistent emergency-control and idempotency schemas;
- tested security migration rollback and re-application.

`InMemoryAuthContextResolver`, the in-memory guards and the in-memory business repository are deterministic test adapters. They must not be used as production persistence or public-ingress trust components.

## Security and governance invariants

1. A draft legal rule cannot be evaluated.
2. An AI agent cannot validate a legal rule.
3. An AI agent cannot approve a succession plan.
4. Legal sources require identity, HTTPS URL, jurisdiction, version, effectivity and SHA-256.
5. Approval evidence must belong to the same tenant and have SHA-256 integrity.
6. A rule can only be applied in the same jurisdiction and effective period.
7. Workforce records cannot cross tenant or project boundaries.
8. Assessments are `ADVISORY`; the engine never certifies legal compliance.
9. Empty datasets return `NO_DATA`.
10. PostgreSQL references are tenant-bound through composite foreign keys.
11. Tenant tables use RLS `FOR ALL`, `WITH CHECK` and `FORCE ROW LEVEL SECURITY`.
12. Audit rows are append-only at database level.
13. Mutating requests can be configured to require idempotency keys.
14. Emergency stop is checked before protected route execution.
15. No real employee data, secrets, biometrics or production credentials are committed.

## Authoritative verification evidence

- **Code evidence SHA:** `d8fdcd01f068a06b4fe0fcc69e16263c12b8a709`
- **GitHub Actions run:** `31014286308` — SUCCESS
- **Node:** 22
- **Strict TypeScript type-check:** SUCCESS
- **Automated tests:** **35 passed / 0 failed**
- **Dependency audit:** 0 vulnerabilities reported
- **Native RS256 JWT controls:** SUCCESS
- **Synthetic HTTP/service flow:** SUCCESS
- **PostgreSQL 16 service:** healthy
- **Migrations `001`, `002`, `003`:** SUCCESS
- **SQL control tests:** SUCCESS
- **Migration 003 rollback, table-removal assertions and re-apply:** SUCCESS

The proven flow is:

```plain text
signed identity claims
→ legal source
→ draft rule
→ human legal validation
→ workforce ingestion
→ advisory assessment
→ succession proposal
→ human HR approval
→ Mission Control
→ append-only audit controls
→ rollback proof
```

## Database assets

### `002_mining_local_content.sql`

- mining projects;
- legal sources and rules;
- workforce records;
- assessments;
- succession plans;
- composite tenant-safe foreign keys;
- RLS policies and indexes.

### `003_security_operations.sql`

- tenant emergency controls;
- append-only local-content audit events;
- persistent idempotency records;
- hash, uniqueness and integrity constraints;
- RLS hardening for security and base workforce tables.

### Verification and rollback

- `003_security_operations_test.sql` proves database controls;
- `003_security_operations_down.sql` reverses migration 003;
- CI verifies removal and successful re-application.

## Gate status

- **G0 Legal Source Gate — OPEN:** replace synthetic source metadata with verified Guinean primary sources, hashes and human legal approval.
- **G1 Data Gate — OPEN:** define official HR/ERP imports, quality, privacy, retention and minimisation.
- **G2 API Gate — TEST_PROVEN:** governed service and HTTP contract implemented.
- **G3 E2E Gate — TEST_PROVEN:** full synthetic service and HTTP flow reproduced.
- **G4a M6/S7+ — TEST_PROVEN FOR SANDBOX:** code, threat model, abuse tests, RLS and CI hardening are green.
- **G4b Operational controls — PARTIALLY TEST_PROVEN:** native JWT verification, guards, persistence schema and rollback are proven; actual institutional JWKS provider, distributed rate limiter, wired PostgreSQL business repository and persistent runtime adapters remain open.
- **G5 M8 — PRE-REVIEW COMPLETED:** score 6.5/10; GO conditionnel for Build Factory and synthetic demo; NO-GO merge/release/production.
- **G6 External Gate — OPEN:** legal and Big4-type review required.

## M8 blockers before draft PR promotion

1. Wire the business `LocalContentRepository` to PostgreSQL/Supabase with transactions and concurrency controls.
2. Wire persistent audit, idempotency and emergency-stop adapters to runtime.
3. Configure a real institutional issuer/JWKS provider and rotation/revocation procedure.
4. Register and approve verified Guinean primary legal sources.
5. Approve privacy, retention, field-level access and data-residency controls.
6. Build and browser-test the Mission Control cockpit and evidence-room UI.
7. Obtain pilot sponsor, data-sharing framework, RACI, SLA and acceptance criteria.
8. Execute human M8 and external legal/Big4 review.

No production, deployment, legal-compliance, certification or commercial-performance claim is authorised until all gates close with evidence.
