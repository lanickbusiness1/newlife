# Mining Local Content Module 06 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend AfrIA Workforce Intelligence with a source-gated mining local-content kernel that measures national/expatriate workforce compliance and governs succession plans without autonomous legal or HR decisions.

**Architecture:** Reuse the existing OOP living core, tenant isolation, human approval identities, evidence vault and event conventions on `feature/afria-workforce-intelligence-rc2`. Add one bounded domain module and one PostgreSQL migration; do not create a separate product or duplicate the workforce core.

**Tech Stack:** TypeScript 5.6+, Node.js 22, Node test runner through `tsx`, PostgreSQL/Supabase RLS, GitHub Actions.

## Global Constraints

- Canonical parent: `BP-MINING-GN-001 — AfrIAgenesis® Sovereign Mining OS™ Guinée`.
- Module ID: `BP-MINING-GN-001 / MODULE-06 / v1.0-DOCUMENTED`.
- No legal rule is executable without source ID, HTTPS URL, jurisdiction, version, effective date, evidence and human legal approval.
- No succession plan is approved by an agent; a human with `HR_APPROVER` is mandatory.
- Every evaluation is advisory and must never claim legal certification.
- Tenant and mining-project isolation are mandatory.
- No real employee data, secrets, biometrics or production credentials are committed.
- Production readiness remains blocked pending M6, S7+, M8 and external review.

---

### Task 1: Contract tests for legal-source gating and local-content assessment

**Files:**
- Create: `apps/afria-workforce-intelligence/backend/tests/mining-local-content.test.ts`

**Interfaces:**
- Consumes: `Tenant`, `Identity`, `ControlError`, `InMemoryEvidenceVault`.
- Produces: behavioral contract for `LocalContentRule`, `MiningWorkforceRecord`, `LocalContentComplianceEngine`, and `SuccessionPlan`.

- [ ] **Step 1: Write failing tests** for draft-rule blocking, agent approval blocking, ratio/gap calculation, evidence coverage, no-data behavior, tenant/project isolation, and succession approval.
- [ ] **Step 2: Run the focused test** with `npm test -- tests/mining-local-content.test.ts`; expect failure because `src/mining-local-content.ts` does not exist.
- [ ] **Step 3: Commit** with `test: define mining local content controls`.

### Task 2: Mining local-content domain kernel

**Files:**
- Create: `apps/afria-workforce-intelligence/backend/src/mining-local-content.ts`

**Interfaces:**
- Consumes: `EnterpriseObject`, `EvidenceRef`, `Identity`, `Tenant`, `EmployeeState`, `ControlError`.
- Produces:
  - `MiningWorkforceRecord`
  - `LegalSourceRef`
  - `LocalContentRule.validate(actor, proof)`
  - `LocalContentComplianceEngine.evaluate(input)`
  - `SuccessionPlan.readinessPercent()`
  - `SuccessionPlan.approve(actor, proof)`

- [ ] **Step 1: Implement the minimum domain code** required by Task 1.
- [ ] **Step 2: Run all tests** with `npm test`; expect eight passing tests.
- [ ] **Step 3: Run strict type-check** with `npm run typecheck`; expect zero errors.
- [ ] **Step 4: Commit** with `feat: add mining local content kernel`.

### Task 3: Sovereign persistence and RLS

**Files:**
- Create: `apps/afria-workforce-intelligence/backend/database/002_mining_local_content.sql`

**Interfaces:**
- Consumes: `workforce_tenants`, `workforce_identities`, `workforce_employees`, `workforce_evidence` from migration 001.
- Produces: projects, legal sources, rules, workforce records, assessments and succession plans with tenant RLS.

- [ ] **Step 1: Create normalized tables** with explicit check constraints and foreign keys.
- [ ] **Step 2: Enable RLS** on every tenant-owned table.
- [ ] **Step 3: Add tenant isolation policies** using `current_setting('app.tenant_id', true)`.
- [ ] **Step 4: Add indexes** for tenant/project/category and assessment history.
- [ ] **Step 5: Commit** with `feat: add local content persistence model`.

### Task 4: Module documentation and operational gates

**Files:**
- Create: `apps/afria-workforce-intelligence/backend/MODULE-06.md`

**Interfaces:**
- Consumes: implemented domain and migration.
- Produces: source-of-truth build note, commands, safety gates and next release scope.

- [ ] **Step 1: Document the implemented scope** without claiming deployment.
- [ ] **Step 2: Record commands** for tests and type-check.
- [ ] **Step 3: Record open gates** for verified Guinean primary sources, API, data ingestion, M6/S7+/M8 and Big4 review.
- [ ] **Step 4: Commit** with `docs: record module 06 build evidence`.

### Task 5: CI and review gate

**Files:**
- Existing: `.github/workflows/afria-workforce-rc2.yml`

**Interfaces:**
- Consumes: backend tests and TypeScript compiler.
- Produces: pull-request proof of life.

- [ ] **Step 1: Open a draft PR** from `feature/mining-local-content-module-06` into `feature/afria-workforce-intelligence-rc2`.
- [ ] **Step 2: Verify GitHub Actions** runs `npm install`, `npm run typecheck`, and `npm test`.
- [ ] **Step 3: Keep PR draft** until M6 review and evidence checks are complete.
