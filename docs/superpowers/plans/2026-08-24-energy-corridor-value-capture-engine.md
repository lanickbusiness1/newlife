# Energy Corridor & Resource Value Capture Engine™ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement V4-DEC-017 as a deterministic, evidence-first corridor value-capture engine exposed through the existing GENESIS V4 MCP control plane.

**Architecture:** Add one focused TypeScript domain module under the existing MCP server, with no new service or product silo. The module validates explicit caller inputs, computes Sovereign Value Capture Ratio™, Strategic Readiness Score™, AfrIAgenesis Opportunity Score™, deterministic GO/HOLD/NO_GO gates, opportunity lanes and R.E.M.E-ready events. `src/index.ts` only handles MCP registration, authorization and health metadata.

**Tech Stack:** Node.js >=20, TypeScript 5.9 strict mode, Vitest 3.2, Zod 3.25, existing MCP SDK and Express control plane.

**Spec:** `docs/superpowers/specs/2026-08-24-energy-corridor-value-capture-engine-design.md`

## Global Constraints

- Decision authority: `V4-DEC-017`.
- Canonical asset ID: `GEN-V4-CORRIDOR-VALUE-CAPTURE-001`.
- No new catalogue product or standalone service.
- No silent imputation of missing economic or strategic inputs.
- Every assessment requires explicit evidence references.
- All scores remain deterministic and bounded to the formulas in the spec.
- Existing ECES authorization and governed audit envelope in `src/index.ts` remain authoritative.
- Tranche 1 may be marked `CODE_VERIFIED` only after tests, typecheck and build pass; never `PRODUCTION_PROVEN`.

---

### Task 1: Define failing domain behavior tests

**Files:**
- Create: `services/mcp-server/tests/corridorValueCapture.test.ts`
- Reference: `docs/superpowers/specs/2026-08-24-energy-corridor-value-capture-engine-design.md`

**Interfaces:**
- Consumes: future exports `assessCorridorValueCapture`, `computeSovereignValueCapture`, `GENESIS_V4_CORRIDOR_VALUE_CAPTURE_ANCHOR`, `CorridorValueCaptureInput` from `../src/corridorValueCapture`.
- Produces: executable behavioral contract for arithmetic, validation, gates, opportunity score, opportunity lanes and evidence lineage.

- [ ] **Step 1: Write the failing test file**

Create tests using a `Tanga–Lamu–EACOP` synthetic fixture with explicit values and synthetic evidence references. Include separate tests for:

```ts
expect(computeSovereignValueCapture(input.economicValue).sovereignValueCaptureRatio).toBeCloseTo(expected, 4);
```

```ts
expect(() => computeSovereignValueCapture({ ...economicValue, totalEconomicValue: 0 })).toThrow(/CORRIDOR_INVALID_TOTAL_ECONOMIC_VALUE/);
```

```ts
expect(() => computeSovereignValueCapture({
  ...economicValue,
  valueComponents: [{ ...economicValue.valueComponents[0]!, localShare: 1.1 }]
})).toThrow(/CORRIDOR_INVALID_LOCAL_SHARE/);
```

```ts
expect(assessCorridorValueCapture(goFixture).decision).toBe("GO");
expect(assessCorridorValueCapture(holdFixture).decision).toBe("HOLD");
expect(assessCorridorValueCapture(noGoFixture).decision).toBe("NO_GO");
```

```ts
const result = assessCorridorValueCapture(highGapFixture);
expect(result.afriagenesisOpportunityScore).toBeGreaterThan(result.strategicReadinessScore);
expect(result.opportunityLanes).toContain("ownership_and_value_capture");
```

```ts
expect(result.evidenceRefs).toEqual(expect.arrayContaining([
  "evidence:project",
  "evidence:storage",
  "evidence:ownership"
]));
```

```ts
expect(() => assessCorridorValueCapture({ ...goFixture, scores: { ...goFixture.scores, marketReach: undefined as never } })).toThrow(/CORRIDOR_INVALID_MARKET_REACH/);
```

- [ ] **Step 2: Open a draft PR with tests only to trigger MCP CI**

Base: `main`

Head: `feat/v4-dec-017-corridor-value-capture`

Expected: MCP CI fails because `../src/corridorValueCapture` does not exist yet. This is the mandatory RED state.

- [ ] **Step 3: Record the failing workflow run ID and failure reason**

Expected failure must be caused by the missing production module/export, not by malformed test syntax.

---

### Task 2: Implement the deterministic engine

**Files:**
- Create: `services/mcp-server/src/corridorValueCapture.ts`
- Test: `services/mcp-server/tests/corridorValueCapture.test.ts`

**Interfaces:**
- Consumes: `CorridorValueCaptureInput` with identity, economic value, scores and evidence.
- Produces:
  - `computeSovereignValueCapture(input: EconomicValueInput): SovereignValueCaptureResult`
  - `assessCorridorValueCapture(input: CorridorValueCaptureInput): CorridorValueCaptureAssessment`
  - `GENESIS_V4_CORRIDOR_VALUE_CAPTURE_ANCHOR`

- [ ] **Step 1: Add explicit types and anchor**

The module must define:

```ts
export const GENESIS_V4_CORRIDOR_VALUE_CAPTURE_ANCHOR = {
  genome: "GENESIS_V4",
  decisionId: "V4-DEC-017",
  assetId: "GEN-V4-CORRIDOR-VALUE-CAPTURE-001",
  version: "0.1.0",
  proofMode: "deterministic_evidence_first",
  demonstrator: "Tanga–Lamu–EACOP"
} as const;
```

Define string unions for asset classes and decisions, plus interfaces matching the spec exactly.

- [ ] **Step 2: Implement fail-closed validation helpers**

Implement focused helpers:

```ts
function requiredText(value: unknown, code: string): asserts value is string
function assertFiniteRange(value: unknown, min: number, max: number, code: string): asserts value is number
function assertEvidenceRefs(value: unknown, code: string): asserts value is string[]
function round(value: number, precision?: number): number
function unique(values: string[]): string[]
```

Use domain errors beginning with `CORRIDOR_`.

- [ ] **Step 3: Implement SVCR arithmetic**

Rules:

```ts
localRetainedValue = sum(component.grossValue * component.localShare)
classifiedValue = sum(component.grossValue)
unclassifiedValue = totalEconomicValue - classifiedValue
valueCoverageRatio = classifiedValue / totalEconomicValue * 100
sovereignValueCaptureRatio = localRetainedValue / totalEconomicValue * 100
```

Reject classified value above total economic value with `CORRIDOR_COMPONENT_VALUE_EXCEEDS_TOTAL`.

- [ ] **Step 4: Implement strategic and opportunity scores**

Use the exact weights from the spec. Do not add configurable weights in tranche 1.

```ts
strategicReadinessScore =
  0.18 * corridorControl +
  0.18 * feedstockSecurity +
  0.16 * infrastructureReadiness +
  0.14 * marketReach +
  0.18 * localIndustrialization +
  0.16 * sovereignValueCaptureRatio;
```

```ts
afriagenesisOpportunityScore =
  0.35 * (100 - sovereignValueCaptureRatio) +
  0.20 * (100 - corridorControl) +
  0.15 * (100 - localIndustrialization) +
  0.10 * governanceRisk +
  0.10 * buyerAccess +
  0.10 * procurementReadiness;
```

- [ ] **Step 5: Implement decision gates and reasons**

Evaluation order is `NO_GO` first, `GO` second, otherwise `HOLD`.

The output must include exact human-readable reasons such as `SVCR 18.0 < 20` and `Governance risk 80.0 >= 75`.

- [ ] **Step 6: Implement deterministic opportunity lanes and R.E.M.E events**

Opportunity lane rules must match the spec. R.E.M.E events must include at least:

```ts
`corridor_assessed:${corridorId}`
`decision:${decision}`
`svcr:${sovereignValueCaptureRatio}`
`opportunity_score:${afriagenesisOpportunityScore}`
```

- [ ] **Step 7: Verify GREEN through the PR CI after committing production module**

Expected: corridor domain tests pass. If other MCP tests fail, fix the production code without weakening the new tests.

---

### Task 3: Expose the engine through the governed MCP control plane

**Files:**
- Modify: `services/mcp-server/src/index.ts`
- Modify: `services/mcp-server/tests/corridorValueCapture.test.ts`

**Interfaces:**
- Consumes: `assessCorridorValueCapture` and anchor from Task 2.
- Produces: MCP tool `corridor.value_capture.assess` with permission scope `corridor:assess`, plus health metadata.

- [ ] **Step 1: Add failing source-registration assertions**

Add to the test file:

```ts
const indexSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
expect(indexSource).toContain('register("corridor.value_capture.assess"');
expect(indexSource).toContain('"corridor:assess"');
expect(indexSource).toContain("corridorValueCapture");
```

Run CI and verify these assertions fail before changing `src/index.ts`.

- [ ] **Step 2: Import the engine into `src/index.ts`**

Add:

```ts
import {
  assessCorridorValueCapture,
  GENESIS_V4_CORRIDOR_VALUE_CAPTURE_ANCHOR
} from "./corridorValueCapture.js";
```

- [ ] **Step 3: Register the governed MCP tool**

Add:

```ts
register(
  "corridor.value_capture.assess",
  "Évalue un corridor stratégique et sa capture de valeur souveraine à partir d'inputs explicitement sourcés.",
  { context: RequestContext, payload: z.unknown() },
  "corridor:assess",
  async ({ context, payload }) => ({
    tenantId: context.tenantId,
    assessment: assessCorridorValueCapture(payload as any)
  })
);
```

- [ ] **Step 4: Expose health metadata**

Add `corridorValueCapture` and `corridorValueCaptureVersion` to `/health` using the anchor asset ID and version.

- [ ] **Step 5: Re-run MCP CI**

Expected: typecheck, tests and build all pass.

---

### Task 4: Produce code-verification evidence and update canonical documentation

**Files:**
- Create: `services/mcp-server/docs/corridor-value-capture-proof.md`
- Update: Notion `GENESIS V4 — Registre M8 des décisions` entry V4-DEC-017 after CI passes.
- Update: Notion `AfrIA Corridor OS — Spécification Produit v1.0` after CI passes.

**Interfaces:**
- Consumes: PR number, head SHA, MCP CI workflow run, test results.
- Produces: `CODE_VERIFIED` evidence without claiming production deployment.

- [ ] **Step 1: Create proof document**

Document:

- decision ID;
- branch and PR;
- commit SHA;
- MCP CI run ID;
- engine asset ID/version;
- tested formulas and gates;
- known limitations;
- production truth rule.

- [ ] **Step 2: Verify final commit CI status**

Required checks:

- `npm audit --audit-level=high`
- `npm run typecheck`
- `npm test`
- `npm run build`

All must pass.

- [ ] **Step 3: Update Notion status**

Set the implementation status for V4-DEC-017 to:

`TRANCHE 1 — CODE_VERIFIED — NOT PRODUCTION_PROVEN`

Record branch, PR, commit and CI evidence. Keep persistence, agents, cockpit, M6, S7+, M8, rollback and R.E.M.E end-to-end proof as remaining gates.

- [ ] **Step 4: Do not merge automatically unless branch protection and review requirements are satisfied**

If merge is permitted and all required reviews/checks are satisfied, merge through the repository's normal policy. Otherwise leave the PR ready for review with complete evidence.