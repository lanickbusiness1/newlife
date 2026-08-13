# GENESIS V4 Continental Skill Factory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a governed, registry-first, STRATEX-99/STRATEX-9 contextualized Skill Factory in the existing AfrIAgenesis MCP service.

**Architecture:** Add three focused modules to the existing TypeScript MCP service: a pure skill compiler/governance engine, a filesystem-backed integrity-checked registry, and a country compiler that composes reusable layers with territorial context. Expose them through existing MCP authorization and health metadata without creating a new product or bypassing M6/S7+/M8.

**Tech Stack:** Node 24, TypeScript 5.9, Zod 3.25, Vitest 3.2, MCP SDK 1.30, Express 5, Node `crypto` and `fs/promises`.

## Global Constraints

- Extend `services/mcp-server`; do not create a new standalone framework.
- STRATEX-99 context is mandatory for L2-L5 territorial skills.
- STRATEX-9 qualification is mandatory before territorial execution/promotion.
- Registry-first reuse threshold is `0.80`.
- No national legal rule may be hard-coded into L0/L1 generic core.
- `blocked` skills cannot install; `alert_ready` requires double review; `m8_required` requires M8 approval.
- Production claim remains blocked until deployed Docker runtime, monitoring, durable registry volume, backup/restore and rollback are proven.

---

### Task 1: Skill compiler and governance core

**Files:**
- Create: `services/mcp-server/src/skillFactory.ts`
- Create: `services/mcp-server/tests/skillFactory.test.ts`

**Interfaces:**
- Produces `compileSkill(input: unknown): CompiledSkill`.
- Produces `scoreSkillCompatibility(request: SkillRequest, candidate: SkillRecord): number` returning `[0,1]`.
- Produces `evaluatePromotion(input: PromotionInput): PromotionDecision`.
- Exports Zod-backed domain types used by registry and country compiler.

- [ ] **Step 1: Write failing governance tests**

Create tests covering:

```ts
expect(() => compileSkill({})).toThrow(/SKILL_DNA_INVALID/);
```

```ts
const territorial = compileSkill(validInput({ level: "L3", context: undefined }));
expect(territorial.status).toBe("blocked");
expect(territorial.blockers).toContain("STRATEX99_CONTEXT_REQUIRED");
```

```ts
const unsafe = compileSkill(validInput({ procedure: ["sudo rm -rf /tmp/x"] }));
expect(unsafe.status).toBe("blocked");
expect(unsafe.gates.s7).toBe("fail");
```

```ts
const sensitive = compileSkill(validInput({ riskDomains: ["payment"] }));
expect(sensitive.status).toBe("m8_required");
```

```ts
const bounded = compileSkill(validInput({ warnings: ["missing optional benchmark"] }));
expect(bounded.status).toBe("alert_ready");
expect(bounded.doubleReviewRequired).toBe(true);
```

- [ ] **Step 2: Implement schemas and deterministic compiler**

Define:

```ts
export type SkillLevel = "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
export type SkillStatus = "draft_ready" | "alert_ready" | "m8_required" | "blocked";
```

Define STRATEX-99 coverage as exactly nine keys:

```ts
languageSemantic, regulatoryLegal, institutional,
economicFinancialPayment, culturalHumanAdoption,
infrastructureResilience, marketBusinessRevenue,
technologyDataAgenticAI, governanceSovereigntyAssurance
```

For L2-L5, require all nine keys to exist with `status: "covered" | "partial" | "not_applicable"`; `partial` creates a warning unless the missing dimension is legal/governance/infrastructure, which blocks.

- [ ] **Step 3: Add destructive/sensitive detection**

Block procedure text matching destructive patterns including `rm -rf`, `curl | bash`, `sudo`, `chmod 777`, `git reset --hard`, private keys, access tokens, or credential assignments.

Sensitive risk domains:

```ts
security, legal, payment, production, doctrine, pii,
external_write, deployment, rollback, public_claim
```

Sensitive scope without explicit `m8Approval: true` compiles as `m8_required`; dangerous content always compiles as `blocked`.

- [ ] **Step 4: Add compatibility scoring and reuse rule**

Score weighted fields:

```txt
domain 0.25
problem/triggers 0.20
input/output schema tags 0.15
level compatibility 0.10
region/country compatibility 0.10
dependencies/connectors 0.10
permission scope overlap 0.10
```

Return a normalized score rounded to two decimals. `>= 0.80` means `reuse_or_compose`; below means `compile_gap`.

