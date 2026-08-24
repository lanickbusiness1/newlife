# Independent Assurance Council™ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default external Big4 gate with a deterministic internal multi-agent independent assurance gate, while preserving external review only when an explicit external mandate exists.

**Architecture:** Add a focused `independentAssurance.ts` verifier/compiler to the existing MCP server, migrate Release Center to consume `IndependentAssuranceEvidence`, expose three governed MCP tools, and run the first internal council against PR #64. The runtime verifies evidence and separation-of-duties; it does not pretend to be an external audit firm.

**Tech Stack:** Node.js 24 CI, TypeScript 5.9, Vitest 3.2, Node `crypto`, existing MCP SDK/Zod.

**Spec:** `docs/superpowers/specs/2026-08-24-independent-assurance-council-design.md`

## Global Constraints

- No new standalone product; remain under `INF-DEPLOYBOT-001` / ADR-0007.
- TDD RED → GREEN is mandatory for every behavior change.
- Internal assurance is default; external assurance only when `externalMandate=true` from explicit evidence.
- P0 is non-overridable; open P1 prevents PASS.
- At least 4 of 5 required specialist roles must PASS.
- Arbiter must be distinct from specialist roles.
- Unknown roles/severities/verdicts/modes fail closed.
- `PRODUCTION_PROVEN` remains impossible without provider/DNS/TLS/health/rollback/measured-economics evidence.

---

### Task 1: Independent Assurance Runtime

**Files:**
- Create: `services/mcp-server/tests/independentAssurance.test.ts`
- Create: `services/mcp-server/src/independentAssurance.ts`

**Interfaces:**
- Produces `compileAssuranceReport(input)`, `compileIndependentAssurance(input)`, `verifyIndependentAssurance(evidence)`.
- Produces types `AssuranceAuditorRole`, `AssuranceFinding`, `AssuranceReport`, `IndependentAssuranceEvidence`.

- [ ] **Step 1: Write failing tests** proving: five unique specialist roles; duplicate role rejection; snapshot mismatch rejection; tamper rejection; open P0 => BLOCK; open P1 => HOLD; fewer than 4 PASS => HOLD; arbiter non-PASS prevents PASS; valid 5/5 clean council => `INTERNAL_BIG4_PASS`; `externalMandate=true` => `EXTERNAL_ASSURANCE_REQUIRED`; internal mode cannot emit `EXTERNAL_PASS`; unknown runtime enum values fail closed.

- [ ] **Step 2: Run focused test and record RED.**

Run: `npm test -- independentAssurance.test.ts`
Expected: FAIL because module/functions do not exist.

- [ ] **Step 3: Implement minimal deterministic runtime.**

Core decision logic:

```ts
if (openP0 > 0) verdict = "BLOCK";
else if (openP1 > 0) verdict = "HOLD";
else if (specialistPassCount < 4) verdict = "HOLD";
else if (arbiter.verdict !== "PASS") verdict = arbiter.verdict === "BLOCK" ? "BLOCK" : "HOLD";
else if (externalMandate) verdict = "EXTERNAL_ASSURANCE_REQUIRED";
else verdict = "INTERNAL_BIG4_PASS";
```

All reports and council evidence are canonicalized and SHA-256 verified.

- [ ] **Step 4: Run focused test and full suite.**

