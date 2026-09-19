# AfrIA Recruit UN Pathways Eligibility Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a deterministic institutional-pathway eligibility and recommendation core for AfrIA Recruit™ that proves `FIT != ELIGIBILITY` and returns explainable `APPLY / PREPARE / SKIP` outcomes.

**Architecture:** Add one pure domain module under `apps/afria-recruit/lib/domain/` plus one focused unit-test file. Source adapters and persistence are deliberately excluded from this slice. All candidate facts are explicit inputs; missing hard-rule data yields `REVIEW_REQUIRED` rather than inferred eligibility.

**Tech Stack:** TypeScript 5.7+, Node.js 24 test runner, existing `npm run test:unit`, Next.js 16.3.0 repository conventions.

**Spec:** `docs/superpowers/specs/2026-09-04-afria-recruit-un-pathways-eligibility-core-design.md`

## Global Constraints

- Product authority remains `PRD-RECRUIT-001 — AfrIA Recruit™`; no new SaaS/product is created.
- `FIT != ELIGIBILITY`; fit score never overrides a hard eligibility failure.
- Missing data required by a hard rule returns `REVIEW_REQUIRED`, never `ELIGIBLE`.
- Candidate nationality, age, education, residence, sponsor or other eligibility facts are never inferred from name, photo, language, `homeCountry`, `currentCountry` or proxies.
- No network, database, AI inference, auto-submit or persistence is introduced in this slice.
- Programme states are exactly `VERIFIED_OPEN`, `CLOSED`, `RECURRING`, `COUNTRY_DEPENDENT`, `SPONSOR_DEPENDENT`, `REVIEW_REQUIRED`.
- Recommendation states are exactly `APPLY`, `PREPARE`, `SKIP`.

---

### Task 1: Prove the core eligibility semantics RED

**Files:**
- Create: `apps/afria-recruit/tests/unit/institutional-pathways.test.ts`
- Create later in Task 2: `apps/afria-recruit/lib/domain/institutional-pathways.ts`

**Interfaces:**
- Consumes: none beyond Node `assert` and `node:test`.
- Produces expectations for `evaluatePathwayEligibility`, `recommendInstitutionalPathway`, `rankInstitutionalPathways`, `InstitutionalPathway`, and `CandidateEligibilityProfile`.

- [ ] **Step 1: Write the failing test file**

Create `apps/afria-recruit/tests/unit/institutional-pathways.test.ts` with these cases:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluatePathwayEligibility,
  rankInstitutionalPathways,
  recommendInstitutionalPathway,
  type CandidateEligibilityProfile,
  type InstitutionalPathway,
} from '../../lib/domain/institutional-pathways.js';

const basePathway: InstitutionalPathway = {
  id: 'UN-YPP-2026',
  institution: 'United Nations Secretariat',
  title: 'Young Professionals Programme',
  programType: 'YOUNG_PROFESSIONAL_PROGRAM',
  sourceRef: 'https://careers.un.org/ypp',
  sourceVerifiedAt: '2026-09-04T00:00:00Z',
  state: 'VERIFIED_OPEN',
  hardRules: [],
};

const eligibleProfile: CandidateEligibilityProfile = {
  nationalityCodes: ['BJ'],
  age: 29,
  highestEducationLevel: 'master',
  yearsExperience: 4,
  languageCodes: ['fr', 'en'],
  sponsorCountryCode: 'BJ',
  participatingCountryCodes: ['BJ', 'ML', 'GN'],
  monthsSinceGraduation: 24,
  residenceCountryCode: 'BJ',
  availableDocumentCodes: ['passport', 'degree'],
};

test('high fit never overrides a failed nationality hard rule', () => {
  const pathway: InstitutionalPathway = {
    ...basePathway,
    hardRules: [{
      id: 'nationality',
      kind: 'nationality',
      label: 'Nationality must be from a participating country',
      sourceRef: basePathway.sourceRef,
      allowedCodes: ['ML', 'GN'],
    }],
  };

  const result = recommendInstitutionalPathway(pathway, eligibleProfile, 95);
  assert.equal(result.eligibility.status, 'INELIGIBLE');
  assert.equal(result.recommendation, 'SKIP');
  assert.equal(result.fitScore, 95);
});

test('missing sponsor fact returns review required', () => {
  const pathway: InstitutionalPathway = {
    ...basePathway,
    state: 'SPONSOR_DEPENDENT',
    hardRules: [{
      id: 'sponsor',
      kind: 'sponsor',
      label: 'Sponsor country must be confirmed',
      sourceRef: basePathway.sourceRef,
      allowedCodes: ['FR', 'BE'],
    }],
  };
  const profile = { ...eligibleProfile, sponsorCountryCode: undefined };
  const eligibility = evaluatePathwayEligibility(pathway, profile);
  assert.equal(eligibility.status, 'REVIEW_REQUIRED');
  assert.equal(eligibility.rules[0]?.status, 'REVIEW_REQUIRED');
  assert.equal(recommendInstitutionalPathway(pathway, profile, 88).recommendation, 'PREPARE');
});

