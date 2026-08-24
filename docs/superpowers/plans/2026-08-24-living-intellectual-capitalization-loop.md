# V4-DEC-016 Living Intellectual Capitalization Loop™ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the governed Chat/signal → canonical Notion → GENESIS V4 → AfrIAgenesis® book → product/execution → evidence → R.E.M.E™ loop defined by V4-DEC-016.

**Architecture:** Extend the existing MCP control plane with a deterministic capitalization module and three least-privilege tools. Persist the audit model in a private Supabase schema while keeping third-party writes connector-driven through idempotent write contracts and execution receipts.

**Tech Stack:** TypeScript 5.9, Node 24 CI, Vitest 3.2, MCP SDK, Zod, PostgreSQL 17 / Supabase.

**Spec:** `docs/superpowers/specs/2026-08-24-living-intellectual-capitalization-loop-design.md`

## Global Constraints

- V4-DEC-016 is already CEO validated; do not reopen product/design scope.
- ChatGPT memory remains non-canonical.
- No Notion/Supabase/service-role secret is committed.
- No direct browser/Data API exposure for the capitalization ledger.
- No new product or duplicate Loop Engineering engine.
- External writes require connector receipts before claiming completion.
- TDD is mandatory: RED before GREEN for runtime behavior.

---

### Task 1: Create RED tests for the capitalization domain

**Files:**
- Create: `services/mcp-server/tests/livingIntellectualCapitalization.test.ts`

**Interfaces:**
- Consumes: none; imports the not-yet-created runtime module and reads `src/index.ts`, migration and rollback files.
- Produces: executable behavioral contract for all V4-DEC-016 runtime requirements.

- [ ] **Step 1: Add failing tests**

The test suite imports:

```ts
import {
  compileChatSignal,
  evaluateEditorialSignal,
  compileCapitalizationPlan,
  recordCapitalizationEvidence,
  GENESIS_V4_LIVING_INTELLECTUAL_CAPITALIZATION_ANCHOR
} from "../src/livingIntellectualCapitalization";
```

It must test:

```ts
test("routes a verified durable signal to canonical, book and product execution", () => { /* assertions from spec */ });
test("fails closed for unverified or low-confidence signals", () => { /* assertions from spec */ });
test("rejects an exact normalized fingerprint duplicate", () => { /* assertions from spec */ });
test("allows a short validated decision with canonical decision evidence", () => { /* assertions from spec */ });
test("omits book target when editorial value is below threshold", () => { /* assertions from spec */ });
test("closes evidence as COMPLETE only when every planned target succeeded", () => { /* assertions from spec */ });
test("registers three least-privilege capitalization MCP tools", () => { /* index source assertions */ });
test("migration and rollback enforce the private ledger boundary", () => { /* SQL source assertions */ });
```

- [ ] **Step 2: Open a PR to run CI and verify RED**

Expected CI failure: module `../src/livingIntellectualCapitalization` and migration/rollback artifacts do not exist.

- [ ] **Step 3: Capture the failed CI run as TDD evidence**

Record the run number and failing test reason in the PR and later in Notion/R.E.M.E.

---

### Task 2: Implement deterministic signal normalization and Editorial Signal Gate™

**Files:**
- Create: `services/mcp-server/src/livingIntellectualCapitalization.ts`

**Interfaces:**
- Produces:
  - `compileChatSignal(input: ChatSignalInput): NormalizedChatSignal`
  - `evaluateEditorialSignal(signal: NormalizedChatSignal, existingFingerprints?: string[]): EditorialGateResult`
  - exported anchor `GENESIS_V4_LIVING_INTELLECTUAL_CAPITALIZATION_ANCHOR`

- [ ] **Step 1: Implement `compileChatSignal` minimally**

Normalize whitespace, trim references, de-duplicate arrays and produce deterministic FNV-1a IDs/fingerprints.

- [ ] **Step 2: Implement `evaluateEditorialSignal` minimally**

Implement the mandatory fail-closed rules and thresholds in the spec. Return explicit reasons, five score dimensions, total score, `bookCandidate`, `executionCandidate` and status.

- [ ] **Step 3: Push and confirm the relevant RED tests turn GREEN**

Expected: normalization/gate tests pass; plan/evidence/integration tests remain red.

---

### Task 3: Implement plan compilation and proof closure

**Files:**
- Modify: `services/mcp-server/src/livingIntellectualCapitalization.ts`

**Interfaces:**
- Produces:
  - `compileCapitalizationPlan(signal, gate): CapitalizationPlan`
  - `recordCapitalizationEvidence(plan, receipts): CapitalizationProof`

- [ ] **Step 1: Implement target generation**

Generate idempotent write contracts for `notion_canonical`, `genesis_v4`, `book_manuscript` and one `product_execution` target per distinct product reference.

- [ ] **Step 2: Implement receipt closure**

Return `COMPLETE`, `PARTIAL` or `FAILED`, failed/missing target IDs, receipt lineage and next gate (`REME_CANDIDATE` or `EXECUTION_REPAIR`).

- [ ] **Step 3: Push and verify domain tests GREEN**

---

### Task 4: Register the three MCP tools

