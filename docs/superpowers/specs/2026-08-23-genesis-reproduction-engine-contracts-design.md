# GENESIS V4 — Reproduction Engine Contracts Design

**Date:** 2026-08-23  
**Status:** DESIGN APPROVED IN CHAT — WRITTEN SPEC READY FOR FINAL REVIEW  
**Branch:** `feat/genesis-reproduction-engine-contracts`  
**Base:** `genesis-v4-continental-skill-factory`  
**Canonical authority:** GENESIS V4 Genome™ — Référence opérationnelle vivante, décision « GENESIS™ Valuation & Reproduction Thesis — 23 août 2026 ».

## 1. Purpose

Turn the canonical valuation and reproduction thesis into executable GENESIS V4 contracts.

The runtime must enforce this hierarchy:

`GENESIS™ = IP + Genome™ + genetic core`
→ `Genesis Reproduction Engine™ = controlled replication capability`
→ `AfrIAgenesis® = first continental implementation + first proof of the model`
→ `Country Genesis = sovereign national contextualization`
→ `Sector Operating Systems = domain specialization + vertical monetization`
→ `R.E.M.E™ = learning returned to GENESIS™ + improvement of subsequent generations`.

The machine invariant is:

**AfrIAgenesis proves. GENESIS owns the DNA. Reproduction Engine replicates. Country Genesis contextualizes. Sector OS monetizes. R.E.M.E capitalizes learning.**

## 2. Problem

GENESIS V4 already contains executable building blocks for country compilation, contextualization, skill reuse, governance, persistence and evidence. However, the relationship between GENESIS, continental implementations, Country Genesis entities and Sector OS products is still primarily documentary.

Without an executable reproduction contract, the system can accidentally:

- create a country entity without a GENESIS parent;
- treat localization as translation only;
- fork country-specific code instead of parameterizing reusable DNA;
- bypass M6, S7+ or M8 requirements;
- claim platform value from an unproven future entity;
- fail to return local evidence to R.E.M.E;
- lose lineage between parent DNA and child implementation.

## 3. Goals

The first implementation must provide six machine contracts:

1. `GenesisCoreIdentity`
2. `ReproductionContract`
3. `SovereignContextPack`
4. `ValuationBoundary`
5. `ReplicationEvidence`
6. `RemeInheritanceLoop`

It must integrate with the existing `countryCompiler.ts`, `skillFactory.ts`, context-pack provenance, governance approval ledger and MCP server.

It must make invalid reproduction attempts fail deterministically with stable error codes.

## 4. Non-goals

This change does not:

- create AsiaGENESIS, AmericasGenesis or EurAIGenesis;
- assign financial value to future continental children;
- replace STRATEX-99, STRATEX-9, ECES, M6, S7+, M8 or R.E.M.E;
- create a second skill registry;
- duplicate country-specific skills;
- implement billing or licensing settlement;
- change the canonical rule that the active Genome is the authority.

## 5. Architectural principle

The Reproduction Engine is an orchestration and governance layer above existing reusable components.

It does not rebuild the country compiler or skill factory. It composes them.

```text
GENESIS Core Identity
        ↓
Reproduction Contract
        ↓
Sovereign Context Pack + provenance
        ↓
STRATEX-99 / STRATEX-9 qualification
        ↓
Country Compiler + Skill Registry
        ↓
M6 / S7+ / M8 governance
        ↓
Child Genesis / Sector OS evidence
        ↓
Replication Evidence
        ↓
R.E.M.E inheritance loop
        ↓
GENESIS Core learning
```

## 6. Domain contracts

### 6.1 GenesisCoreIdentity

Create `services/mcp-server/src/genesisReproduction.ts`.

The module owns the canonical reproduction domain types and pure validation functions.

```ts
export type GenesisEntityType =
  | "core"
  | "continental"
  | "country"
  | "sector";

export interface GenesisCoreIdentity {
  id: "GENESIS";
  genomeVersion: string;
  authorityRef: string;
  inheritedSystems: string[];
  universalInvariants: Record<string, unknown>;
}
```

Required inherited systems for a reproduction-capable core:

- `GENOME`
- `DFM`
- `TRM`
- `STRATEX-99`
- `GOIR`
- `ECES`
- `M6`
- `S7+`
- `M8`
- `R.E.M.E`

The validator must reject an identity missing any required inherited system with:

`GENESIS_CORE_INCOMPLETE:<system>`.

### 6.2 SovereignContextPack

The existing `Stratex99Context` remains the evidence-bearing context structure. The Reproduction Engine wraps it with sovereign metadata rather than replacing it.

