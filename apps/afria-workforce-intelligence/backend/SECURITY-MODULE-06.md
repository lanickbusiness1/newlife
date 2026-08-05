# S7+ Security Review — MODULE 06

**Asset:** Mining Local Content, Workforce & Value Retention Intelligence™  
**Canonical parent:** `BP-MINING-GN-001 — AfrIAgenesis® Sovereign Mining OS™ Guinée`  
**Review date:** 2026-08-05  
**Scope:** domain, service, HTTP API, identity, operational guards, PostgreSQL controls, CI and rollback  
**Verdict:** **S7+ CONDITIONAL GO FOR SYNTHETIC SANDBOX / NO-GO FOR PRODUCTION**

## 1. Protected assets

- legal-source artifacts, metadata, versions and fingerprints;
- human approval evidence;
- employee and expatriate assignment references;
- nationality and workforce-category records;
- compensation-cost fields;
- compliance assessments and gaps;
- succession candidates, skills and target dates;
- tenant controls, audit events and Mission Control indicators;
- authentication claims, roles, idempotency records and emergency-stop state.

No biometric data is required or authorised by the current model.

## 2. Trust boundaries

1. Client or cockpit → API ingress.
2. API ingress → Bearer token verification.
3. JWT verifier → signing-key/JWKS provider.
4. Authenticated API → request guards.
5. API adapter → governed application service.
6. Application service → business repository and audit sink.
7. Persistence layer → PostgreSQL with RLS.
8. CI runner → source repository and ephemeral PostgreSQL.
9. Legal officer → source validation and approval evidence.
10. HR officer → succession approval evidence.

`InMemoryAuthContextResolver`, in-memory guards and the in-memory repository are test adapters only. They must never constitute public-ingress identity or institutional production persistence.

## 3. Threat model

| STRIDE class | Primary threat | Implemented control | Residual risk / CAPA |
|---|---|---|---|
| Spoofing | Actor or tenant impersonation | Native RS256 signature verification; issuer/audience/`kid`/expiry checks; Bearer resolver; tenant-bound actor context | Configure institutional issuer, JWKS retrieval/cache, key rotation and revocation |
| Tampering | Altered law, approval or command replay | SHA-256 source/evidence fingerprints; legal effectivity; idempotency request hashes; database constraints | Store source files and signed approval artifacts in immutable evidence storage |
| Repudiation | Denial of legal, assessment or succession action | Governed audit events; append-only database trigger; event/previous-hash fields | Wire runtime audit sink, chain verification and external timestamping |
| Information disclosure | Cross-tenant HR or audit access | Tenant-scoped service; composite tenant FKs; RLS `FOR ALL`/`WITH CHECK`/`FORCE RLS`; controlled errors | Test non-owner application roles; add field masking and approved privacy model |
| Denial of service | Oversized, malformed or repeated requests | Byte limits; JSON-only; fixed-window rate limiter; workflow timeout; emergency stop | Use distributed gateway limiter, concurrency/batch ceilings and infrastructure autoscaling controls |
| Elevation of privilege | Role injection or agent self-approval | Roles derived from verified claims; payload identity ignored; human-only legal/HR approvals; separation of role endpoints | Add institutional policy engine, SoD administration and privileged-access reviews |

## 4. Tested abuse and failure cases

- valid identity replayed under another tenant is rejected;
- identity headers are ignored by the Bearer resolver;
- expired tokens are rejected;
- tampered JWT payloads fail signature verification;
- wrong issuer, audience, key ID and unsupported algorithm are rejected;
- future, expired and structurally invalid claims are rejected;
- a viewer cannot access audit endpoints;
- tenant, actor and roles injected into payloads are ignored;
- agents cannot validate law or approve succession;
- future or expired legal rules cannot be evaluated;
- cross-tenant evidence and workforce records are rejected;
- unsupported media types and malformed JSON are controlled;
- oversized payloads return 413;
- repeated requests are rate-limited with `Retry-After`;
- emergency-stop state blocks protected routes with 503;
- successful mutations can be replayed without duplicate execution;
- idempotency-key reuse with a different payload returns conflict;
- unknown routes return controlled 404 responses;
- stacks are not leaked; caching and MIME sniffing are disabled; CORS is not enabled implicitly;
- audit UPDATE/DELETE is blocked by PostgreSQL;
- duplicate idempotency records and invalid stop records are blocked;
- security migration rollback and re-application succeed.

## 5. Identity security

### TEST_PROVEN

- `Rs256JwtAccessTokenVerifier` validates native RSA SHA-256 signatures without accepting `none` or alternative algorithms;
- issuer and audience are mandatory;
- signing key ID is mandatory and resolved through a key-provider interface;
- `iat`, optional `nbf`, `exp`, token ID, tenant, jurisdiction, actor type, display name and roles are validated;
- configurable clock skew is bounded to 0–300 seconds;
- Bearer context is reconstructed only after verification.

