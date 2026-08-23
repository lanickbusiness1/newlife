# GENESIS V4 Reproduction Engine Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the canonical GENESIS™ reproduction and valuation thesis executable in the AfrIAgenesis MCP runtime with deterministic lineage, sovereignty, governance, valuation-boundary, replication-evidence and R.E.M.E contracts.

**Architecture:** Add a pure TypeScript domain module above the existing Country Compiler, Skill Factory, STRATEX-99 context provenance and Governance Approval Ledger. The Reproduction Engine validates parent/child lineage and sovereign context before country compilation, scores actual reuse independently from monetary valuation, persists content-hashed evidence, and exposes least-privilege MCP tools without creating a second country compiler or bypassing M6/S7+/M8.

**Tech Stack:** Node.js 24, TypeScript 5.9, Zod 3.25, Vitest 3.2, MCP SDK 1.30, immutable JSON/file registries with SHA-256 integrity.

**Spec:** `docs/superpowers/specs/2026-08-23-genesis-reproduction-engine-contracts-design.md`

## Global Constraints

- Base implementation context is `genesis-v4-continental-skill-factory`; implementation branch is `feat/genesis-reproduction-engine-contracts`.
- Active authority is `GENESIS V4 Genome™ — Référence opérationnelle vivante`, thesis dated 2026-08-23.
- Do not create AsiaGENESIS, AmericasGenesis, EurAIGenesis or any other child entity in this change.
- Do not assign monetary value to future child entities.
- Do not create a second Country Compiler, Skill Registry, STRATEX engine or M8 approval store.
- S7+ fail, M6 fail and M8 fail are non-overridable.
- M8 conditional requires a valid, non-expired, non-revoked governance approval bound to the exact reproduction contract fingerprint.
- Territorial localization must cover sovereign context; language-only localization is invalid.
- Platform-premium evidence requires second-context proof and >= 80% reusable share with <= 20% rebuild share.
- All production code follows RED → verify RED → GREEN → verify GREEN → refactor.
- Final verification: `npm test`, `npm run typecheck`, `npm run build`, `npm run smoke:mcp`.

---

### Task 1: Pure Reproduction Domain Contracts

**Files:**
- Create: `services/mcp-server/src/genesisReproduction.ts`
- Create: `services/mcp-server/tests/genesisReproduction.test.ts`

**Interfaces:**
- Consumes: `Stratex99Context` from `./skillFactory.js`; `ContextPackProvenance` from `./contextPackProvenance.js`.
- Produces: `GenesisCoreIdentity`, `SovereignContextPack`, `ReproductionContract`, `ValidatedReproduction`, `validateGenesisCoreIdentity()`, `validateReproductionContract()`, `fingerprintReproductionContract()`.

- [ ] **Step 1: Write the failing tests for complete GENESIS core identity**

```ts
import { describe, expect, it } from "vitest";
import {
  validateGenesisCoreIdentity,
  type GenesisCoreIdentity
} from "../src/genesisReproduction.js";

const core: GenesisCoreIdentity = {
  id: "GENESIS",
  genomeVersion: "4.0.0",
  authorityRef: "notion:genome:3b0cdd91-020e-818c-af3b-d4593c037f14",
  inheritedSystems: ["GENOME", "DFM", "TRM", "STRATEX-99", "GOIR", "ECES", "M6", "S7+", "M8", "R.E.M.E"],
  universalInvariants: { sovereignContextRequired: true }
};

it("accepts a reproduction-capable GENESIS core", () => {
  expect(validateGenesisCoreIdentity(core)).toEqual(core);
});

it("rejects a GENESIS core missing M8", () => {
  expect(() => validateGenesisCoreIdentity({
    ...core,
    inheritedSystems: core.inheritedSystems.filter(value => value !== "M8")
  })).toThrow("GENESIS_CORE_INCOMPLETE:M8");
});
```

- [ ] **Step 2: Run RED**

Run: `cd services/mcp-server && npm test -- genesisReproduction.test.ts`

Expected: FAIL because `genesisReproduction.js` does not exist.

- [ ] **Step 3: Implement core identity validation minimally**