```ts
export interface SovereignContextPack {
  countryCode?: string;
  continentCode?: string;
  sectorCode?: string;
  context: Stratex99Context;
  provenance: ContextPackProvenance;
  paymentCapability: "enabled" | "not_applicable";
  legalJurisdictionRefs: string[];
  paymentRailRefs: string[];
  dataSovereigntyRefs: string[];
  institutionalRefs: string[];
  localKnowledgeRefs: string[];
}
```

A territorial child must prove more than language localization.

For `continental` and `country` entities, the following context layers cannot be absent:

- `languageSemantic`
- `regulatoryLegal`
- `institutional`
- `economicFinancialPayment`
- `culturalHumanAdoption`
- `infrastructureResilience`
- `technologyDataAgenticAI`
- `governanceSovereigntyAssurance`

Each applicable layer must carry evidence refs.

The following extra reference sets must be non-empty for a `country` child:

- `legalJurisdictionRefs`
- `dataSovereigntyRefs`
- `institutionalRefs`
- `localKnowledgeRefs`

When `paymentCapability = "enabled"`, `paymentRailRefs` must be non-empty. When `paymentCapability = "not_applicable"`, an empty `paymentRailRefs` array is valid.

A child localized by language alone fails with:

`SOVEREIGN_CONTEXT_TRANSLATION_ONLY`.

### 6.3 ReproductionContract

```ts
export type ReproductionGateStatus = "pass" | "conditional" | "fail";

export interface ReproductionContract {
  reproductionId: string;
  parentEntityId: string;
  parentEntityType: GenesisEntityType;
  childEntityId: string;
  childEntityType: Exclude<GenesisEntityType, "core">;
  jurisdictionCode?: string;
  inheritedGenomeVersion: string;
  inheritedInvariantKeys: string[];
  allowedAdaptations: string[];
  forbiddenAdaptations: string[];
  sovereignContext: SovereignContextPack;
  m6: ReproductionGateStatus;
  s7plus: ReproductionGateStatus;
  m8: ReproductionGateStatus;
  rollbackRef: string;
  evidenceRefs: string[];
  remeReturnRequired: true;
}
```

Rules:

- every continental child must have `parentEntityId = GENESIS`;
- every country child must have a parent of type `continental` or `core` and must retain GENESIS lineage;
- every country child must have `jurisdictionCode` matching `sovereignContext.countryCode`;
- every sector child must have a valid parent of type `continental` or `country`;
- `inheritedGenomeVersion` must equal the active parent Genome version used for compilation;
- `inheritedInvariantKeys` must contain all universal invariants required by the parent;
- an adaptation cannot appear in both allowed and forbidden lists;
- `rollbackRef` and `evidenceRefs` are mandatory;
- `remeReturnRequired` is always true and cannot be disabled;
- S7+ `fail` always blocks;
- M6 `fail` always blocks;
- M8 `fail` always blocks;
- M8 `conditional` requires an explicit governance approval record before release.

Stable failure codes:

- `REPRODUCTION_PARENT_INVALID`
- `REPRODUCTION_LINEAGE_BROKEN`
- `REPRODUCTION_JURISDICTION_MISMATCH`
- `REPRODUCTION_GENOME_VERSION_MISMATCH`
- `REPRODUCTION_INVARIANT_MISSING:<key>`
- `REPRODUCTION_ADAPTATION_CONFLICT:<key>`
- `REPRODUCTION_ROLLBACK_REQUIRED`
- `REPRODUCTION_EVIDENCE_REQUIRED`
- `REPRODUCTION_M6_FAIL`
- `REPRODUCTION_S7_FAIL`
- `REPRODUCTION_M8_FAIL`
- `REPRODUCTION_M8_APPROVAL_REQUIRED`

### 6.4 ReplicationEvidence

Platform premium must be driven by evidence of reuse, not by the existence of future brand names.

```ts
export interface ReplicationEvidence {
  reproductionId: string;
  parentEntityId: string;
  childEntityId: string;
  inheritedComponents: string[];
  adaptedComponents: string[];
  rebuiltComponents: string[];
  reusedSkillRefs: Array<{ id: string; version: string }>;
  newSkillRefs: Array<{ id: string; version: string }>;
  evidenceRefs: string[];
  secondContextEvidenceRefs: string[];
  measuredAt: string;
}

export interface ReplicationScore {
  reusableShare: number;
  rebuildShare: number;
  platformEvidenceStatus: "insufficient" | "emerging" | "proven";
}
```

Scoring rules:

- the denominator is the count of unique component IDs across `inheritedComponents`, `adaptedComponents` and `rebuiltComponents`;
- `reusableShare = unique inherited component count / total unique component count`;
- `rebuildShare = unique rebuilt component count / total unique component count`;
- empty `evidenceRefs` make the score `insufficient` regardless of ratios;
- `proven` requires `reusableShare >= 0.80`, `rebuildShare <= 0.20`, at least one reused registered skill, and non-empty `secondContextEvidenceRefs`;
- `emerging` requires `reusableShare >= 0.50` with non-empty `evidenceRefs`;
- otherwise status is `insufficient`.

