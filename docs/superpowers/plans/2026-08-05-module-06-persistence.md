# MODULE 06 Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MODULE 06 mutations, audit events, idempotency and emergency-stop controls persist atomically in PostgreSQL while preserving tenant isolation and all existing governance invariants.

**Architecture:** Convert the repository/service boundary to promises, add a transaction port, retain the in-memory adapter for deterministic unit tests, then add `pg`-backed adapters using parameterized SQL and `SET LOCAL app.tenant_id`. Integration tests run against the existing ephemeral PostgreSQL 16 service under a non-owner application role.

**Tech Stack:** TypeScript 5.6 strict, Node.js 22, `pg`, PostgreSQL 16, Node test runner, GitHub Actions.

## Global Constraints

- Keep PR #9 in draft.
- No real employee data or production credentials.
- No legal-certification or Production Ready claim.
- Business rules stay outside SQL and UI.
- Every mutation and its audit event commit or roll back together.
- RLS must be tested with a non-owner application role.
- Database and authentication failures fail closed.

---

### Task 1: Asynchronous transaction-capable repository port

**Files:**
- Modify: `apps/afria-workforce-intelligence/backend/src/mining-local-content-service.ts`
- Modify: `apps/afria-workforce-intelligence/backend/src/mining-local-content-api.ts`
- Modify: `apps/afria-workforce-intelligence/backend/tests/*.test.ts`
- Test: `apps/afria-workforce-intelligence/backend/tests/mining-local-content-transaction.test.ts`

**Interfaces:**
- Produces: `LocalContentRepository.transaction<T>(work): Promise<T>` and promise-returning repository methods.
- Produces: promise-returning `MiningLocalContentService` operations.

- [ ] Write a failing test with a repository whose `appendAuditEvent` throws and assert that `registerRuleDraft` leaves no rule after rollback.
- [ ] Convert `LocalContentRepository` methods to promises and add `transaction`.
- [ ] Implement snapshot/restore atomicity in `InMemoryLocalContentRepository.transaction`.
- [ ] Wrap every mutating service method in one repository transaction and await audit persistence.
- [ ] Await service methods in the HTTP adapter and update all tests.
- [ ] Run `npm run typecheck && npm test`; expected: all tests pass plus rollback test.
- [ ] Commit with `refactor: add transactional repository boundary`.

### Task 2: PostgreSQL business repository

**Files:**
- Modify: `apps/afria-workforce-intelligence/backend/package.json`
- Create: `apps/afria-workforce-intelligence/backend/src/mining-local-content-postgres.ts`
- Create: `apps/afria-workforce-intelligence/backend/tests/mining-local-content-postgres.test.ts`
- Modify: `.github/workflows/afria-workforce-rc2.yml`

**Interfaces:**
- Consumes: asynchronous `LocalContentRepository` from Task 1.
- Produces: `PostgresLocalContentRepository` and `SqlPool`/`SqlClient` narrow interfaces.

- [ ] Add `pg` and `@types/pg` dependencies.
- [ ] Write integration tests that seed tenant, identities, evidence, employees and project rows, then execute rule, workforce, assessment and succession flows through the service.
- [ ] Implement parameterized inserts, updates, reads, hydration and Mission Control counts.
- [ ] In `transaction`, acquire one client, execute `BEGIN`, `set_config('app.tenant_id', $1, true)`, work, `COMMIT`; on failure execute `ROLLBACK` and rethrow a controlled error.
- [ ] Add a forced audit-insert failure test and assert the business insert is absent.
- [ ] Add non-owner application-role tests proving cross-tenant read/write isolation.
- [ ] Update CI to run integration tests with `DATABASE_URL` and the non-owner role setup.
- [ ] Run the complete CI workflow; expected: type-check, unit tests, integration tests and migrations pass.
- [ ] Commit with `feat: add transactional PostgreSQL local-content repository`.

### Task 3: Persistent idempotency and emergency-stop adapters

**Files:**
- Create: `apps/afria-workforce-intelligence/backend/src/mining-local-content-postgres-security.ts`
- Create: `apps/afria-workforce-intelligence/backend/tests/mining-local-content-postgres-security.test.ts`

**Interfaces:**
- Consumes: `IdempotencyStore` and `ApiRequestGuard`.
- Produces: `PostgresIdempotencyStore` and `PostgresEmergencyStopGuard`.

- [ ] Write tests for idempotency insert, replay, expiry deletion and concurrent same-key behavior.
- [ ] Implement `PostgresIdempotencyStore` with parameterized SQL and deterministic JSON/header serialization.
- [ ] Write tests for tenant-specific emergency stop, resume and fail-closed database error.
- [ ] Implement `PostgresEmergencyStopGuard` against `local_content_module_controls`.
- [ ] Run all tests and PostgreSQL integration tests; expected: all pass.
- [ ] Commit with `feat: persist Module 06 security controls`.

### Task 4: Evidence, CAPA and gate update

**Files:**
- Modify: `apps/afria-workforce-intelligence/backend/MODULE-06.md`
- Modify: `apps/afria-workforce-intelligence/backend/SECURITY-MODULE-06.md`
- Modify: GitHub issue #10 and PR #9 comments.
- Modify: canonical Notion MODULE 06, M8 readiness and R.E.M.E pages.

- [ ] Record final SHA, workflow run, test count, transaction proof, RLS proof and rollback proof.
- [ ] Close only CAPA items actually proven by CI.
- [ ] Keep production, real-data, legal-source, cockpit and institutional IdP gates open.
- [ ] Re-run final CI on the documentation head.
- [ ] Commit with `docs: record Module 06 persistence proof`.