```ts
const REQUIRED_GENESIS_SYSTEMS = [
  "GENOME", "DFM", "TRM", "STRATEX-99", "GOIR", "ECES", "M6", "S7+", "M8", "R.E.M.E"
] as const;

export function validateGenesisCoreIdentity(input: GenesisCoreIdentity): GenesisCoreIdentity {
  if (input.id !== "GENESIS") throw new Error("GENESIS_CORE_ID_INVALID");
  for (const system of REQUIRED_GENESIS_SYSTEMS) {
    if (!input.inheritedSystems.includes(system)) {
      throw new Error(`GENESIS_CORE_INCOMPLETE:${system}`);
    }
  }
  if (!input.genomeVersion.trim()) throw new Error("GENESIS_CORE_GENOME_VERSION_REQUIRED");
  if (!input.authorityRef.trim()) throw new Error("GENESIS_CORE_AUTHORITY_REQUIRED");
  return input;
}
```

- [ ] **Step 4: Add RED tests for lineage, translation-only context, Genome version and gates**

Include one test each for:
- continental child with `parentEntityId !== "GENESIS"` → `REPRODUCTION_PARENT_INVALID`;
- country child without GENESIS lineage → `REPRODUCTION_LINEAGE_BROKEN`;
- language-only sovereign context → `SOVEREIGN_CONTEXT_TRANSLATION_ONLY`;
- inherited Genome mismatch → `REPRODUCTION_GENOME_VERSION_MISMATCH`;
- missing parent invariant → `REPRODUCTION_INVARIANT_MISSING:<key>`;
- `m6 = fail` → `REPRODUCTION_M6_FAIL`;
- `s7plus = fail` → `REPRODUCTION_S7_FAIL`;
- `m8 = fail` → `REPRODUCTION_M8_FAIL`;
- missing rollback/evidence → stable required codes.

- [ ] **Step 5: Run RED and implement `validateReproductionContract()`**

The function signature is:

```ts
export function validateReproductionContract(
  core: GenesisCoreIdentity,
  contract: ReproductionContract,
  options?: { m8Approved?: boolean }
): ValidatedReproduction;
```

Implementation order must be deterministic: identity → parent/type lineage → Genome version → invariants → sovereign context → adaptation conflicts → rollback/evidence → M6 → S7+ → M8.

- [ ] **Step 6: Implement deterministic SHA-256 fingerprint**

```ts
export function fingerprintReproductionContract(contract: ReproductionContract): string;
```

Use sorted-key canonical JSON before hashing; do not use raw `JSON.stringify()` order as the integrity contract.

- [ ] **Step 7: Run GREEN**

Run: `npm test -- genesisReproduction.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add services/mcp-server/src/genesisReproduction.ts services/mcp-server/tests/genesisReproduction.test.ts
git commit -m "feat: add GENESIS reproduction domain contracts"
```

---

### Task 2: Replication Evidence and Valuation Boundary

**Files:**
- Create: `services/mcp-server/src/genesisValuation.ts`
- Create: `services/mcp-server/tests/genesisValuation.test.ts`

**Interfaces:**
- Consumes: `ReproductionContract` identity fields.
- Produces: `ReplicationEvidence`, `ReplicationScore`, `scoreReplicationEvidence()`, `ValuationClaim`, `validateValuationClaim()`.

- [ ] **Step 1: Write RED tests for reuse classification**

```ts
it("classifies >=80% reuse in a distinct second context as proven", () => {
  const score = scoreReplicationEvidence({
    reproductionId: "rep-benin-001",
    parentEntityId: "AFRIAGENESIS",
    childEntityId: "BENINGENESIS",
    inheritedComponents: ["a", "b", "c", "d", "e", "f", "g", "h"],
    adaptedComponents: ["i"],
    rebuiltComponents: ["j"],
    reusedSkillRefs: [{ id: "tax-reconcile", version: "1.0.0" }],
    newSkillRefs: [],
    evidenceRefs: ["evidence:country-a", "evidence:country-b"],
    contextIds: ["BJ", "GN"],
    measuredAt: "2026-08-23T17:00:00.000Z"
  });
  expect(score.platformEvidenceStatus).toBe("proven");
});
```

Also test high rebuild share, missing evidence and no second context.

- [ ] **Step 2: Run RED**

Run: `npm test -- genesisValuation.test.ts`

Expected: FAIL because module is missing.

- [ ] **Step 3: Implement unique-component scoring**

Deduplicate all component lists before ratios. `totalComponents` is the union of inherited/adapted/rebuilt component names. If total is zero, return `insufficient` with reusable and rebuild shares equal to 0.

