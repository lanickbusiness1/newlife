# GENESIS V4 World Model Runtime Proof #1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the canonical GENESIS V4 MCP server with a deterministic, evidence-backed World Model Runtime Proof for the AfrIA Recruit Auto-GTM pilot.

**Architecture:** Keep the proof inside `services/mcp-server`. A focused `worldModelRuntime.ts` implements observation validation, state reconstruction, scenario simulation, decision/action contracts, and outcome evaluation. MCP tools expose this deterministic control plane; no live messaging or financial side effect is added.

**Tech Stack:** TypeScript 5.9, Node.js 24, Vitest 3.2, MCP SDK 1.30, Zod 3.25, existing GitHub Actions MCP CI.

**Spec:** `docs/superpowers/specs/2026-08-18-genesis-world-model-runtime-proof-design.md`

## Global Constraints

- Reuse the existing `services/mcp-server`; create no new service or framework.
- Preserve GENESIS V4 evidence lineage and World Model consultation invariants.
- P0 actions are reversible sandbox contracts only; no real email, WhatsApp, payment, legal, institutional, or irreversible action.
- No missing business metric may be silently imputed.
- No `TEST_PROVEN` claim without fresh CI: audit, typecheck, tests, build.
- SQL staging persistence is explicitly out of P0 until the full canonical SQL dependency chain is executable in an authorized staging database.

---

### Task 1: World Model Runtime Core

**Files:**
- Create: `services/mcp-server/src/worldModelRuntime.ts`
- Test: `services/mcp-server/tests/worldModelRuntime.test.ts`

**Interfaces:**
- Produces: `reconstructWorldState(observations)`, `simulateScenarios(state, scenarios)`, `decideNextAction(state, simulations)`, `evaluateOutcome(decision, actual)` and domain types used by Task 2.

- [ ] **Step 1: Write failing tests** for confidence bounds, evidence-preserving state reconstruction, deterministic ranking, non-reversible exclusion, rollback/idempotency contract, and prediction-error evaluation.
- [ ] **Step 2: Run MCP CI** and verify the new suite fails because `worldModelRuntime.ts` is absent.
- [ ] **Step 3: Implement minimal deterministic core** with explicit numeric inputs and no imputation.
- [ ] **Step 4: Run CI** and require all new and historical tests to pass.
- [ ] **Step 5: Commit** the core and tests.

### Task 2: MCP Governed Tool Surface

**Files:**
- Modify: `services/mcp-server/src/index.ts`
- Test: `services/mcp-server/tests/worldModelRuntime.test.ts`

**Interfaces:**
- Consumes Task 1 functions.
- Produces MCP capabilities `world.reconstruct_state`, `world.simulate`, `world.decide`, `world.evaluate_outcome`.

- [ ] **Step 1: Add a failing source-contract test** proving the MCP index exposes all four tool names and preserves governed scope checks.
- [ ] **Step 2: Run CI** and verify failure before exposure.
- [ ] **Step 3: Register tools** with scopes `world:read`, `world:simulate`, `world:decide`, `world:evaluate`; bump MCP service version.
- [ ] **Step 4: Run audit, typecheck, tests and build**.
- [ ] **Step 5: Commit** MCP exposure.

### Task 3: AfrIA Recruit Auto-GTM Proof Fixture

**Files:**
- Create: `services/mcp-server/src/fixtures/afriaRecruitAutoGtm.ts`
- Test: `services/mcp-server/tests/afriaRecruitAutoGtmProof.test.ts`

**Interfaces:**
- Produces explicit synthetic observations, three synthetic strategy scenarios, and an explicit synthetic actual outcome.
- Consumes Task 1 runtime functions.

- [ ] **Step 1: Write failing end-to-end proof test** that executes observation → state → 3 simulations → selected reversible decision → explicit outcome → learning/improvement candidate.
- [ ] **Step 2: Verify RED** in CI.
- [ ] **Step 3: Add the synthetic fixture** with every synthetic metric labeled and evidence-referenced.
- [ ] **Step 4: Verify GREEN** and ensure the chosen action is reversible and the outcome evaluation has forecast error and learning.
- [ ] **Step 5: Commit** the fixture and proof test.

### Task 4: Evidence Pack and Release Gate

**Files:**
- Create: `services/mcp-server/docs/world-model-runtime-proof.md`
- Modify: `services/mcp-server/README.md`

**Interfaces:**
- Documents exact test command, proof boundary, canonical Drive SQL references, and promotion gates `TEST_PROVEN → STAGING_PROVEN → PRODUCTION_PROVEN`.

- [ ] **Step 1: Capture fresh CI evidence** after all implementation commits.
- [ ] **Step 2: Document the proof** including commit SHA, CI run, tests, limitations, rollback semantics, and the fact that SQL staging migration is not yet claimed.
- [ ] **Step 3: Run final CI** after docs/readme changes.
- [ ] **Step 4: Open/refresh PR and perform review** for spec coverage and evidence honesty.
- [ ] **Step 5: Merge only after fresh green CI**, then verify `main` contains the runtime proof.

### Task 5: Delivery Relay

**Files:** No new code unless deployment verification exposes a defect.

**Interfaces:**
- Consumes the existing `render.yaml` auto-deploy contract and `deploybot.validation_relay.compile` state machine.

- [ ] **Step 1: Confirm main CI after merge**.
- [ ] **Step 2: Discover the real provider deployment endpoint/logs through available connected tools; never guess the URL.**
- [ ] **Step 3: If endpoint is observable, verify `/health`, service version, World Model capability marker, and rollback/reversibility evidence.**
- [ ] **Step 4: Promote to `PRODUCTION_PROVEN` only if Step 3 is evidenced; otherwise retain `TEST_PROVEN` and record the precise missing provider proof in R.E.M.E.**
- [ ] **Step 5: Hand off to the next revenue/live-pilot action only within existing A0-A3 delegation.**