This score is an operational evidence classification, not a monetary valuation.

### 6.5 ValuationBoundary

```ts
export type ValuationPerimeter =
  | "AFRIAGENESIS_OPERATING_COMPANY"
  | "GENESIS_GLOBAL_IP_REPRODUCTION_PLATFORM";

export interface ValuationClaim {
  perimeter: ValuationPerimeter;
  entityId: string;
  claimType: "current_value" | "option_value" | "impact_value";
  evidenceRefs: string[];
  productionProven: boolean;
  revenueProven: boolean;
  platformPremiumClaimed: boolean;
  mergeIntoEquityValue: boolean;
}
```

Rules:

- a future continental entity cannot be represented as current operating revenue without production and revenue evidence;
- `option_value` is allowed for unlaunched children but must remain explicitly labeled as option value;
- `impact_value` with `mergeIntoEquityValue = true` is rejected;
- AfrIAgenesis operating metrics and GENESIS IP/platform metrics remain separate perimeters;
- `platformPremiumClaimed = true` requires `ReplicationEvidence.platformEvidenceStatus = proven`.

Stable failure codes:

- `VALUATION_PERIMETER_REQUIRED`
- `VALUATION_FUTURE_REVENUE_NOT_PROVEN`
- `VALUATION_IMPACT_EQUITY_CONFLATION`
- `VALUATION_PLATFORM_PREMIUM_NOT_PROVEN`
- `VALUATION_EVIDENCE_REQUIRED`

### 6.6 RemeInheritanceLoop

```ts
export interface RemeInheritanceRecord {
  reproductionId: string;
  childEntityId: string;
  localEvidenceRefs: string[];
  secondContextEvidenceRefs: string[];
  learnedPatterns: string[];
  reusableAssets: string[];
  excludedLocalRules: string[];
  targetGenomeVersion: string;
  returnedAt: string;
}
```

Rules:

- every released reproduction contract must produce at least one R.E.M.E inheritance record;
- local rules must be explicitly separated from reusable assets;
- any asset listed in both `reusableAssets` and `excludedLocalRules` fails as local-rule leakage;
- a record cannot promote a local rule into the Genome unless `secondContextEvidenceRefs` is non-empty;
- an entity cannot be considered `reproduction_complete` while its R.E.M.E return is missing.

Stable failure codes:

- `REME_RETURN_REQUIRED`
- `REME_EVIDENCE_REQUIRED`
- `REME_LOCAL_RULE_LEAKAGE`
- `REME_SECOND_CONTEXT_REQUIRED`

## 7. Integration with Country Compiler

Modify `services/mcp-server/src/countryCompiler.ts`.

`CountryCompileInput` gains:

```ts
reproductionContract: ReproductionContract;
```

Before skill composition, `compileCountrySkill()` validates:

1. child type is `country`;
2. `reproductionContract.jurisdictionCode` equals the requested country code;
3. `sovereignContext.countryCode` equals the requested country code;
4. parent lineage is valid;
5. active Genome version and inherited Genome version match;
6. reproduction gates permit compilation;
7. sovereign context passes the non-translation test.

The existing STRATEX-99, STRATEX-9, jurisdiction, skill lifecycle and Genome invariant checks remain unchanged and execute after reproduction validation.

The returned `CountryCompiledSkill` gains:

```ts
reproduction: {
  reproductionId: string;
  parentEntityId: string;
  childEntityId: string;
  jurisdictionCode: string;
  inheritedGenomeVersion: string;
};
```

## 8. Governance integration

Use the existing governance approval ledger for conditional M8 approval.

No parallel approval store is created.

The Reproduction Engine asks the ledger whether the specific `reproductionId` has an applicable M8 approval record before a contract with `m8 = conditional` may be released.

S7+ fail remains non-overridable.

M6 fail remains non-overridable by the Reproduction Engine.

## 9. MCP surface

Create `services/mcp-server/src/mcpGenesisReproductionTools.ts` and expose three tools through the existing MCP server registration pattern:

### `genome.reproduction.validate`

Input: `GenesisCoreIdentity + ReproductionContract`.  
Output: validated contract with stable status and blockers.

Required scope: `genome:reproduction`.

### `genome.reproduction.score`

Input: `ReplicationEvidence`.  
Output: `ReplicationScore`.

Required scope: `genome:reproduction:read`.

### `genome.valuation.boundary`

Input: `ValuationClaim` plus optional `ReplicationScore`.  
Output: accepted perimeter classification or stable validation error.