- [ ] **Step 4: Write RED tests for valuation boundary**

Required cases:
- future AsiaGENESIS `current_revenue` claim without production/revenue proof → `VALUATION_FUTURE_REVENUE_NOT_PROVEN`;
- future child `option_value` with evidence → accepted, still labeled `option_value`;
- `impact_value` attempting equity merge → `VALUATION_IMPACT_EQUITY_CONFLATION`;
- `platform_premium` without `ReplicationScore.proven` → `VALUATION_PLATFORM_PREMIUM_NOT_PROVEN`;
- every claim without evidence → `VALUATION_EVIDENCE_REQUIRED`.

- [ ] **Step 5: Implement `validateValuationClaim()` minimally**

```ts
export function validateValuationClaim(
  claim: ValuationClaim,
  replicationScore?: ReplicationScore
): ValuationClaim;
```

Keep `AFRIAGENESIS_OPERATING_COMPANY` and `GENESIS_GLOBAL_IP_REPRODUCTION_PLATFORM` as distinct enums; do not calculate dollar values.

- [ ] **Step 6: Run GREEN and commit**

Run: `npm test -- genesisValuation.test.ts`

```bash
git add services/mcp-server/src/genesisValuation.ts services/mcp-server/tests/genesisValuation.test.ts
git commit -m "feat: enforce GENESIS valuation boundaries"
```

---

### Task 3: R.E.M.E Inheritance Contract

**Files:**
- Create: `services/mcp-server/src/remeInheritance.ts`
- Create: `services/mcp-server/tests/remeInheritance.test.ts`

**Interfaces:**
- Produces: `RemeInheritanceRecord`, `validateRemeInheritanceRecord()`, `assertReproductionComplete()`.

- [ ] **Step 1: Write RED tests**

Required behaviors:
- released reproduction without R.E.M.E record → `REME_RETURN_REQUIRED`;
- record without local evidence → `REME_EVIDENCE_REQUIRED`;
- same key in `reusableAssets` and `excludedLocalRules` → `REME_LOCAL_RULE_LEAKAGE`;
- reusable promotion from one context only → `REME_SECOND_CONTEXT_REQUIRED`;
- valid second-context record passes.

- [ ] **Step 2: Run RED**

Run: `npm test -- remeInheritance.test.ts`

- [ ] **Step 3: Implement minimal validators**

```ts
export function validateRemeInheritanceRecord(
  record: RemeInheritanceRecord,
  options: { secondContextEvidencePresent: boolean }
): RemeInheritanceRecord;

export function assertReproductionComplete(
  contract: ValidatedReproduction,
  record?: RemeInheritanceRecord
): void;
```

- [ ] **Step 4: Run GREEN and commit**

```bash
npm test -- remeInheritance.test.ts
git add services/mcp-server/src/remeInheritance.ts services/mcp-server/tests/remeInheritance.test.ts
git commit -m "feat: require R.E.M.E inheritance for reproduction"
```

---

### Task 4: Reproduction-Aware Country Compiler

**Files:**
- Modify: `services/mcp-server/src/countryCompiler.ts`
- Modify: `services/mcp-server/tests/countryCompiler.test.ts`

**Interfaces:**
- Consumes: `ReproductionContract`, `GenesisCoreIdentity`, `validateReproductionContract()`.
- Produces: `CountryCompiledSkill.reproduction` lineage metadata.

- [ ] **Step 1: Add RED test for missing reproduction contract**

Update fixtures so new valid country compile requests supply `genesisCore` and `reproductionContract`. Add an explicit negative case that omits or mismatches the contract.

Expected mismatch error: `COUNTRY_REPRODUCTION_COUNTRY_MISMATCH`.

- [ ] **Step 2: Run RED**

Run: `npm test -- countryCompiler.test.ts`

- [ ] **Step 3: Extend `CountryCompileInput`**

```ts
export interface CountryCompileInput {
  countryCode: string;
  genesisCore: GenesisCoreIdentity;
  reproductionContract: ReproductionContract;
  contextPack?: Stratex99Context;
  contextProvenance?: ContextPackProvenance;
  stratex9Qualification: Stratex9CountryQualification;
  skillRefs: Array<{ id: string; version: string }>;
}
```

- [ ] **Step 4: Validate reproduction before existing country logic**

