# Verified Learning & Credential Intelligence Engine™ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the deterministic M6 core for AfrIA Recruit™ Verified Learning & Credential Intelligence Engine™ and automate `AR-LCI-001` as a regression contract.

**Architecture:** Add one focused domain module under `apps/afria-recruit/lib/domain/` that owns learning-opportunity normalization, classification, hard-gate evaluation, explainable ranking, verified credential completion and employability delta. Keep the first slice pure and deterministic: no new database schema, no network calls, no AI provider dependency, and no production claims. Unit tests exercise real domain behavior with synthetic fixtures modelled on the verified logistics examples.

**Tech Stack:** TypeScript 5.7, Node.js 24 native test runner, existing `npm run test:unit`, Next.js 16.3 typecheck/build, GitHub Actions `AfrIA Recruit Candidate OS`.

**Spec:** `apps/afria-recruit/docs/verified-learning-credential-intelligence-engine.md`

## Global Constraints

- Canonical asset remains `PRD-RECRUIT-001`; no standalone product is created.
- Work stays on `feat/afria-recruit-ats-readiness-p0`; do not merge to `main` in this sprint.
- No production candidate PII or real credential identifiers in fixtures.
- No item may be called a free certification unless both learning cost and credential cost are verified at zero.
- Missing primary evidence, country exclusion, language mismatch, misleading free-certification claims, unverified required assessment, or no target-gap closure must fail closed.
- Recommendation scores are published only when `eligibilityGate = PASS` and evidence references are non-empty.
- High-impact employment decisions remain human-reviewed; this engine recommends learning pathways only.
- Passing unit/CI gates is M6 core evidence, not S7+, M8, Big4, production, or commercial proof.

---

### Task 1: Automate AR-LCI-001 and prove RED

**Files:**
- Create: `apps/afria-recruit/tests/unit/learning-credential-intelligence.test.ts`

**Interfaces:**
- Consumes future exports from `../../lib/domain/learning-credential-intelligence.js`.
- Produces the executable contract for classification, hard gates, ranking, credential completion, and employability delta.

- [ ] **Step 1: Add the failing test contract**

The test file must import:

```ts
import {
  applyVerifiedCredentialCompletion,
  classifyLearningOpportunity,
  computeEmployabilityDelta,
  evaluateLearningOpportunity,
  normalizeSkillToken,
  rankLearningOpportunities,
  type CandidateLearningContext,
  type LearningOpportunity,
} from '../../lib/domain/learning-credential-intelligence.js';
```

It must prove at least these behaviors:

```ts
assert.equal(classifyLearningOpportunity(disasterReady), 'FREE_CERTIFIED');
assert.equal(classifyLearningOpportunity(edxAudit), 'FREE_LEARNING_PAID_CREDENTIAL');
assert.equal(evaluateLearningOpportunity(kayaRestricted, maliCandidate).eligibilityGate, 'FAIL');
assert.equal(evaluateLearningOpportunity(unverifiedClaim, maliCandidate).recommendationScore, null);
assert.equal(normalizeSkillToken('Fleet Management'), 'fleet');
assert.equal(rankLearningOpportunities(opportunities, maliCandidate)[0].opportunityId, 'disasterready-procurement-logistics');
```

Credential completion must require a verified completion evidence reference and return credential-evidenced skill state; employability delta must be deterministic:

```ts
assert.deepEqual(computeEmployabilityDelta(67, 84), { before: 67, after: 84, delta: 17 });
```

- [ ] **Step 2: Push the RED test-only commit**

Expected GitHub Actions result: `Run unit tests` fails because `learning-credential-intelligence` does not yet exist. The failure must be isolated to the new contract, matching the repository's previous RED compile-cycle convention.

- [ ] **Step 3: Record the failed workflow run ID as TDD evidence**

Do not write production code until the failed run is observed.

---

### Task 2: Implement the deterministic domain core and prove GREEN

**Files:**
- Create: `apps/afria-recruit/lib/domain/learning-credential-intelligence.ts`
- Test: `apps/afria-recruit/tests/unit/learning-credential-intelligence.test.ts`

**Interfaces:**
- Produces `normalizeSkillToken(value: string): string`.
- Produces `classifyLearningOpportunity(opportunity: LearningOpportunity): LearningClassification`.
- Produces `evaluateLearningOpportunity(opportunity: LearningOpportunity, context: CandidateLearningContext): LearningEvaluation`.
- Produces `rankLearningOpportunities(opportunities: LearningOpportunity[], context: CandidateLearningContext): LearningEvaluation[]`.
- Produces `applyVerifiedCredentialCompletion(currentSkills: CandidateSkillEvidence[], opportunity: LearningOpportunity, completion: CredentialCompletion): CandidateSkillEvidence[]`.
- Produces `computeEmployabilityDelta(before: number, after: number): EmployabilityDelta`.

