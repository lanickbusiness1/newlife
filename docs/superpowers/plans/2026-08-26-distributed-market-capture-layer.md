# Distributed Market Capture Layer™ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the deterministic v0.1 Distributed Market Capture Layer™ for the Benin Climatisation & Froid pilot and expose it through the governed MCP server.

**Architecture:** Add one focused provider-neutral module `marketCapture.ts` for cell compilation, lead qualification, observed economics and scale decisions. Register four MCP tools in the existing `index.ts` authorization wrapper; no live telephony, DNS, CRM, payments, provider dispatch or microsite generation is introduced.

**Tech Stack:** TypeScript 5.9, Node >=20, Vitest 3.2, Zod 3.25, MCP SDK, existing Express MCP runtime.

**Spec:** `docs/superpowers/specs/2026-08-26-distributed-market-capture-layer-design.md`

## Global Constraints

- Parent remains `Genesis Release-to-Revenue Control Plane™`; no standalone product or repository.
- Evidence state may advance only from `SPEC_APPROVED` to `TEST_PROVEN` after fresh CI proof.
- No fabricated business location, provider coverage, review, availability, price, transaction or revenue.
- `SCALE` requires real location, real provider coverage, unique utility, at least 5 qualified leads, positive observed attributed revenue and `rmcc >= 2`.
- Division by zero returns `null` for non-computable ratios.
- Google/Search is an acquisition channel only, never the source of economic truth.
- v0.1 remains provider-neutral and does not mutate DNS, telephony, WhatsApp, CRM, payment or ad platforms.

---

### Task 1: Deterministic Market Capture Core

**Files:**
- Create: `services/mcp-server/tests/marketCapture.test.ts`
- Create: `services/mcp-server/src/marketCapture.ts`

**Interfaces:**
- Produces: `compileMarketCaptureCell(input)`, `qualifyLead(input)`, `calculateRMCC(input)`, `decideCellScale(input)`.
- Produces: `BENIN_CLIMATE_COLD_PILOT_CELLS` with exactly 10 stable pilot cell definitions.

- [ ] **Step 1: Write failing tests** covering ten stable pilot IDs, fail-closed activation claims, no fabricated lead observations, urgency not bypassing hard requirements, null-safe economics, and deterministic KILL/HOLD/SCALE thresholds.
- [ ] **Step 2: Run CI and verify RED.** Expected: failure because `../src/marketCapture` does not exist.
- [ ] **Step 3: Implement minimal deterministic core** with explicit runtime validation and no external side effects.
- [ ] **Step 4: Run CI and verify core tests pass.**

### Task 2: Governed MCP Surface

**Files:**
- Modify: `services/mcp-server/src/index.ts`
- Modify: `services/mcp-server/tests/marketCapture.test.ts`

**Interfaces:**
- Consumes: the four deterministic functions from Task 1.
- Produces MCP registrations:
  - `genesis.market_capture.compile_cell` → `market-capture:compile`
  - `genesis.market_capture.qualify_lead` → `market-capture:qualify`
  - `genesis.market_capture.evaluate_economics` → `market-capture:economics`
  - `genesis.market_capture.decide_scale` → `market-capture:decide`

- [ ] **Step 1: Add failing contract test** asserting exact tool names and scopes via exported `MARKET_CAPTURE_TOOL_SCOPES`.
- [ ] **Step 2: Verify RED** before implementing the scope contract.
- [ ] **Step 3: Export exact scope map from `marketCapture.ts` and register the four tools through existing `register(...)` wrapper in `index.ts`.**
- [ ] **Step 4: Verify targeted tests and typecheck/build through CI.**

### Task 3: Full Verification and Evidence

**Files:**
- Existing CI: `.github/workflows/mcp-ci.yml`
- Update Notion `Genesis Release-to-Revenue Control Plane™` only after fresh CI proof.

- [ ] **Step 1: Run complete CI**: `npm ci --ignore-scripts`, `npm audit --audit-level=high`, `npm run typecheck`, `npm test`, `npm run build`.
- [ ] **Step 2: Inspect CI result and changed-file diff**; no `TEST_PROVEN` claim if any step fails.
- [ ] **Step 3: Update PR with evidence summary and exact commit/run identifiers.**
- [ ] **Step 4: If CI is fully green, update Notion V4-DEC-023 from `SPEC_APPROVED` to capability-level `TEST_PROVEN`; keep `PRODUCTION_PROVEN` forbidden until real adapters and observed revenue exist.**