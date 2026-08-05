# MODULE 06 — Mining Local Content, Workforce & Value Retention Intelligence

**Canonical parent:** BP-MINING-GN-001 — AfrIAgenesis® Sovereign Mining OS™ Guinée  
**Version:** BP-MINING-GN-001 / MODULE-06 / v1.2-G2-G3-TEST_PROVEN  
**Build branch:** `feature/mining-local-content-module-06`  
**Draft PR:** `#9`  
**Technical status:** kernel, governed application service, HTTP contract and PostgreSQL migrations are TEST_PROVEN; not deployed; not production-certified.

## Implemented scope

### Domain kernel

- sourced and versioned legal-rule object;
- SHA-256 fingerprint for legal sources and approval evidence;
- effective and expiry date controls;
- mandatory human `LEGAL_APPROVER` gate;
- mining workforce records by project, category and nationality status;
- national/expatriate headcount ratio;
- target gap and evidence-coverage calculation;
- explicit `NO_DATA` result instead of false compliance;
- advisory-only assessments;
- tenant and mining-project isolation;
- succession readiness calculation;
- mandatory human `HR_APPROVER` gate for succession-plan approval.

### Governed application service

`MiningLocalContentService` provides role-gated operations for:

- rule registration by `LEGAL_EDITOR`;
- rule validation by human `LEGAL_APPROVER`;
- workforce ingestion by `DATA_STEWARD`;
- advisory assessment by `COMPLIANCE_ANALYST`;
- succession proposal by `HR_PLANNER`;
- succession approval by human `HR_APPROVER`;
- Mission Control and audit access by `AUDITOR`.

Every mutation creates an audit event. Duplicate identities are rejected instead of silently overwriting evidence. Succession plans require an expatriate source record and a national candidate in the same tenant and mining project.

### HTTP contract

The Web-standard API adapter exposes:

- `GET /health`;
- `POST /v1/rules`;
- `POST /v1/rules/:id/validate`;
- `POST /v1/workforce/batch`;
- `POST /v1/assessments`;
- `POST /v1/succession-plans`;
- `POST /v1/succession-plans/:id/approve`;
- `GET /v1/mission-control`;
- `GET /v1/audit-trail`.

Implemented controls include JSON-only input, configurable body-size limits, correlation identifiers, `no-store`, `nosniff`, controlled status/error mapping and no stack leakage.

`InMemoryAuthContextResolver` is a test adapter only. Production deployment must replace it with a cryptographically verified OIDC/JWT or equivalent institutional identity adapter. Caller-provided identity headers must never be trusted directly at a public ingress.

## Security and governance invariants

1. A draft legal rule cannot be evaluated.
2. An AI agent cannot validate a legal rule.
3. An AI agent cannot approve a succession plan.
4. A rule source must have identity, title, HTTPS URL, jurisdiction, version, effective date and SHA-256 fingerprint.
5. Approval evidence must belong to the same tenant and have a SHA-256 fingerprint.
6. A rule can only be applied to the same tenant jurisdiction and during its effective period.
7. Workforce records cannot cross tenant or mining-project boundaries.
8. Assessments are labelled `ADVISORY`; the engine never certifies legal compliance.
9. Empty datasets return `NO_DATA`.
10. PostgreSQL references are tenant-bound through composite foreign keys.
11. Tenant tables use RLS `FOR ALL`, `WITH CHECK` and `FORCE ROW LEVEL SECURITY`.
12. No real employee data, secrets, biometrics or production credentials are present in the repository.

## Verification evidence

Authoritative GitHub Actions proof:

- **Head SHA:** `9c049d7efab3b7d8aa1308d7dd203e0fdcae384a`
- **Workflow run:** `31012188433`
- **Node:** 22
- **Strict TypeScript type-check:** SUCCESS
- **Automated tests:** 18 passed, 0 failed
- **HTTP synthetic flow:** SUCCESS
- **PostgreSQL 16 service:** healthy
- **Migration `001_living_core.sql`:** SUCCESS
- **Migration `002_mining_local_content.sql`:** SUCCESS
- **npm audit:** 0 vulnerabilities reported for the current dependency set

The proven synthetic flow is:

```plain text
legal source
→ draft rule
→ human legal validation
→ workforce ingestion
→ advisory assessment
→ succession proposal
→ human HR approval
→ Mission Control snapshot
→ audit trail
```

## Database assets

Migration `database/002_mining_local_content.sql` adds:

- `mining_projects`;
- `local_content_legal_sources`;
- `local_content_rules`;
- `mining_workforce_records`;
- `local_content_assessments`;
- `succession_plans`;
- composite tenant-safe foreign keys;
- tenant-isolation RLS policies and operational indexes.

## Gate status

- **G0 Legal Source Gate — OPEN:** replace synthetic legal metadata with verified Guinean primary sources, hashes and legal validation evidence.
- **G1 Data Gate — OPEN:** define official HR/ERP import contracts, quality rules, retention and minimisation.
- **G2 API Gate — TEST_PROVEN:** governed application service and HTTP contract implemented and tested; production identity adapter remains open.
- **G3 E2E Gate — TEST_PROVEN:** full synthetic HTTP and service flows reproduced with audit trail.
- **G4 M6/S7+ Gate — M6 PASSED WITH CAPA; S7+ OPEN:** threat model, idempotency, rate limiting, persistent audit, privacy and rollback controls remain to close.
- **G5 M8 Gate — OPEN:** internal governance decision not executed.
- **G6 External Gate — OPEN:** legal and Big4-type review required before institutional production use.

## Next build increment

1. Produce and test the S7+ threat model and security controls.
2. Add idempotency protection to mutating API operations.
3. Define the production identity-verification contract without embedding a fake verifier.
4. Define persistent repository and audit-event ports for PostgreSQL/Supabase.
5. Create the official synthetic demo dataset and Mission Control evidence export.
6. Keep PR #9 in draft until S7+ and M8 readiness review.

No production, commercial-performance or legal-certification claim is authorized until all gates close with evidence.