**Files:**
- Modify: `services/mcp-server/src/index.ts`
- Test: `services/mcp-server/tests/livingIntellectualCapitalization.test.ts`

**Interfaces:**
- `genesis.capitalization.evaluate_signal` requires `capitalization:evaluate`
- `genesis.capitalization.compile_plan` requires `capitalization:plan`
- `genesis.capitalization.record_evidence` requires `capitalization:evidence`

- [ ] **Step 1: Import the module and register tools**

Handlers must preserve `tenantId`, use existing `RequestContext`, and return deterministic domain objects through `governed()`.

- [ ] **Step 2: Expose the anchor in `/health`**

Add `livingIntellectualCapitalization` to the health payload and update the control-plane revision.

- [ ] **Step 3: Run CI and verify registration tests GREEN**

---

### Task 5: Add private Supabase ledger and rollback artifact

**Files:**
- Create: `supabase/migrations/<supabase-generated-version>_living_intellectual_capitalization.sql`
- Create: `supabase/rollbacks/<same-version>_living_intellectual_capitalization_rollback.sql`
- Modify: `.github/workflows/mcp-ci.yml`
- Test: `services/mcp-server/tests/livingIntellectualCapitalization.test.ts`

**Interfaces:**
- Schema: `genesis_capitalization`
- Tables: `chat_signals`, `editorial_gate_evaluations`, `capitalization_plans`, `capitalization_targets`, `execution_receipts`, `proof_chains`

- [ ] **Step 1: Add SQL migration**

Use PostgreSQL 17-compatible DDL. Use UUID primary keys with `gen_random_uuid()`, foreign keys, timestamps, unique fingerprint/idempotency constraints, JSONB metadata, and check constraints for statuses.

- [ ] **Step 2: Enforce private boundary**

Run:

```sql
revoke all on schema genesis_capitalization from public, anon, authenticated;
revoke all on all tables in schema genesis_capitalization from public, anon, authenticated;
```

Enable RLS on every table. Do not create permissive policies or `SECURITY DEFINER` functions.

- [ ] **Step 3: Add rollback artifact**

Rollback must contain only:

```sql
drop schema if exists genesis_capitalization cascade;
```

and a comment that production evidence must be exported before destructive rollback.

- [ ] **Step 4: Extend MCP CI path filters**

Add `supabase/migrations/**` and `supabase/rollbacks/**` so ledger changes always trigger verification.

- [ ] **Step 5: Verify SQL-source assertions GREEN in CI**

---

### Task 6: Full repository verification and security review

**Files:**
- No new production files unless a failing gate requires a targeted fix.

- [ ] **Step 1: Verify GitHub CI**

Required MCP CI steps: `npm ci --ignore-scripts`, `npm audit --audit-level=high`, `npm run typecheck`, `npm test`, `npm run build`.

- [ ] **Step 2: Review CI output**

No high/critical audit finding, type error, test failure or build failure is acceptable.

- [ ] **Step 3: Apply the migration to the repository-linked Supabase project**

Target is the project named by `supabase/config.toml` (`afria-recruit`) unless canonical project resolution changes before execution.

- [ ] **Step 4: Run Supabase security and performance advisors**

Review all notices introduced by the new schema and fix feature-caused issues.

- [ ] **Step 5: Verify tables and privilege boundary with SQL**

Query `information_schema` / `pg_class` to prove six tables exist, RLS is enabled and `anon`/`authenticated` have no schema/table privileges.

---

### Task 7: Execute one real V4-DEC-016 proof loop

**Files:**
- No credential-bearing code.

**Interfaces:**
- Uses ChatGPT/Notion authorized connectors for external writes.
- Records returned references as execution receipts in the proof object/ledger.

- [ ] **Step 1: Use the current V4-DEC-016 decision as the first signal fixture**

Canonical decision reference: `V4-DEC-016`.

- [ ] **Step 2: Execute idempotent writes**

Ensure the canonical Notion decision and AfrIAgenesis® book contain the implementation-status update and links to repository/CI evidence, without duplicating existing editorial material.

- [ ] **Step 3: Record receipts and compile proof**

Proof must return `COMPLETE` and `nextGate = REME_CANDIDATE` for the targets actually planned.

- [ ] **Step 4: Persist R.E.M.E evidence**

Record code branch/commit, PR, CI run, Supabase migration/advisor result, Notion canonical receipt and book receipt.

---

### Task 8: M6 → S7+ → M8 → merge / rollback gate

**Files:**
- Update evidence documentation/Notion only as needed.

- [ ] **Step 1: M6**

Confirm deterministic behavior, tests, typecheck, build and schema integrity.

- [ ] **Step 2: S7+**

Confirm least privilege, no secret leakage, private schema, fail-closed editorial gate, idempotence and rollback artifact.

- [ ] **Step 3: M8**

Confirm V4-DEC-016 scope, no product duplication, no canonical-memory bypass and complete evidence lineage.

- [ ] **Step 4: Merge only after all gates are green**

Update Notion status from `SPÉCIFIÉ — NON ENCORE CODÉ` to the exact proven state. Never claim deployment or end-to-end completion before the corresponding receipts exist.