- [ ] **Step 5: Add promotion evaluation**

Reject promotion when any of these are false:

```ts
outcomeEvidencePresent
localRulesSeparated
permissionsBounded
doubleReviewPassed
rollbackPresent
```

For L3→L2 or broader promotion also require `secondContextTestPassed` and reject candidate metadata containing `hardcodedNationalRule: true`.

- [ ] **Step 6: Run unit tests, typecheck and commit**

Commands:

```bash
cd services/mcp-server
npm ci
npm test -- skillFactory.test.ts
npm run typecheck
```

Expected: all Task 1 tests pass, zero TypeScript errors.

Commit message:

```txt
feat: add governed continental skill compiler
```

---

### Task 2: Integrity-checked persistent Skill Registry

**Files:**
- Create: `services/mcp-server/src/skillRegistry.ts`
- Create: `services/mcp-server/tests/skillRegistry.test.ts`

**Interfaces:**
- Consumes `CompiledSkill`, `SkillStatus`, compatibility scorer from `skillFactory.ts`.
- Produces `SkillRegistry` with `install`, `list`, `read`, `match`, `deprecate`.

- [ ] **Step 1: Write failing registry tests**

Test that:

```ts
await expect(registry.install(blockedSkill)).rejects.toThrow(/SKILL_INSTALL_BLOCKED/);
```

```ts
await expect(registry.install(alertSkill, { doubleReview: false })).rejects.toThrow(/DOUBLE_REVIEW_REQUIRED/);
```

```ts
await expect(registry.install(m8Skill, { m8Approval: false })).rejects.toThrow(/M8_APPROVAL_REQUIRED/);
```

```ts
const saved = await registry.install(draftSkill, {});
const read = await registry.read(saved.id, saved.version);
expect(read.integrity.sha256).toMatch(/^[a-f0-9]{64}$/);
```

Tamper with the stored JSON and assert `SKILL_REGISTRY_INTEGRITY_FAILURE` on read.

- [ ] **Step 2: Implement deterministic registry storage**

Registry directory:

```ts
process.env.SKILL_REGISTRY_DIR ?? path.resolve(process.cwd(), ".skill-registry")
```

One immutable JSON record per `id/version`, plus `index.json`. Generate SHA-256 over canonical serialized skill payload before writing integrity metadata.

- [ ] **Step 3: Implement install policy**

Policy:

```txt
draft_ready -> install
alert_ready -> require doubleReview=true
m8_required -> require m8Approval=true
blocked -> reject
```

Use atomic write via temporary file then rename.

- [ ] **Step 4: Implement registry-first matching**

`match(request)` loads non-deprecated records, scores each with `scoreSkillCompatibility`, sorts descending, and returns:

```ts
{ best, score, decision: score >= 0.80 ? "reuse_or_compose" : "compile_gap" }
```

- [ ] **Step 5: Implement deprecation without destructive deletion**

`deprecate(id, version, replacement?)` preserves the record and sets lifecycle metadata. `read` remains possible and returns deprecation status.

- [ ] **Step 6: Run tests and commit**

Commands:

```bash
npm test -- skillRegistry.test.ts
npm run typecheck
```

Commit message:

```txt
feat: add integrity checked skill registry
```

---

### Task 3: Country Compiler and contextual composition

**Files:**
- Create: `services/mcp-server/src/countryCompiler.ts`
- Create: `services/mcp-server/tests/countryCompiler.test.ts`

**Interfaces:**
- Consumes Skill Registry records and STRATEX-99 context vector.
- Produces `compileCountrySkill(input: CountryCompileInput): CountryCompiledSkill`.

- [ ] **Step 1: Write failing composition tests**

Test required precedence:

```txt
L0 Core < L1 Domain < L2 Regional < L3 Country < L4 Institution < L5 Transaction
```

A more specific layer may override configurable metadata but may not override `universalInvariant` fields.

Test missing country context returns `COUNTRY_CONTEXT_REQUIRED`.

Test a country policy attempting to alter `universalInvariant` returns `GENOME_INVARIANT_VIOLATION`.

- [ ] **Step 2: Implement composition model**

Input must include:

```ts
countryCode
contextPack
stratex9Qualification: { status: "go" | "conditional" | "no_go"; evidenceRefs: string[] }
skillRefs: Array<{ id: string; version: string }>
```

Reject `no_go`. Require evidence refs for `go` and `conditional`.