- [ ] **Step 1: Implement canonical types**

Use these exact public states:

```ts
export type LearningClassification =
  | 'FREE_CERTIFIED'
  | 'FREE_CERTIFIED_RESTRICTED'
  | 'FREE_LEARNING_PAID_CREDENTIAL'
  | 'PAID_CERTIFIED'
  | 'FREE_LEARNING_NO_CREDENTIAL'
  | 'SPECIALIZED_CERTIFIED'
  | 'UNVERIFIED_CREDENTIAL'
  | 'INELIGIBLE';

export type EligibilityGate = 'PASS' | 'FAIL' | 'REVIEW';
export type RecommendationDecision = 'PRIORITY' | 'ELIGIBLE' | 'REVIEW' | 'REJECTED';
```

`LearningOpportunity` must carry provider/title/source, country and language eligibility, sectors, skills, duration, verified learning/credential costs, assessment flags, issuer, evidence refs, verification status, misleading claim score, optional `advertisedAsFreeCertification`, and optional `specialized`.

- [ ] **Step 2: Implement deterministic skill normalization**

Normalize case, accents, punctuation and whitespace, with a minimal alias map required by AR-LCI-001:

```ts
'fleet management' -> 'fleet'
'warehouse' -> 'warehousing'
'warehouse management' -> 'warehousing'
'asset management' -> 'asset management'
'procurement' -> 'procurement'
```

Do not infer unrelated skills.

- [ ] **Step 3: Implement classification**

Classification must depend only on verified material facts. Examples:

```ts
learning=0 verified + credential=0 verified + credential available -> FREE_CERTIFIED
same with explicit country restriction -> FREE_CERTIFIED_RESTRICTED
learning=0 verified + credential>0 verified -> FREE_LEARNING_PAID_CREDENTIAL
learning=0 verified + no credential -> FREE_LEARNING_NO_CREDENTIAL
paid learning + credential available -> PAID_CERTIFIED
specialized verified credential -> SPECIALIZED_CERTIFIED
missing material verification/evidence -> UNVERIFIED_CREDENTIAL
```

- [ ] **Step 4: Implement hard gates and explainable score**

`evaluateLearningOpportunity()` must return classification, `eligibilityGate`, `decision`, `closedSkills`, `blockingReasons`, `evidenceRefs`, `recommendationScore: number | null`, and an explanation string.

Fail closed for: missing material evidence, country mismatch, language mismatch, misleading free-certification claim, required assessment not verified, or zero target-gap closure. Specialized sector mismatch fails ranking eligibility.

For PASS only, compute a deterministic 0–100 score using:

```text
gap closure 0..45
credential verification 0..20
language fit 10
country fit 10
zero/low monetary cost 0..5
short duration 0..5
misleading-risk penalty 0..5
```

Clamp to 0..100. `PRIORITY >= 75`, otherwise `ELIGIBLE`.

- [ ] **Step 5: Implement ranking**

Evaluate all opportunities and sort PASS rows by score descending, then REVIEW, then FAIL. Never publish a numeric score for FAIL/REVIEW rows.

- [ ] **Step 6: Implement verified credential completion and employability delta**

Completion must reject missing evidence, unverified completion, or a course without a credential. It returns a new immutable skill list with the opportunity's normalized taught skills as `credential-evidenced` and the credential evidence reference attached.

`computeEmployabilityDelta()` validates both scores are finite and within 0..100, then returns `{ before, after, delta: after - before }`.

- [ ] **Step 7: Push GREEN implementation commit**

Expected GitHub Actions: unit tests, typecheck, production build, Playwright, source scan and build scan all PASS.

---

### Task 3: Close M6 evidence without overstating release status

**Files:**
- Modify: `apps/afria-recruit/docs/evidence-matrix.md`
- Modify: `apps/afria-recruit/docs/release-verification.md`
- Modify: `apps/afria-recruit/docs/verified-learning-credential-intelligence-engine.md`

**Interfaces:**
- Consumes the observed RED and GREEN workflow run IDs/SHAs.
- Produces an auditable M6 core checkpoint under `PRD-RECRUIT-001`.

- [ ] **Step 1: Record RED/GREEN proof**

Add the test file, implementation file, RED run/commit and GREEN run/commit.

- [ ] **Step 2: Update capability status**

If and only if the complete Candidate OS workflow is GREEN, change runtime status from `NOT YET M6-PROVEN` to `M6 CORE TEST_PROVEN` while preserving `HOLD S7+/M8/PRODUCTION`.

- [ ] **Step 3: Mirror the checkpoint into Notion**

Update the canonical AfrIA Recruit™ page with the exact commit SHA, GitHub Actions run, automated behaviors proven, and remaining boundaries.