Required order:
1. normalize country code;
2. validate contract child type is `country`;
3. validate sovereign context country code equals request country;
4. validate GENESIS core and contract;
5. execute existing `validateContext()`, STRATEX-9, registry read, lifecycle, jurisdiction and Genome invariant composition unchanged.

- [ ] **Step 5: Add returned lineage**

```ts
reproduction: {
  reproductionId: validated.contract.reproductionId,
  parentEntityId: validated.contract.parentEntityId,
  childEntityId: validated.contract.childEntityId,
  inheritedGenomeVersion: validated.contract.inheritedGenomeVersion
}
```

- [ ] **Step 6: Run entire country compiler suite GREEN and commit**

```bash
npm test -- countryCompiler.test.ts
git add services/mcp-server/src/countryCompiler.ts services/mcp-server/tests/countryCompiler.test.ts
git commit -m "feat: enforce reproduction lineage in country compiler"
```

---

### Task 5: Reproduction Approval Binding in Governance Ledger

**Files:**
- Modify: `services/mcp-server/src/governanceApprovalLedger.ts`
- Create: `services/mcp-server/tests/reproductionGovernanceApproval.test.ts`

**Interfaces:**
- Existing skill approval behavior must remain backward compatible.
- Produces: `attestReproductionM8()`, `verifyReproductionM8()` using the same immutable ledger root and revocation model.

- [ ] **Step 1: Write RED tests for exact reproduction fingerprint**

Test:
- M8 reproduction approval requires `genome:reproduction:m8`, M8 role and MFA;
- approval binds `reproductionId`, contract fingerprint and tenant;
- modified contract after attestation → `APPROVAL_SUBJECT_MISMATCH`;
- revoked approval → `APPROVAL_REVOKED:<id>`;
- expired approval → `APPROVAL_EXPIRED`.

- [ ] **Step 2: Run RED**

Run: `npm test -- reproductionGovernanceApproval.test.ts`

- [ ] **Step 3: Generalize approval subject without breaking skill entries**

Use a discriminated subject:

```ts
export type ApprovalSubject =
  | { subjectType: "skill"; skillId: string; version: string; fingerprint: string }
  | { subjectType: "reproduction"; reproductionId: string; fingerprint: string };
```

When reading legacy entries without `subjectType`, treat them as `skill` only if their existing `skillId`, `version`, and `fingerprint` fields are valid. Do not rewrite existing immutable files.

- [ ] **Step 4: Add reproduction attest/verify methods**

```ts
async attestReproductionM8(
  contract: ReproductionContract,
  ctx: BoundRequestContext
): Promise<GovernanceApprovalEntry>;

async verifyReproductionM8(
  contract: ReproductionContract,
  approvalId: string,
  tenantId: string
): Promise<void>;
```

- [ ] **Step 5: Run skill approval regression suites + new suite**

Run:

```bash
npm test -- governanceApprovalLedger.test.ts governanceApprovalRevocation.test.ts governanceApprovalConcurrency.test.ts reproductionGovernanceApproval.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add services/mcp-server/src/governanceApprovalLedger.ts services/mcp-server/tests/reproductionGovernanceApproval.test.ts
git commit -m "feat: bind M8 approvals to reproduction contracts"
```

---

### Task 6: Content-Hashed Reproduction Registry

**Files:**
- Create: `services/mcp-server/src/reproductionRegistry.ts`
- Create: `services/mcp-server/tests/reproductionRegistry.test.ts`

**Interfaces:**
- Produces: `ReproductionRegistry.installContract()`, `.recordReplicationEvidence()`, `.recordRemeInheritance()`, `.readContract()`, `.readReplicationEvidence()`, `.readRemeInheritance()`.

- [ ] **Step 1: Write RED integrity and path-safety tests**

Required cases:
- install/read valid contract;
- duplicate immutable record rejected;
- invalid reproduction ID path rejected;
- tampered JSON → `REPRODUCTION_REGISTRY_INTEGRITY_FAILURE`;
- no secret-like fields are accepted (`apiKey`, `accessToken`, `password`, `secret`).

- [ ] **Step 2: Run RED**

Run: `npm test -- reproductionRegistry.test.ts`

- [ ] **Step 3: Implement canonical-hash immutable JSON records**