### OPEN before production

- actual institutional OIDC issuer configuration;
- HTTPS JWKS retrieval, cache, rotation and outage policy;
- token revocation/introspection decision;
- MFA and privileged-access policy;
- service-account lifecycle and workload identity;
- security monitoring for repeated auth failure and anomalous claims.

## 6. Data protection controls

### Implemented

- data minimisation in the kernel;
- no biometric fields;
- no production secrets or credentials committed;
- tenant and project isolation;
- advisory-only outputs;
- source and approval integrity fingerprints;
- controlled errors and audit metadata;
- emergency-stop schema and tenant isolation.

### Required before real data

- lawful-basis and purpose register;
- privacy impact assessment;
- field classification and retention schedule;
- encrypted transport/storage and key rotation;
- field-level controls for compensation and succession data;
- access/correction/deletion processes where applicable;
- approved data residency and cross-border transfer model;
- backup, restore and verified deletion evidence.

## 7. Persistent operational controls

Migration `003_security_operations.sql` implements:

- tenant module enable/stop state;
- append-only audit table with integrity hashes;
- durable idempotency table;
- uniqueness, effective integrity and tenant-bound foreign keys;
- RLS hardening of security and base workforce tables.

Verification proves:

- valid control/audit/idempotency inserts;
- append-only mutation rejection;
- duplicate-key rejection;
- invalid emergency-stop rejection;
- migration DOWN removes security tables;
- table-removal assertions pass;
- migration 003 can be re-applied successfully.

The schemas are proven, but production runtime adapters are not yet wired to the API/service. This remains a release blocker.

## 8. Supply-chain and CI controls

- Node.js 22 explicitly selected;
- runner fixed to Ubuntu 24.04;
- workflow permissions restricted to `contents: read`;
- workflow timeout fixed at 15 minutes;
- GitHub Actions pinned to commit SHAs;
- PostgreSQL 16 image pinned by digest;
- dependency audit runs on every relevant push/PR;
- strict type-check and all tests run before database verification;
- migrations execute with `ON_ERROR_STOP=1`;
- no deployment credential is used.

## 9. Rollback and emergency controls

### TEST_PROVEN

- tenant-level emergency-stop guard;
- persistent emergency-control schema;
- reversible migration 003;
- removal assertions and re-application in CI.

### OPEN before production

- infrastructure routing kill switch;
- named authority and dual-control procedure for stop/resume;
- incident freeze preserving evidence;
- full business migration restore test;
- application deployment rollback;
- post-rollback health and data-integrity verification;
- operational incident simulation.

## 10. S7+ decision matrix

| Control family | Status |
|---|---|
| Native signed-token verification | TEST_PROVEN |
| Institutional issuer/JWKS integration | OPEN |
| RBAC and human approvals | TEST_PROVEN |
| Tenant/project isolation | TEST_PROVEN at domain/service/schema level |
| Legal-source integrity | TEST_PROVEN with synthetic data |
| Input validation and error safety | TEST_PROVEN |
| Rate limiting | TEST_PROVEN in-memory; distributed control OPEN |
| Idempotency | TEST_PROVEN in-memory and schema; wired persistent adapter OPEN |
| Audit generation | TEST_PROVEN in-memory |
| Persistent append-only audit schema | TEST_PROVEN; runtime sink OPEN |
| Emergency stop | TEST_PROVEN in-memory and schema; operational wiring OPEN |
| Privacy governance for real HR data | OPEN |
| Migration application | TEST_PROVEN |
| Security migration rollback | TEST_PROVEN |
| Full application rollback and incident response | OPEN |

## 11. Evidence

- Code evidence SHA: `d8fdcd01f068a06b4fe0fcc69e16263c12b8a709`
- GitHub Actions run: `31014286308` — SUCCESS
- Strict type-check: SUCCESS
- Automated tests: **35/35 passed**
- Dependency audit: 0 vulnerabilities reported
- PostgreSQL migrations and SQL controls: SUCCESS
- Rollback and re-apply: SUCCESS

## 12. Verdict

**GO** for continued Build Factory, synthetic demonstrations, security integration and M8 remediation.

**NO-GO** for production, real employee ingestion, public exposure, official legal assessment or institutional decisioning until all of the following are closed:

- institutional issuer/JWKS integration;
- PostgreSQL business repository and persistent security adapters wired to runtime;
- distributed rate limiting and operational stop controls;
- privacy/data-retention and field-access approval;
- full deployment rollback and incident simulation;
- verified Guinean primary legal sources;
- Mission Control browser QA;
- human M8 and external legal/Big4-type review.