test('closed programme is skipped even when candidate is eligible', () => {
  const pathway: InstitutionalPathway = { ...basePathway, state: 'CLOSED' };
  const result = recommendInstitutionalPathway(pathway, eligibleProfile, 91);
  assert.equal(result.eligibility.status, 'ELIGIBLE');
  assert.equal(result.recommendation, 'SKIP');
});

test('verified open programme with satisfied rules is apply', () => {
  const pathway: InstitutionalPathway = {
    ...basePathway,
    hardRules: [
      {
        id: 'age',
        kind: 'age',
        label: 'Maximum age 32',
        sourceRef: basePathway.sourceRef,
        maximum: 32,
      },
      {
        id: 'education',
        kind: 'education',
        label: 'Bachelor or above',
        sourceRef: basePathway.sourceRef,
        minimumEducationLevel: 'bachelor',
      },
      {
        id: 'language',
        kind: 'language',
        label: 'English or French required',
        sourceRef: basePathway.sourceRef,
        allowedCodes: ['en', 'fr'],
      },
    ],
  };

  const result = recommendInstitutionalPathway(pathway, eligibleProfile, 76);
  assert.equal(result.eligibility.status, 'ELIGIBLE');
  assert.equal(result.recommendation, 'APPLY');
});

test('missing country participation evidence never defaults to eligible', () => {
  const pathway: InstitutionalPathway = {
    ...basePathway,
    state: 'COUNTRY_DEPENDENT',
    hardRules: [{
      id: 'country-participation',
      kind: 'country_participation',
      label: 'Country must participate in the current cycle',
      sourceRef: basePathway.sourceRef,
      requiredCode: 'BJ',
    }],
  };
  const profile = { ...eligibleProfile, participatingCountryCodes: undefined };
  const result = evaluatePathwayEligibility(pathway, profile);
  assert.equal(result.status, 'REVIEW_REQUIRED');
});

test('ladder ranks apply before prepare and skip regardless of higher ineligible fit', () => {
  const apply = recommendInstitutionalPathway(basePathway, eligibleProfile, 70);
  const prepare = recommendInstitutionalPathway(
    { ...basePathway, id: 'UN-JPO', state: 'SPONSOR_DEPENDENT' },
    eligibleProfile,
    90,
  );
  const skip = recommendInstitutionalPathway(
    {
      ...basePathway,
      id: 'UN-YPP-BLOCKED',
      hardRules: [{
        id: 'nationality',
        kind: 'nationality',
        label: 'Different participating countries',
        sourceRef: basePathway.sourceRef,
        allowedCodes: ['ET'],
      }],
    },
    eligibleProfile,
    99,
  );

  assert.deepEqual(
    rankInstitutionalPathways([skip, prepare, apply]).map((row) => row.pathwayId),
    ['UN-YPP-2026', 'UN-JPO', 'UN-YPP-BLOCKED'],
  );
});
```

- [ ] **Step 2: Run the focused unit compile/test and verify RED**

Run from `apps/afria-recruit`:

```bash
npm run test:unit
```

Expected: FAIL because `../../lib/domain/institutional-pathways.js` does not exist yet.

- [ ] **Step 3: Commit the RED test**

```bash
git add apps/afria-recruit/tests/unit/institutional-pathways.test.ts
git commit -m "test(recruit): define institutional pathway eligibility semantics"
```

---

### Task 2: Implement the minimal deterministic eligibility core GREEN

**Files:**
- Create: `apps/afria-recruit/lib/domain/institutional-pathways.ts`
- Test: `apps/afria-recruit/tests/unit/institutional-pathways.test.ts`

**Interfaces:**
- Consumes: explicit `InstitutionalPathway`, `CandidateEligibilityProfile`, numeric fit score.
- Produces:
  - `evaluatePathwayEligibility(pathway, profile): PathwayEligibilityResult`
  - `recommendInstitutionalPathway(pathway, profile, fitScore): InstitutionalPathwayRecommendation`
  - `rankInstitutionalPathways(rows): InstitutionalPathwayRecommendation[]`

- [ ] **Step 1: Add the production module**

Create `apps/afria-recruit/lib/domain/institutional-pathways.ts` with these public types and functions:

```ts
export type ProgramState =
  | 'VERIFIED_OPEN'
  | 'CLOSED'
  | 'RECURRING'
  | 'COUNTRY_DEPENDENT'
  | 'SPONSOR_DEPENDENT'
  | 'REVIEW_REQUIRED';