Run: `npm test -- independentAssurance.test.ts && npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit.**

---

### Task 2: Release Center Migration

**Files:**
- Modify: `services/mcp-server/tests/releaseCenter.test.ts`
- Modify: `services/mcp-server/tests/releaseEconomics.integration.test.ts`
- Modify: `services/mcp-server/tests/sovereignDelivery.integration.test.ts`
- Modify: `services/mcp-server/src/releaseCenter.ts`

**Interfaces:**
- Consumes `IndependentAssuranceEvidence` and `verifyIndependentAssurance` from Task 1.
- New release input field: `independentAssurance?: IndependentAssuranceEvidence`.
- Legacy `gates.big4?: "pass"` remains read-compatible only during migration.

- [ ] **Step 1: Write failing tests** proving: high/regulated release accepts `INTERNAL_BIG4_PASS` when no external mandate; rejects missing assurance; rejects HOLD/BLOCK; rejects `EXTERNAL_ASSURANCE_REQUIRED` as terminal pass; accepts `EXTERNAL_PASS` only when external mandate is true; moderate/low policies keep existing behavior; legacy `gates.big4` remains readable but new bundle compilation emits the explicit assurance field.

- [ ] **Step 2: Run tests and record RED.**

Run: `npm test -- releaseCenter.test.ts releaseEconomics.integration.test.ts sovereignDelivery.integration.test.ts`
Expected: FAIL on old Big4 semantics.

- [ ] **Step 3: Implement migration.**

For high/regulated release verification:

```ts
const assurance = bundle.independentAssurance;
if (!assurance) throw new Error("DEPLOYBOT_RELEASE_ASSURANCE_REQUIRED");
const verified = verifyIndependentAssurance(assurance);
if (!["INTERNAL_BIG4_PASS", "EXTERNAL_PASS"].includes(verified.verdict)) {
  throw new Error("DEPLOYBOT_RELEASE_ASSURANCE_NOT_PASSED");
}
```

If `externalMandate=true`, require `EXTERNAL_PASS`; otherwise `INTERNAL_BIG4_PASS` is sufficient.

- [ ] **Step 4: Run focused/full tests, typecheck and build.**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit.**

---

### Task 3: MCP Surface and Versioning

**Files:**
- Modify: `services/mcp-server/tests/mcpSurface.test.ts`
- Modify: `services/mcp-server/src/index.ts`
- Modify: `services/mcp-server/package.json`

**Interfaces:**
- Register `deploybot.assurance.compile_report`.
- Register `deploybot.assurance.compile_council`.
- Register `deploybot.assurance.verify`.
- Bump MCP package to `0.6.0`, control-plane revision to `0.9.0`.
- Expose `independentAssuranceCouncil: "INDEPENDENT_ASSURANCE_COUNCIL_1.0.0"` in health identity.

- [ ] **Step 1: Add failing surface/version tests.**
- [ ] **Step 2: Run RED.**
- [ ] **Step 3: Register tools/version identity using the existing governed `deploy:plan` wrapper.**
- [ ] **Step 4: Run `npm test && npm run typecheck && npm run build`.**
- [ ] **Step 5: Commit.**

---

### Task 4: PR #64 Internal Council Proof

**Files:**
- Create: `docs/assurance/pr-64/internal-assurance-snapshot.json`
- Create: `docs/assurance/pr-64/architecture-runtime-report.json`
- Create: `docs/assurance/pr-64/security-supply-chain-report.json`
- Create: `docs/assurance/pr-64/sovereignty-compliance-report.json`
- Create: `docs/assurance/pr-64/economics-finops-report.json`
- Create: `docs/assurance/pr-64/adversarial-red-team-report.json`
- Create: `docs/assurance/pr-64/arbiter-report.json`
- Create: `docs/assurance/pr-64/council-evidence.json`

**Interfaces:**
- Snapshot binds all reports to one PR #64 head SHA.
- Reports follow Task 1 schema.
- Council evidence is verified by `verifyIndependentAssurance`.

- [ ] **Step 1: Freeze a fresh PR #64 head after Tasks 1–3.**
- [ ] **Step 2: Execute five independent specialist reviews against that immutable snapshot.** Each report must cite concrete source/test/CI evidence and list P0/P1/P2 findings.
- [ ] **Step 3: Execute adversarial challenge and arbiter only after specialist reports are sealed.**
- [ ] **Step 4: If P0/P1 exists, remediate via new TDD cycle and repeat the council on a new snapshot.**
- [ ] **Step 5: Persist only a verified final council evidence object and record exact verdict.**

---

### Task 5: Governance and PR Migration

**Files:**
- Modify PR #64 body/status.
- Update Notion `DeployBot AfrIAgenesis®` and `Genesis Release-to-Revenue Control Plane™`.
- Update the existing Notion external-assurance pack to historical/optional status.

**Interfaces:**
- Default gate name: `Independent Assurance Council™`.
- Canonical internal pass: `INTERNAL_BIG4_PASS`.
- External review trigger: `externalMandate=true` only.

- [ ] **Step 1: Update PR #64 from `EXTERNAL_ASSURANCE_REQUIRED` to `INTERNAL_ASSURANCE_REQUIRED` while council is running.**
- [ ] **Step 2: After verified council PASS and no external mandate, mark PR ready for review/merge according to existing governance.**
- [ ] **Step 3: Update Notion properties and evidence references without promoting production.**
- [ ] **Step 4: Explicitly preserve `Déployé Prod = NON` and `Niveau de preuve = TEST_PROVEN` until provider dogfood evidence exists.**
- [ ] **Step 5: Record final head SHA, CI run, council evidence hash and next gate: controlled merge → authorized dogfood.**