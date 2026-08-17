# AfrIA Recruit™ Benchmark P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing Candidate OS vertical slice with recruiter calibration, an explainable Recruiter Reverse Twin™, Proof-of-Skill recommendations, evidence-safe elicitation hooks, structured interview prioritization, and an outcome-confirmation contract without weakening current truth, consent, RLS or human-review invariants.

**Architecture:** Extend `JobSpec`, `RequirementCoverage`, `CandidateOptimizerService`, `InterviewService` and `ApplicationService` with deterministic domain helpers first. Reuse existing API/runtime seams and persist only existing governed artifacts; P0 introduces no new database migration. Candidate-facing UX remains inside `CvOptimizerFlow.tsx`, while recruiter-facing P0 is an explainable lens over the same JobSpec rather than a parallel Recruiter product.

**Tech Stack:** Node 24, TypeScript 5.7, Next.js 16.3, React 19.2, Supabase/Postgres/RLS, node:test, Playwright 1.62.

## Global Constraints

- Canonical app: `apps/afria-recruit/`.
- Baseline: PR #35 head `f334f858ad1b69b78123d487fde716e60822fc00` plus approved design/amendment commits on `feat/afria-recruit-four-experts-delta`.
- No unsupported requirement may become a candidate claim.
- `DECLARED / EVIDENCED / VERIFIED` remain distinct.
- No challenge completion promotes evidence status by itself.
- Candidate outcomes remain unconfirmed until a distinct confirmation source exists.
- No hidden-employer-algorithm claim.
- No auto-submit.
- Raw interview/elicitation answers are not persisted in clear text by default.
- External model processing remains consent-gated.
- No new database migration in P0 unless an existing invariant is impossible to satisfy without one; current plan requires none.
- Existing 49 unit tests, 8 Playwright tests, typecheck, build, npm audit and privacy/build scans must remain green.

---

### Task 1: Recruiter calibration and lens domain contracts

**Files:**
- Modify: `apps/afria-recruit/lib/domain/types.ts`
- Create: `apps/afria-recruit/lib/domain/recruiter-lens.ts`
- Test: `apps/afria-recruit/tests/unit/recruiter-lens.test.ts`

**Interfaces:**
- Consumes: `JobSpec`, `JobRequirement`, `RequirementCoverage`.
- Produces: `RequirementPriority`, `ProofChallengeType`, `ProofChallengeRecommendation`, `RecruiterLensItem`, `buildRecruiterLens(jobSpec, coverage)`.

- [ ] **Step 1: Write the failing domain tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecruiterLens } from '../../lib/domain/recruiter-lens.js';
import type { JobSpec, RequirementCoverage } from '../../lib/domain/types.js';

const job: JobSpec = {
  id: 'job-1',
  title: 'Finance Manager',
  countryCode: 'SN',
  requirements: [
    { id: 'finance', kind: 'skill', label: 'Conformité financière', required: true, skillId: 'finance', minimumYears: 2, calibration: { blocking: true, priority: 'BLOCKING', minimumEvidence: 'EVIDENCED' } },
    { id: 'english', kind: 'language', label: 'Anglais B2', required: false, languageCode: 'en', minimumLevel: 'B2', calibration: { blocking: false, priority: 'MEDIUM', minimumEvidence: 'DECLARED' } },
  ],
};

const coverage: RequirementCoverage[] = [
  { requirementId: 'finance', requirement: 'Conformité financière', coverage: 'GAP', evidenceRefs: [], explanation: 'Aucune preuve.' },
  { requirementId: 'english', requirement: 'Anglais B2', coverage: 'PARTIAL', evidenceRefs: ['language:en'], explanation: 'Déclaratif.' },
];

test('recruiter lens never promotes GAP and marks blocking requirement', () => {
  const lens = buildRecruiterLens(job, coverage);
  const finance = lens.find((item) => item.requirementId === 'finance');
  assert.equal(finance?.coverage, 'GAP');
  assert.equal(finance?.priority, 'BLOCKING');
  assert.deepEqual(finance?.evidenceRefs, []);
  assert.ok(finance?.doNotClaim.includes('Conformité financière'));
});