export type EligibilityRuleKind =
  | 'nationality'
  | 'age'
  | 'education'
  | 'experience'
  | 'language'
  | 'sponsor'
  | 'country_participation'
  | 'post_graduation_window'
  | 'residency'
  | 'document';

export type EducationLevel = 'secondary' | 'bachelor' | 'master' | 'doctorate';
export type RuleEvaluationStatus = 'PASS' | 'FAIL' | 'REVIEW_REQUIRED';
export type EligibilityStatus = 'ELIGIBLE' | 'INELIGIBLE' | 'REVIEW_REQUIRED';
export type PathwayRecommendation = 'APPLY' | 'PREPARE' | 'SKIP';

export interface EligibilityRule {
  id: string;
  kind: EligibilityRuleKind;
  label: string;
  sourceRef: string;
  allowedCodes?: string[];
  requiredCode?: string;
  minimum?: number;
  maximum?: number;
  minimumEducationLevel?: EducationLevel;
  requiredDocumentCode?: string;
}

export interface InstitutionalPathway {
  id: string;
  institution: string;
  title: string;
  programType: string;
  sourceRef: string;
  sourceVerifiedAt: string;
  state: ProgramState;
  hardRules: EligibilityRule[];
}

export interface CandidateEligibilityProfile {
  nationalityCodes?: string[];
  age?: number;
  highestEducationLevel?: EducationLevel;
  yearsExperience?: number;
  languageCodes?: string[];
  sponsorCountryCode?: string;
  participatingCountryCodes?: string[];
  monthsSinceGraduation?: number;
  residenceCountryCode?: string;
  availableDocumentCodes?: string[];
}

export interface RuleEvaluation {
  ruleId: string;
  label: string;
  status: RuleEvaluationStatus;
  sourceRef: string;
  explanation: string;
}

export interface PathwayEligibilityResult {
  status: EligibilityStatus;
  rules: RuleEvaluation[];
}

export interface InstitutionalPathwayRecommendation {
  pathwayId: string;
  pathwayTitle: string;
  programmeState: ProgramState;
  fitScore: number;
  eligibility: PathwayEligibilityResult;
  recommendation: PathwayRecommendation;
}
```

Implementation rules:

```ts
const EDUCATION_RANK: Record<EducationLevel, number> = {
  secondary: 0,
  bachelor: 1,
  master: 2,
  doctorate: 3,
};

function missing(rule: EligibilityRule): RuleEvaluation {
  return {
    ruleId: rule.id,
    label: rule.label,
    status: 'REVIEW_REQUIRED',
    sourceRef: rule.sourceRef,
    explanation: 'Required candidate fact is missing; human/source review is required.',
  };
}
```

For each rule kind:

- `nationality`: compare `profile.nationalityCodes` to `allowedCodes`, PASS if at least one intersects, FAIL otherwise, missing candidate or rule operand => review/config error respectively.
- `age`: compare `profile.age` against optional `minimum`/`maximum`.
- `education`: compare `EDUCATION_RANK[profile.highestEducationLevel] >= EDUCATION_RANK[minimumEducationLevel]`.
- `experience`: compare `profile.yearsExperience` to `minimum` and optional `maximum`.
- `language`: compare `profile.languageCodes` to `allowedCodes`, PASS on any intersection.
- `sponsor`: compare `profile.sponsorCountryCode` to `allowedCodes`.
- `country_participation`: require `requiredCode` and test membership in `profile.participatingCountryCodes`.
- `post_graduation_window`: compare `profile.monthsSinceGraduation` to optional `minimum`/`maximum`.
- `residency`: compare `profile.residenceCountryCode` to `allowedCodes`.
- `document`: require `requiredDocumentCode` and test membership in `profile.availableDocumentCodes`.

Contract validation must throw an `Error` when pathway or rule identifiers/labels/source refs are blank, `sourceVerifiedAt` is blank, or a rule lacks the operand required by its kind.

Overall status:

```ts
if (rules.some((rule) => rule.status === 'FAIL')) return 'INELIGIBLE';
if (rules.some((rule) => rule.status === 'REVIEW_REQUIRED')) return 'REVIEW_REQUIRED';
return 'ELIGIBLE';
```

Recommendation:

```ts
if (eligibility.status === 'INELIGIBLE') return 'SKIP';
if (pathway.state === 'CLOSED') return 'SKIP';
if (pathway.state === 'VERIFIED_OPEN' && eligibility.status === 'ELIGIBLE') return 'APPLY';
return 'PREPARE';
```

Ranking priority:

```ts
const PRIORITY = { APPLY: 0, PREPARE: 1, SKIP: 2 } as const;
```

Sort by priority ascending, fit score descending, pathway id ascending.

- [ ] **Step 2: Run unit tests and verify GREEN**

```bash
npm run test:unit
```

Expected: all unit tests PASS, including `institutional-pathways.test.ts`.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit the implementation**

```bash
git add apps/afria-recruit/lib/domain/institutional-pathways.ts apps/afria-recruit/tests/unit/institutional-pathways.test.ts
git commit -m "feat(recruit): add institutional pathway eligibility core"
```

---

### Task 3: Harden invalid contracts and boundary values

**Files:**
- Modify: `apps/afria-recruit/tests/unit/institutional-pathways.test.ts`
- Modify: `apps/afria-recruit/lib/domain/institutional-pathways.ts`

**Interfaces:**
- Consumes: same public interfaces from Task 2.
- Produces: deterministic validation errors and boundary-safe fit scoring.

- [ ] **Step 1: Add failing hardening tests**

Append tests that assert:

```ts
test('missing rule sourceRef is rejected as invalid normalized source data', () => {
  const pathway: InstitutionalPathway = {
    ...basePathway,
    hardRules: [{
      id: 'age',
      kind: 'age',
      label: 'Maximum age',
      sourceRef: '',
      maximum: 32,
    }],
  };
  assert.throws(() => evaluatePathwayEligibility(pathway, eligibleProfile), /sourceRef/i);
});