Required scope: `genome:valuation`.

These tools are decision-support and governance tools. They do not execute financial transactions, create companies or deploy child entities.

## 10. Persistence

The first release uses the repository's existing persistence coordinator and JSON/file registry pattern already present in the continental skill factory branch.

Create a dedicated reproduction registry namespace rather than modifying the skill registry schema.

Required persisted records:

- validated reproduction contract;
- replication evidence;
- replication score snapshot;
- R.E.M.E inheritance record;
- integrity hash and creation timestamp.

Each record must be content-hashed. Reads verify the stored hash before returning data.

No sensitive secrets or API credentials may be persisted in these records.

## 11. Security and sovereignty

- least privilege scopes for each MCP tool;
- no autonomous child deployment from validation calls;
- no M8 bypass;
- no S7+ bypass;
- no weakening of universal Genome invariants;
- context provenance must be verified before country reproduction;
- local legal and regulatory references remain jurisdiction-specific and may not be generalized automatically;
- no production or valuation claim is generated from simulated evidence without an explicit simulation label.

## 12. Test strategy

Follow TDD. Tests are written before implementation.

Create:

- `services/mcp-server/tests/genesisReproduction.test.ts`
- `services/mcp-server/tests/genesisValuation.test.ts`
- `services/mcp-server/tests/remeInheritance.test.ts`

Modify country compiler tests to cover reproduction enforcement.

Required test cases:

1. valid AfrIAgenesis continental child of GENESIS passes;
2. continental child with non-GENESIS parent fails;
3. country child without parent lineage fails;
4. country localization with only `languageSemantic` covered fails as translation-only;
5. country context with legal, institutional, sovereignty and local knowledge evidence passes;
6. payment-enabled country context without payment rail evidence fails;
7. payment-not-applicable country context may omit payment rails;
8. missing inherited Genome invariant fails;
9. Genome version mismatch fails;
10. country jurisdiction mismatch fails;
11. M6 fail blocks;
12. S7+ fail blocks;
13. M8 conditional without approval blocks release;
14. M8 conditional with valid approval passes;
15. 80%+ reusable reproduction with second-context evidence becomes `proven`;
16. high rebuild reproduction remains `insufficient` or `emerging`;
17. future AsiaGENESIS current-value/revenue claim without evidence fails;
18. future AsiaGENESIS option-value claim with evidence is accepted as option value only;
19. impact value with `mergeIntoEquityValue = true` fails;
20. platform premium without `proven` replication evidence fails;
21. released child without R.E.M.E return is incomplete;
22. R.E.M.E record leaking a country-only rule into reusable assets fails;
23. R.E.M.E promotion requiring second-context evidence fails when that evidence is absent;
24. country compiler rejects a contract whose jurisdiction differs from the requested country;
25. integrity tampering in persisted reproduction evidence is detected.

Verification commands after implementation:

```bash
cd services/mcp-server
npm test
npm run typecheck
npm run build
npm run smoke:mcp
```

All four commands must pass before the change is eligible for M6 review.

## 13. Release sequence

1. TDD implementation on `feat/genesis-reproduction-engine-contracts`.
2. Full MCP test/typecheck/build/smoke evidence.
3. M6 architecture and invariant review.
4. S7+ security review.
5. M8 review for doctrine, valuation and reproduction claims.
6. Merge only after required reviews pass.
7. Staging deployment.
8. Canary reproduction using a non-destructive country context fixture.
9. R.E.M.E return verification.
10. Production claim only after deployment, monitoring and rollback evidence exist.

## 14. Acceptance criteria

The feature is complete only when:

- GENESIS parentage and lineage are machine-enforced;
- Country Genesis cannot compile with translation-only localization;
- payment applicability is represented explicitly and validated;
- Genome invariants cannot silently drift during reproduction;
- M6/S7+/M8 gate failures cannot be bypassed;
- AfrIAgenesis operating valuation and GENESIS platform valuation are machine-separated;
- future continental children cannot be counted as proven operating revenue;
- platform premium is tied to measured second-context reuse evidence;
- every released child is incomplete until its R.E.M.E return is recorded;
- local rules cannot silently become reusable GENESIS DNA without second-context evidence;
- existing country compiler and skill factory behavior remains backward-compatible except where the new canonical reproduction contract intentionally makes previously ungoverned calls invalid;
- `npm test`, `npm run typecheck`, `npm run build`, and `npm run smoke:mcp` all pass.

## 15. Canonical product meaning after implementation

The code must make the following proposition true operationally, not merely rhetorically:

**AfrIAgenesis proves. GENESIS owns the DNA. Reproduction Engine replicates. Country Genesis contextualizes. Sector OS monetizes. R.E.M.E capitalizes learning.**