test('partial or gap requirement receives bounded proof recommendation', () => {
  const lens = buildRecruiterLens(job, coverage);
  assert.equal(lens.find((item) => item.requirementId === 'finance')?.proofChallenge?.type, 'WORK_SAMPLE');
  assert.equal(lens.find((item) => item.requirementId === 'english')?.proofChallenge?.type, 'STRUCTURED_QUESTION');
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `cd apps/afria-recruit && npm run test:unit`
Expected: compile/test failure because `recruiter-lens.ts`, `calibration`, and lens types do not yet exist.

- [ ] **Step 3: Implement minimal contracts and deterministic lens**

Add to `types.ts`:

```ts
export type RequirementPriority = 'BLOCKING' | 'HIGH' | 'MEDIUM';
export type EvidenceExpectation = 'DECLARED' | 'EVIDENCED' | 'VERIFIED';

export interface RequirementCalibration {
  blocking: boolean;
  priority: RequirementPriority;
  minimumEvidence: EvidenceExpectation;
}
```

Add optional `calibration?: RequirementCalibration` to `JobRequirement`.

Create `recruiter-lens.ts` with deterministic mapping:
- explicit calibration wins;
- otherwise required requirements map to `HIGH`, optional requirements to `MEDIUM`;
- a required requirement may be `BLOCKING` only if `calibration.blocking === true`;
- `GAP` produces `doNotClaim=[requirement label]` and a proof recommendation;
- `PARTIAL` produces a proof recommendation but no status promotion;
- `COVERED` produces no challenge by default.

- [ ] **Step 4: Run unit tests to verify GREEN**

Run: `cd apps/afria-recruit && npm run test:unit`
Expected: all existing tests plus recruiter-lens tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/afria-recruit/lib/domain/types.ts apps/afria-recruit/lib/domain/recruiter-lens.ts apps/afria-recruit/tests/unit/recruiter-lens.test.ts
git commit -m "feat: add explainable recruiter lens contracts"
```

### Task 2: CandidateOptimizerService recruiter lens artifact

**Files:**
- Modify: `apps/afria-recruit/lib/services/candidate-optimizer-service.ts`
- Modify: `apps/afria-recruit/app/api/candidate/gap-analysis/route.ts`
- Modify: `apps/afria-recruit/lib/http/api-client.ts`
- Test: `apps/afria-recruit/tests/unit/optimizer-service.test.ts`

**Interfaces:**
- Consumes: `buildRecruiterLens(jobSpec, analysis.requirements)`.
- Produces: `analyzeJob()` response `{ decisionId, jobSpec, analysis, recruiterLens }` without changing the existing fields.

- [ ] **Step 1: Add failing service assertion**

Extend the existing `job analysis preserves unsupported requirements as GAP` test:

```ts
assert.equal(result.recruiterLens.find((item) => item.requirementId === 'skill:skill-finance')?.coverage, 'GAP');
assert.ok(result.recruiterLens.find((item) => item.requirementId === 'skill:skill-finance')?.doNotClaim.includes('Conformité financière'));
```

- [ ] **Step 2: Run unit tests and verify RED**

Run: `cd apps/afria-recruit && npm run test:unit`
Expected: TypeScript/test failure because `recruiterLens` is absent.

- [ ] **Step 3: Implement minimal service response**

In `analyzeJob`, derive `const recruiterLens = buildRecruiterLens(jobSpec, analysis.requirements)` after adapter analysis. Persist both analysis and recruiter lens in the same governed `candidate_job_gap_analysis_v2` payload while preserving `decisionType: 'match_recommendation'`.

Update the API client `GapAnalysisResponse` to include `recruiterLens: RecruiterLensItem[]`.

- [ ] **Step 4: Verify GREEN**

Run: `cd apps/afria-recruit && npm run test:unit && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/afria-recruit/lib/services/candidate-optimizer-service.ts apps/afria-recruit/lib/http/api-client.ts apps/afria-recruit/tests/unit/optimizer-service.test.ts
git commit -m "feat: expose recruiter lens with gap analysis"
```

### Task 3: Evidence Elicitation contract without persistence

**Files:**
- Create: `apps/afria-recruit/lib/domain/evidence-elicitation.ts`
- Modify: `apps/afria-recruit/lib/domain/achievement-writer.ts`
- Modify: `apps/afria-recruit/lib/services/candidate-optimizer-service.ts`
- Modify: `apps/afria-recruit/lib/http/api-client.ts`
- Test: `apps/afria-recruit/tests/unit/evidence-elicitation.test.ts`
- Test: `apps/afria-recruit/tests/unit/rewrite-consent-service.test.ts`

**Interfaces:**
- Produces: `ElicitationQuestion`, `ConfirmedFact`, `buildElicitationQuestions(sourceExperience, recruiterLens)`.
- Extends rewrite input with `confirmedFacts?: ConfirmedFact[]`.

- [ ] **Step 1: Write failing tests**

```ts
test('elicitation questions do not create a candidate fact', () => {
  const questions = buildElicitationQuestions(experience, lens);
  assert.ok(questions.length > 0);
  assert.equal('value' in questions[0]!, false);
});

test('confirmed elicited fact defaults to DECLARED and unsupported metric is rejected', () => {
  const fact: ConfirmedFact = { key: 'team_size', value: '12', status: 'DECLARED', sourceRef: 'experience:exp-1' };
  assert.equal(fact.status, 'DECLARED');
  assert.throws(() => rewriteAchievement({ sourceStatement: 'Coordination terrain.', verifiedMetrics: [], confirmedFacts: [{ ...fact, status: 'VERIFIED', sourceRef: '' }] }), /source/i);
});
```

- [ ] **Step 2: Verify RED**

Run: `cd apps/afria-recruit && npm run test:unit`
Expected: missing types/functions.

- [ ] **Step 3: Implement minimal elicitation and rewrite support**

Rules:
- Questions are generated from selected experience + GAP/PARTIAL lens items.
- No raw answer store is added.
- `ConfirmedFact.status` is one of `DECLARED | EVIDENCED | VERIFIED`.
- Achievement Writer may use a confirmed fact only when it has non-empty `sourceRef`; numeric facts are not treated as verified metrics unless status is `EVIDENCED` or `VERIFIED`.
- Existing `verifiedMetrics` behavior remains backward-compatible.

- [ ] **Step 4: Verify GREEN**

Run: `cd apps/afria-recruit && npm run test:unit && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/afria-recruit/lib/domain/evidence-elicitation.ts apps/afria-recruit/lib/domain/achievement-writer.ts apps/afria-recruit/lib/services/candidate-optimizer-service.ts apps/afria-recruit/lib/http/api-client.ts apps/afria-recruit/tests/unit/evidence-elicitation.test.ts apps/afria-recruit/tests/unit/rewrite-consent-service.test.ts
git commit -m "feat: add evidence-safe elicitation contract"
```

### Task 4: Structured interview uses recruiter lens risk

**Files:**
- Modify: `apps/afria-recruit/lib/ai/contracts.ts`
- Modify: `apps/afria-recruit/lib/ai/deterministic-adapter.ts`
- Modify: `apps/afria-recruit/lib/services/interview-service.ts`
- Test: `apps/afria-recruit/tests/unit/interview-application.test.ts`

**Interfaces:**
- Extends `InterviewTurnInput` with optional `recruiterLens`.
- `InterviewService.start/respond` recomputes current coverage/lens for the job and passes it to the adapter.

- [ ] **Step 1: Add failing interview tests**

Add a calibrated blocking finance requirement to the fixture job and assert the first question focuses it when it is GAP:

```ts
assert.match(result.turn.question, /Conformité financière/);
assert.deepEqual(result.turn.focusRequirementIds, ['skill:skill-finance']);
```

- [ ] **Step 2: Verify RED**

Run: `cd apps/afria-recruit && npm run test:unit`
Expected: current deterministic adapter focuses first GAP by array order rather than calibrated risk.

- [ ] **Step 3: Implement lens-prioritized interview focus**

Priority order:
1. `BLOCKING` + `GAP`;
2. `BLOCKING` + `PARTIAL`;
3. `HIGH` + `GAP`;
4. `HIGH` + `PARTIAL`;
5. remaining GAP/PARTIAL;
6. first requirement.

Do not persist raw answer text in output; retain current `rawAnswerStored:false` behavior.

- [ ] **Step 4: Verify GREEN**

Run: `cd apps/afria-recruit && npm run test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/afria-recruit/lib/ai/contracts.ts apps/afria-recruit/lib/ai/deterministic-adapter.ts apps/afria-recruit/lib/services/interview-service.ts apps/afria-recruit/tests/unit/interview-application.test.ts
git commit -m "feat: prioritize interview questions by recruiter evidence risk"
```

### Task 5: Two-sided outcome confirmation contract

**Files:**
- Modify: `apps/afria-recruit/lib/services/application-service.ts`
- Modify: `apps/afria-recruit/lib/domain/metrics.ts`
- Test: `apps/afria-recruit/tests/unit/interview-application.test.ts`
- Test: `apps/afria-recruit/tests/unit/domain.test.ts`

**Interfaces:**
- Produces: `OutcomeConfirmationSource = 'candidate' | 'employer' | 'system'` and `OutcomeConfirmation`.
- Current candidate reporting remains unchanged.
- P0 adds a pure domain helper `isOutcomeConfirmed(confirmations)`; no employer API yet.

- [ ] **Step 1: Write failing tests**

```ts
test('candidate report alone never confirms outcome', () => {
  assert.equal(isOutcomeConfirmed([{ source: 'candidate', confirmed: true }]), false);
});

test('employer or system confirmation can confirm outcome', () => {
  assert.equal(isOutcomeConfirmed([{ source: 'candidate', confirmed: true }, { source: 'employer', confirmed: true }]), true);
});
```

- [ ] **Step 2: Verify RED**

Run: `cd apps/afria-recruit && npm run test:unit`
Expected: missing helper/types.

- [ ] **Step 3: Implement minimal confirmation contract**

`isOutcomeConfirmed` returns true only when at least one `employer` or `system` source is confirmed. Candidate source alone is never sufficient. `calculateObservedMetrics` continues to consume a boolean confirmed flag and therefore needs no persistence change in P0.

- [ ] **Step 4: Verify GREEN**

Run: `cd apps/afria-recruit && npm run test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/afria-recruit/lib/services/application-service.ts apps/afria-recruit/lib/domain/metrics.ts apps/afria-recruit/tests/unit/interview-application.test.ts apps/afria-recruit/tests/unit/domain.test.ts
git commit -m "feat: define two-sided outcome confirmation contract"
```

### Task 6: Candidate command UX and recruiter lens display

**Files:**
- Modify: `apps/afria-recruit/components/candidate/CvOptimizerFlow.tsx`
- Create: `apps/afria-recruit/components/candidate/RecruiterLensPanel.tsx`
- Modify: `apps/afria-recruit/app/globals.css`
- Test: `apps/afria-recruit/tests/e2e/optimizer.spec.ts`

**Interfaces:**
- Consumes `GapAnalysisResponse.recruiterLens`.
- Displays the same Candidate OS flow under the intent copy `Je veux décrocher ce poste`.

- [ ] **Step 1: Add failing Playwright assertions**

Add assertions for:
- page contains `Je veux décrocher ce poste`;
- after gap analysis, recruiter lens is visible;
- a finance GAP remains labelled `GAP`;
- proof challenge appears without claiming the candidate has the skill;
- no application submit button appears.

- [ ] **Step 2: Verify RED in CI/browser**

Run: `cd apps/afria-recruit && npm run test:e2e`
Expected: new copy/panel assertions fail.

- [ ] **Step 3: Implement minimal UI**

Keep existing flow sequence and controls. Add `RecruiterLensPanel` after `GapMatrix`; do not add a new route or parallel wizard. Use existing warm candidate visual system and mobile layout.

- [ ] **Step 4: Verify GREEN**

Run: `cd apps/afria-recruit && npm run test:e2e`
Expected: PASS including 390×844 and keyboard flow.

- [ ] **Step 5: Commit**

```bash
git add apps/afria-recruit/components/candidate/CvOptimizerFlow.tsx apps/afria-recruit/components/candidate/RecruiterLensPanel.tsx apps/afria-recruit/app/globals.css apps/afria-recruit/tests/e2e/optimizer.spec.ts
git commit -m "feat: surface recruiter lens in candidate mission flow"
```

### Task 7: Full P0 regression gate

**Files:**
- Modify only if a regression fix is required by tests; no new feature scope.

**Interfaces:**
- Produces release evidence for the delta branch only.

- [ ] **Step 1: Run full unit/type/build/privacy checks**

Run:

```bash
cd apps/afria-recruit
npm ci --ignore-scripts
npm audit --audit-level=high
npm run check
```

Expected: unit tests PASS, typecheck PASS, Next.js build PASS, source/build scans PASS, audit has 0 high-or-greater vulnerabilities.

- [ ] **Step 2: Run browser suite**

Run: `cd apps/afria-recruit && npm run test:e2e`
Expected: all Candidate OS and new benchmark P0 E2E tests PASS.

- [ ] **Step 3: Review invariants**

Verify from tests/code that:
- GAP is never promoted;
- proof challenge is recommendation only;
- raw interview/elicitation text is not persisted;
- consent still gates external rewrite;
- candidate outcome remains unconfirmed;
- no auto-submit exists.

- [ ] **Step 4: Commit only regression fixes, if any**

```bash
git add <only files changed by verified regression fixes>
git commit -m "fix: preserve Candidate OS invariants in benchmark delta"
```

- [ ] **Step 5: Open/refresh draft PR against `feat/afria-recruit-candidate-os-v1` and record CI evidence**

The PR must remain draft until all P0 checks are green. It must target the Candidate OS baseline branch while PR #35 remains unmerged; after PR #35 merges, rebase/retarget to `main` and rerun equivalent CI before merge eligibility.