test('fit score outside 0 to 100 is rejected', () => {
  assert.throws(
    () => recommendInstitutionalPathway(basePathway, eligibleProfile, 101),
    /fit score/i,
  );
});

test('missing rule operand is rejected instead of becoming candidate review', () => {
  const pathway: InstitutionalPathway = {
    ...basePathway,
    hardRules: [{
      id: 'education',
      kind: 'education',
      label: 'Education threshold',
      sourceRef: basePathway.sourceRef,
    }],
  };
  assert.throws(() => evaluatePathwayEligibility(pathway, eligibleProfile), /education/i);
});
```

- [ ] **Step 2: Run tests and verify RED**

```bash
npm run test:unit
```

Expected: at least one new hardening assertion FAILS until validation is implemented.

- [ ] **Step 3: Add minimal validation helpers**

Add internal helpers that validate non-empty strings, fit score `0 <= score <= 100`, and required rule operands before evaluation. Validation errors must distinguish invalid normalized source data from missing candidate data.

- [ ] **Step 4: Run full Candidate OS check**

```bash
npm run check
```

Expected: unit tests PASS, typecheck PASS, production build PASS, source scan PASS, build scan PASS.

- [ ] **Step 5: Commit the hardening**

```bash
git add apps/afria-recruit/lib/domain/institutional-pathways.ts apps/afria-recruit/tests/unit/institutional-pathways.test.ts
git commit -m "test(recruit): harden pathway eligibility contracts"
```

---

### Task 4: Open PR and verify GitHub Actions evidence

**Files:**
- No production file changes expected.

**Interfaces:**
- Consumes: branch `feat/afria-recruit-un-pathways-p0`.
- Produces: reviewable pull request plus CI evidence for the P0 slice.

- [ ] **Step 1: Push/ensure branch is current and open a pull request**

PR title:

```text
feat(recruit): add UN pathways eligibility core
```

PR body must state:

```text
Implements the first P0 software slice of UN System Entry Pathways Intelligence™ under PRD-RECRUIT-001.

Proves:
- FIT != ELIGIBILITY
- missing hard-rule facts => REVIEW_REQUIRED
- CLOSED programmes cannot become APPLY
- source-backed rule evaluations are explainable
- APPLY/PREPARE/SKIP ladder is deterministic

Out of scope: live UN connectors, persistence, auto-submit, outcome learning, production deployment.

Gate target: TEST_PROVEN domain core only; M6/S7+/M8 and live-source E2E remain open.
```

- [ ] **Step 2: Wait for `AfrIA Recruit Candidate OS` PR workflow**

Expected workflow from `.github/workflows/afria-recruit-candidate-os.yml`:

- Node.js 24
- locked `npm ci`
- `npm audit --audit-level=high`
- `npm run test:unit`
- `npm run typecheck`
- `npm run build`
- Playwright Chromium install + `npm run test:e2e`
- source scan
- build scan

- [ ] **Step 3: Record the exact head SHA and workflow result**

Do not claim TEST_PROVEN unless the current PR head has a successful Candidate OS workflow. If CI fails, inspect the failing job and fix via the same RED/GREEN discipline before updating the release claim.

- [ ] **Step 4: Update the Notion canonical AfrIA Recruit™ page only after CI evidence exists**

Record branch, PR, head SHA, workflow run/result and the bounded verdict `UN PATHWAYS ELIGIBILITY CORE — TEST_PROVEN` only if CI is green. Keep live source ingestion, real candidate E2E, S7+, M8, external review and production marked open.