Follow the existing ledger/registry filesystem pattern: resolved root, path containment check, temporary file + hard-link immutable write, SHA-256 over canonical payload, read-time verification.

Default directory:

```ts
process.env.GENESIS_REPRODUCTION_REGISTRY_DIR ?? path.resolve(process.cwd(), ".genesis-reproduction-registry")
```

- [ ] **Step 4: Run GREEN and commit**

```bash
npm test -- reproductionRegistry.test.ts
git add services/mcp-server/src/reproductionRegistry.ts services/mcp-server/tests/reproductionRegistry.test.ts
git commit -m "feat: persist GENESIS reproduction evidence"
```

---

### Task 7: MCP Reproduction and Valuation Tools

**Files:**
- Create: `services/mcp-server/src/mcpGenesisReproductionTools.ts`
- Create: `services/mcp-server/tests/mcpGenesisReproductionTools.test.ts`
- Modify: `services/mcp-server/src/mcpSkillTools.ts`

**Interfaces:**
- Produces tool names:
  - `genome.reproduction.validate`
  - `genome.reproduction.score`
  - `genome.reproduction.m8_attest`
  - `genome.reproduction.record_reme`
  - `genome.valuation.boundary`
- Scopes:
  - validate: `genome:reproduction`
  - score: `genome:reproduction:read`
  - M8 attest: `genome:reproduction:m8`
  - R.E.M.E record: `genome:reproduction:write`
  - valuation: `genome:valuation`

- [ ] **Step 1: Write RED registration tests**

Assert exact tool names, required scopes and ABAC country enforcement for country reproductions.

- [ ] **Step 2: Run RED**

Run: `npm test -- mcpGenesisReproductionTools.test.ts`

- [ ] **Step 3: Implement Zod schemas mirroring domain contracts**

Reuse `Stratex99ContextSchema` and context provenance schema patterns; do not duplicate incompatible context definitions.

- [ ] **Step 4: Implement handlers**

`genome.reproduction.validate`:
1. authorize territorial target;
2. if contract M8 is conditional, verify provided M8 approval;
3. validate contract;
4. persist validated contract;
5. return contract + fingerprint.

`genome.reproduction.score` scores evidence and may persist snapshot only when write scope is present; read-scope call itself remains side-effect free.

`genome.valuation.boundary` validates classification only; it never emits a dollar valuation.

- [ ] **Step 5: Extend CountryCompileSchema**

`genome.country_compiler.compile` must accept `genesisCore` and `reproductionContract` and pass them into `compileCountrySkill()`.

- [ ] **Step 6: Run GREEN and commit**

```bash
npm test -- mcpGenesisReproductionTools.test.ts mcpTerritorialWiring.test.ts countryCompiler.test.ts
git add services/mcp-server/src/mcpGenesisReproductionTools.ts services/mcp-server/src/mcpSkillTools.ts services/mcp-server/tests/mcpGenesisReproductionTools.test.ts
git commit -m "feat: expose governed GENESIS reproduction MCP tools"
```

---

### Task 8: Central MCP Wiring, Health and Smoke Proof

**Files:**
- Modify: `services/mcp-server/src/index.ts`
- Modify: `services/mcp-server/scripts/smoke-mcp-v2.mjs`
- Create or modify: `services/mcp-server/tests/mcpReproductionWiring.test.ts`
- Modify: `services/mcp-server/README.md`

**Interfaces:**
- `REPRODUCTION_MCP_HEALTH` is included in `/health`.
- `registerGenesisReproductionMcpTools()` is called from `buildServer()`.

- [ ] **Step 1: Write RED wiring test**

Assert that `index.ts` registers reproduction tools and `/health` exposes a stable anchor such as `GEN-V4-REPRODUCTION-ENGINE-001` plus registry version.

- [ ] **Step 2: Run RED**

Run: `npm test -- mcpReproductionWiring.test.ts`

- [ ] **Step 3: Wire registration and health**

Add:

```ts
import {
  registerGenesisReproductionMcpTools,
  REPRODUCTION_MCP_HEALTH
} from "./mcpGenesisReproductionTools.js";
```

Call after `registerSkillMcpTools(...)` so reproduction can reuse the same server registration and governed wrapper.

- [ ] **Step 4: Extend smoke MCP script**

Smoke must verify at least:
- reproduction validate rejects translation-only country context;
- valid non-sensitive reproduction validation returns fingerprint;
- replication score returns expected classification;
- valuation tool refuses unproven future revenue claim.