- [ ] **Step 3: Enforce context and sovereignty boundaries**

Reject incompatible country/jurisdiction tags unless the skill is L0/L1 generic or explicitly lists the target jurisdiction.

Preserve source skill IDs, versions and integrity hashes in `lineage`.

- [ ] **Step 4: Run tests and commit**

Commands:

```bash
npm test -- countryCompiler.test.ts
npm run typecheck
```

Commit message:

```txt
feat: add STRATEX contextual country compiler
```

---

### Task 4: MCP tools and health integration

**Files:**
- Modify: `services/mcp-server/src/index.ts`
- Modify: `services/mcp-server/package.json`
- Create: `services/mcp-server/scripts/smoke-mcp.mjs`
- Create: `services/mcp-server/tests/mcpSkillTools.test.ts`

**Interfaces:**
- Expose compiler/registry/country functions through current `register()` authorization pattern.

- [ ] **Step 1: Add failing registration/health tests**

Assert health metadata constants include:

```json
{
  "skillFactory": "GEN-V4-SKILL-FACTORY-002",
  "skillRegistry": "GENESIS_SKILL_REGISTRY_0.2.0",
  "countryCompiler": "GEN-V4-COUNTRY-COMPILER-001"
}
```

Assert tool names exist:

```txt
genome.skill_factory.compile
genome.skill_factory.match
genome.skill_factory.install
genome.skill_factory.promote
genome.skill_registry.list
genome.skill_registry.read
genome.country_compiler.compile
```

- [ ] **Step 2: Register tools with least-privilege scopes**

Scopes:

```txt
genome:skill:compile
genome:skill:read
genome:skill:install
genome:skill:promote
genome:country:compile
```

Do not reuse broad write scope for reads.

- [ ] **Step 3: Bump MCP service version and add smoke script**

Set package/service version to `0.3.0` for this GitHub-real implementation increment.

Add:

```json
"smoke:mcp": "node scripts/smoke-mcp.mjs"
```

Smoke script imports built modules and proves compile → registry install → list → read → country compile using a temp registry directory.

- [ ] **Step 4: Run full local verification and commit**

Commands:

```bash
npm test
npm run typecheck
npm run build
npm run smoke:mcp
npm audit --audit-level=high
```

Commit message:

```txt
feat: expose continental skill factory through MCP
```

---

### Task 5: CI hardening and staging boundary

**Files:**
- Modify: `.github/workflows/mcp-ci.yml`
- Modify: `services/mcp-server/Dockerfile` only if scripts are not copied into runtime stage.
- Modify: `services/mcp-server/README.md`

- [ ] **Step 1: Inspect CI and Docker build contract**

CI must run from `services/mcp-server`:

```bash
npm ci
npm audit --audit-level=high
npm run typecheck
npm test
npm run build
npm run smoke:mcp
```

- [ ] **Step 2: Preserve immutable GitHub Action references**

Do not replace existing SHA-pinned actions with floating tags.

- [ ] **Step 3: Document operational boundary**

README must state:

```txt
Code/CI verification does not equal production readiness.
Production requires durable SKILL_REGISTRY_DIR storage, backup/restore, monitoring, deployed image proof and rollback proof.
```

- [ ] **Step 4: Commit**

Commit message:

```txt
ci: verify continental skill factory release gates
```

---

### Task 6: Independent double review and PR

**Files:**
- No new product files unless review finds defects.

- [ ] **Step 1: Review source-level invariants**

Check:
- no bypass around sensitive M8 domains;
- no secrets persisted;
- no country law hard-coded in generic core;
- registry integrity checked before use;
- path handling cannot escape registry root;
- permissions are least-privilege.

- [ ] **Step 2: Review compiled/runtime behavior**

Re-run:

```bash
npm ci
npm audit --audit-level=high
npm test
npm run typecheck
npm run build
npm run smoke:mcp
```

- [ ] **Step 3: Inspect GitHub Actions result**

Only claim CI proof after the branch workflow run is observed green.

- [ ] **Step 4: Open draft PR**

Title:

```txt
GENESIS V4 — Continental Skill Factory + STRATEX Context Compiler
```

Body must distinguish:
- implemented and tested;
- CI verified if green;
- production blocked pending runtime/deployment evidence.

- [ ] **Step 5: Update Notion from evidence only**

Record branch, commits, test counts, build/smoke results, CI status and remaining production blockers. Correct any prior Notion statement that overstates GitHub implementation state.
