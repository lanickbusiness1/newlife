# S7+ Security Review — MODULE 06

**Asset:** Mining Local Content, Workforce & Value Retention Intelligence™  
**Canonical parent:** `BP-MINING-GN-001 — AfrIAgenesis® Sovereign Mining OS™ Guinée`  
**Review date:** 2026-08-05  
**Scope:** domain kernel, application service, HTTP contract, PostgreSQL migration and CI pipeline  
**Verdict:** **S7+ CONDITIONAL GO FOR SANDBOX / NO-GO FOR PRODUCTION**

## 1. Protected assets

- legal-source metadata, versions and fingerprints;
- human approval evidence;
- employee and expatriate assignment references;
- nationality status and workforce-category records;
- compensation-cost fields;
- compliance assessments and gaps;
- succession candidates, skills and target dates;
- audit events and Mission Control indicators;
- tenant, project, actor and role boundaries.

No biometric data is required or authorized by the current model.

## 2. Trust boundaries

1. Public or institutional client → API ingress.
2. API ingress → verified identity provider.
3. API adapter → governed application service.
4. Application service → persistence repository.
5. Persistence repository → PostgreSQL with RLS.
6. CI runner → source repository and ephemeral PostgreSQL.
7. Legal officer → source validation and approval evidence.
8. HR officer → succession approval evidence.

`InMemoryAuthContextResolver` crosses no production trust boundary. It is a deterministic test adapter and must not be connected to a public ingress.

## 3. Threat model

| STRIDE class | Primary threat | Existing control | Residual risk / CAPA |
|---|---|---|---|
| Spoofing | Actor or tenant header impersonation | Resolver binds actor identity to tenant; cross-tenant replay test; service-level tenant checks | Replace test headers with verified OIDC/JWT claims and issuer/audience validation |
| Tampering | Altered legal source or approval evidence | SHA-256 fingerprints; version and effective-date checks; human approval gates | Store source artifact and signed approval evidence in immutable evidence storage |
| Repudiation | Denial of rule, assessment or succession action | Six governed audit events with actor, kind, timestamp, aggregate and payload | Persist append-only audit events; add retention and external timestamping policy |
| Information disclosure | Cross-tenant HR or audit exposure | Tenant-scoped repository, composite FKs, RLS `FOR ALL`, `WITH CHECK`, `FORCE RLS`; controlled errors | Add PostgreSQL integration tests using non-owner application roles; define field-level masking |
| Denial of service | Oversized or malformed payloads | Configurable byte limit; JSON-only; early validation | Add gateway rate limiting, concurrency limits, timeouts and batch-size ceilings |
| Elevation of privilege | Payload role injection or agent self-approval | Roles come only from auth context; manual parsers ignore identity fields; human-only legal/HR gates | Enforce production policy engine and separation-of-duty review |

## 4. Abuse cases tested

- a valid identity replayed under another tenant is rejected;
- a viewer cannot access the audit trail;
- injected `tenantId`, actor or roles in request bodies are ignored;
- unsupported media types are rejected before parsing;
- unknown routes return controlled 404 responses;
- malformed JSON does not expose stacks;
- oversized payloads return 413;
- cross-tenant domain evidence is rejected;
- expired or future legal rules cannot be evaluated;
- agents cannot validate law or approve succession;
- response caching is disabled and MIME sniffing is blocked;
- CORS is not enabled implicitly.

## 5. Data protection controls

### Implemented

- data minimisation at the current kernel level;
- no biometric fields;
- no secrets or production credentials committed;
- tenant and project isolation;
- explicit evidence coverage rather than inferred truth;
- advisory-only compliance outputs;
- source and approval fingerprints;
- controlled error responses.

### Required before real data

- lawful basis and purpose register;
- field classification and retention schedule;
- encrypted transport and encrypted storage;
- key-management and rotation procedure;
- data-subject access/correction workflow where applicable;
- field-level access for salary and succession data;
- approved cross-border data-transfer policy;
- backup, restore and verified deletion procedures.

## 6. Supply-chain and CI controls

- Node.js 22 is explicitly selected;
- dependency installation, strict type-check and all tests run on every relevant push/PR;
- PostgreSQL 16 is created ephemerally and both migrations are applied with `ON_ERROR_STOP=1`;
- current dependency audit reports zero vulnerabilities;
- GitHub Actions are pinned to reviewed commit SHAs in the workflow;
- no deployment credential is used in the proof workflow.

## 7. Rollback and emergency stop

Before deployment, the release package must include:

1. reversible migration or tested database restore point;
2. feature flag or routing kill switch for MODULE 06 endpoints;
3. identity-provider disable path;
4. tenant-level suspension switch;
5. evidence-preserving incident freeze;
6. rollback runbook with named human authority;
7. post-rollback verification checklist.

The current repository proves schema creation, not rollback execution. This remains an open production gate.

## 8. S7+ decision matrix

| Control family | Status |
|---|---|
| Identity boundary design | CONDITIONAL — production verifier absent |
| RBAC and human approvals | TEST_PROVEN |
| Tenant/project isolation | TEST_PROVEN at domain/service; SQL schema proven |
| Legal source integrity | TEST_PROVEN with synthetic data |
| Input validation and error safety | TEST_PROVEN |
| Audit generation | TEST_PROVEN in-memory |
| Persistent immutable audit | OPEN |
| Rate limiting and operational DoS controls | OPEN |
| Privacy governance for real HR data | OPEN |
| Migration application | TEST_PROVEN |
| Rollback execution | OPEN |
| Incident response and kill switch | OPEN |

## 9. Verdict

**GO** for continued sandbox engineering, synthetic demonstrations and M8 preparation.

**NO-GO** for production, real employee ingestion, public exposure, legal certification or institutional decisioning until the following are closed:

- cryptographically verified production identity adapter;
- persistent repository and append-only audit implementation;
- gateway rate limiting and timeouts;
- privacy/data-retention controls;
- rollback and emergency-stop proof;
- verified Guinean legal sources;
- M8 review and external legal/Big4-type review.