No smoke case may create a production child or assert monetary valuation.

- [ ] **Step 5: Document scopes and limitations**

README must explicitly state:
- this is controlled reproduction governance, not autonomous corporate creation;
- no production claim until deployment evidence exists;
- platform-premium status is evidence classification, not valuation advice.

- [ ] **Step 6: Run GREEN and commit**

```bash
npm test -- mcpReproductionWiring.test.ts
npm run typecheck
npm run build
npm run smoke:mcp
git add services/mcp-server/src/index.ts services/mcp-server/scripts/smoke-mcp-v2.mjs services/mcp-server/tests/mcpReproductionWiring.test.ts services/mcp-server/README.md
git commit -m "feat: wire GENESIS reproduction engine into MCP runtime"
```

---

### Task 9: Full Regression, Security Gate and R.E.M.E Documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-08-23-genesis-reproduction-engine-contracts-design.md` only if implementation discovered a factual interface delta.
- Create: `docs/operations/genesis-reproduction-engine-verification-2026-08-23.md`

**Interfaces:**
- Produces verification evidence for M6/S7+/M8 handoff.

- [ ] **Step 1: Run complete test suite**

```bash
cd services/mcp-server
npm test
```

Expected: all tests PASS; no existing skill, approval, country, persistence or auth tests regress.

- [ ] **Step 2: Run static verification**

```bash
npm run typecheck
npm run build
```

Expected: both exit 0.

- [ ] **Step 3: Run runtime smoke**

```bash
npm run smoke:mcp
```

Expected: existing MCP smoke + reproduction smoke PASS.

- [ ] **Step 4: Security/adversarial review**

Explicitly verify:
- no S7/M6/M8 bypass path;
- no arbitrary filesystem path escape;
- hashes fail closed;
- approval tenant/fingerprint binding works;
- no secret fields persist;
- ABAC country restrictions apply before country reproduction;
- future revenue claims remain blocked without evidence;
- impact value cannot become equity value automatically.

- [ ] **Step 5: Write verification evidence document**

Record exact command outputs, commit SHA, branch, test counts, known limitations, M6/S7+/M8 state and production blockers. Do not claim production proof unless deployment/monitoring/rollback evidence exists.

- [ ] **Step 6: Commit verification evidence**

```bash
git add docs/operations/genesis-reproduction-engine-verification-2026-08-23.md
git commit -m "docs: record GENESIS reproduction engine verification"
```

---

### Task 10: Notion / R.E.M.E Synchronization After Code Proof

**Files:**
- No production-code files.
- Update canonical Notion records only after Task 9 verification is complete.

**Interfaces:**
- GENESIS V4 Genome remains normative authority.
- Genesis Reproduction Engine page receives technical implementation state and evidence.

- [ ] **Step 1: Update the Genesis Reproduction Engine Notion page**

Replace `Statut : À SPÉCIFIER` only with the state actually proven by Task 9, e.g. `CODÉ → TESTÉ → BUILD OK → SMOKE MCP OK → EN ATTENTE M6/S7+/M8/DEPLOY`.

- [ ] **Step 2: Add R.E.M.E delta**

Record:
`Doctrine canonique → spec → TDD contracts → country/compiler integration → governance → persistence → MCP → tests → proof → remaining production gates`.

- [ ] **Step 3: Link evidence**

Include branch, commit SHA(s), verification document and exact test/build/smoke results.

- [ ] **Step 4: Do not upgrade to PRODUCTION_PROVEN**

Production status requires real deployment, monitoring, rollback and operational evidence outside this implementation plan.

---

## Plan Self-Review

- Spec coverage: all six domain contracts, Country Compiler integration, M8 governance, persistence, MCP, security, testing and R.E.M.E synchronization are mapped to tasks.
- Placeholder scan: no TBD/TODO/implement-later steps remain.
- Type consistency: `GenesisCoreIdentity`, `ReproductionContract`, `ReplicationEvidence`, `ReplicationScore`, `ValuationClaim`, `RemeInheritanceRecord` and their validator names are stable across tasks.
- Backward compatibility: skill approvals and immutable historical approval files remain readable; no Skill Registry schema migration is required.
- Scope control: this plan builds the executable reproduction governance layer only; it does not instantiate another continent or calculate company valuation.
