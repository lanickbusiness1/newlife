# AfrIA Recruit™ Career Pathway Intelligence™ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic, explainable Career Pathway Intelligence™ core that ranks safe next career actions across jobs and non-job opportunities without weakening Candidate OS truth, consent or RLS invariants.

**Architecture:** Extend `apps/afria-recruit/` with a separate opportunity/eligibility domain instead of overloading `JobSpec`. Eligibility is rule-based and three-state (`ELIGIBLE`, `INELIGIBLE`, `REVIEW_REQUIRED`); progression scoring is deterministic and explainable. The API remains behind the existing authenticated candidate route wrapper, and the first test registry uses official-source fixtures only.

**Tech Stack:** Next.js 16.3.0, React 19.2.4, TypeScript 5.7.x, Node 24, Supabase existing runtime, Node test runner, Playwright 1.62.1.

**Spec:** `docs/superpowers/specs/2026-08-19-afria-recruit-career-pathway-intelligence-design.md`

## Global Constraints

- Extend `PRD-RECRUIT-001`; do not create a new product or framework.
- Preserve `GAP`, `DECLARED / EVIDENCED / VERIFIED`, consent, human review and no-auto-submit invariants.
- Never infer nationality, age, residence or education from unrelated candidate fields.
- Eligibility P0 is deterministic; no external AI call is allowed for eligibility or progression scoring.
- `homeCountry` is not nationality.
- Unknown blocking data produces `REVIEW_REQUIRED`, never `ELIGIBLE`.
- Ineligible opportunities are never recommended as the next action.
- Progression score is a ranking heuristic, not a hiring/admission probability.
- Source provenance and `verifiedAt` are mandatory on every opportunity fixture.
- All new code follows TDD: failing test first, verified red, minimal implementation, verified green.

---

### Task 1: Opportunity and eligibility domain

**Files:**
- Create: `apps/afria-recruit/lib/domain/career-opportunity.ts`
- Create: `apps/afria-recruit/lib/domain/eligibility.ts`
- Test: `apps/afria-recruit/tests/unit/eligibility.test.ts`

**Interfaces:**
- Produces: `CareerOpportunity`, `CandidateEligibilityProfile`, `EligibilityRule`, `EligibilityResult`, `evaluateEligibility(profile, opportunity, now?)`.
- Consumes: no new persistence dependency.

- [ ] **Step 1: Write the failing eligibility tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEligibility } from '../../lib/domain/eligibility.js';
import type { CareerOpportunity, CandidateEligibilityProfile } from '../../lib/domain/career-opportunity.js';

const baseOpportunity: CareerOpportunity = {
  id: 'unv-online-1',
  title: 'Online Volunteer',
  organization: 'UNV',
  kind: 'ONLINE_VOLUNTEERING',
  countryCode: null,
  remote: true,
  sourceUrl: 'https://www.unv.org/become-online-volunteer',
  sourceAuthority: 'OFFICIAL',
  verifiedAt: '2026-08-19T00:00:00.000Z',
  opensAt: null,
  closesAt: null,
  eligibilityRules: [{ id: 'age-18', type: 'MIN_AGE', value: 18, blocking: true }],
  progression: { goalAlignment: 70, evidenceGain: 80, skillGain: 60, futureEligibilityUnlock: 50, networkExposure: 80, immediateFit: 70 },
  burden: { estimatedHours: null, directCostUsd: null },
};

const unknownAge: CandidateEligibilityProfile = {
  candidateId: 'c1', age: null, nationalities: [], residenceCountryCode: null,
  highestEducationLevel: null, yearsExperience: null, languageCodes: [],
};

test('missing blocking candidate data requires review instead of inferred eligibility', () => {
  const result = evaluateEligibility(unknownAge, baseOpportunity, new Date('2026-08-19T00:00:00Z'));
  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.deepEqual(result.missingData, ['age']);
});

test('known conflict with blocking rule is ineligible', () => {
  const result = evaluateEligibility({ ...unknownAge, age: 17 }, baseOpportunity, new Date('2026-08-19T00:00:00Z'));
  assert.equal(result.status, 'INELIGIBLE');
});

test('all blocking rules satisfied is eligible', () => {
  const result = evaluateEligibility({ ...unknownAge, age: 25 }, baseOpportunity, new Date('2026-08-19T00:00:00Z'));
  assert.equal(result.status, 'ELIGIBLE');
});
```

- [ ] **Step 2: Run unit tests and verify RED**

Run from `apps/afria-recruit`:

```bash
npm run test:unit
```

Expected: compile/test failure because `career-opportunity.ts` and `eligibility.ts` do not exist.

- [ ] **Step 3: Implement the minimal domain types**

```ts
export type OpportunityKind =
  | 'JOB' | 'INTERNSHIP' | 'VOLUNTEERING' | 'ONLINE_VOLUNTEERING' | 'FELLOWSHIP'
  | 'YOUNG_PROFESSIONAL_PROGRAM' | 'JPO' | 'GRADUATE_PROGRAM' | 'TRAINEESHIP'
  | 'CONSULTANCY' | 'TALENT_POOL' | 'ROSTER' | 'SCHOLARSHIP' | 'CERTIFICATION' | 'MENTORSHIP';

export type EducationLevel = 'SECONDARY' | 'BACHELOR' | 'MASTER' | 'PHD';
export type EligibilityRule =
  | { id: string; type: 'MIN_AGE' | 'MAX_AGE'; value: number; blocking: boolean }
  | { id: string; type: 'NATIONALITY_IN' | 'RESIDENCE_IN' | 'LANGUAGE_IN'; value: string[]; blocking: boolean }
  | { id: string; type: 'MIN_EDUCATION'; value: EducationLevel; blocking: boolean }
  | { id: string; type: 'MIN_EXPERIENCE_YEARS'; value: number; blocking: boolean }
  | { id: string; type: 'MANUAL_REVIEW'; value: string; blocking: boolean };

export interface CandidateEligibilityProfile {
  candidateId: string;
  age: number | null;
  nationalities: string[];
  residenceCountryCode: string | null;
  highestEducationLevel: EducationLevel | null;
  yearsExperience: number | null;
  languageCodes: string[];
}

export interface CareerOpportunity {
  id: string;
  title: string;
  organization: string;
  kind: OpportunityKind;
  countryCode: string | null;
  remote: boolean;
  sourceUrl: string;
  sourceAuthority: 'OFFICIAL';
  verifiedAt: string;
  opensAt: string | null;
  closesAt: string | null;
  eligibilityRules: EligibilityRule[];
  progression: {
    goalAlignment: number; evidenceGain: number; skillGain: number;
    futureEligibilityUnlock: number; networkExposure: number; immediateFit: number;
  };
  burden: { estimatedHours: number | null; directCostUsd: number | null };
}
```

Implement `evaluateEligibility` with education ordering `SECONDARY < BACHELOR < MASTER < PHD`, exact ISO country/language string comparison, and a 45-day freshness threshold. `MANUAL_REVIEW` or stale source must force `REVIEW_REQUIRED` unless another known blocking conflict already proves `INELIGIBLE`.

- [ ] **Step 4: Run unit tests and verify GREEN**

```bash
npm run test:unit
```

Expected: existing suite plus new eligibility tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/afria-recruit/lib/domain/career-opportunity.ts apps/afria-recruit/lib/domain/eligibility.ts apps/afria-recruit/tests/unit/eligibility.test.ts
git commit -m "feat: add career opportunity eligibility domain"
```

### Task 2: Explainable progression scoring and ranking

**Files:**
- Create: `apps/afria-recruit/lib/domain/career-progression.ts`
- Test: `apps/afria-recruit/tests/unit/career-progression.test.ts`

**Interfaces:**
- Consumes: `CareerOpportunity`, `CandidateEligibilityProfile`, `evaluateEligibility`.
- Produces: `CareerGoal`, `CareerNextAction`, `scoreProgression(opportunity)`, `rankCareerNextActions(goal, opportunities, profile, now?)`.

- [ ] **Step 1: Write failing ranking tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { rankCareerNextActions, SCORE_WEIGHTS } from '../../lib/domain/career-progression.js';

 test('progression weights sum to 100', () => {
  assert.equal(Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0), 100);
});

 test('eligible opportunities rank before review-required and ineligible opportunities', () => {
  const ranked = rankCareerNextActions(goal, [eligibleLow, reviewHigh, ineligibleHigh], profile, new Date('2026-08-19T00:00:00Z'));
  assert.equal(ranked[0].eligibility.status, 'ELIGIBLE');
  assert.equal(ranked.at(-1)?.eligibility.status, 'INELIGIBLE');
});

 test('same inputs produce identical ranking', () => {
  assert.deepEqual(
    rankCareerNextActions(goal, fixtures, profile, now),
    rankCareerNextActions(goal, fixtures, profile, now),
  );
});
```

Use local typed fixtures inside the test file for `goal`, `eligibleLow`, `reviewHigh`, `ineligibleHigh`, `profile`, `fixtures`, and `now`; no external network calls.

- [ ] **Step 2: Run unit tests and verify RED**

```bash
npm run test:unit
```

Expected: failure because `career-progression.ts` does not exist.

- [ ] **Step 3: Implement deterministic score and ordering**

```ts
export const SCORE_WEIGHTS = {
  goalAlignment: 30,
  evidenceGain: 20,
  skillGain: 15,
  futureEligibilityUnlock: 15,
  networkExposure: 10,
  immediateFit: 10,
} as const;
```

`scoreProgression` must clamp each component to 0..100 and return both total and weighted components. `rankCareerNextActions` must order status buckets `ELIGIBLE`, `REVIEW_REQUIRED`, `INELIGIBLE`, then total descending, then `opportunity.id` ascending for deterministic ties. `whyThisNext` is derived only from the two highest weighted positive components; `missingData` comes directly from eligibility.

- [ ] **Step 4: Run unit tests and verify GREEN**

```bash
npm run test:unit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/afria-recruit/lib/domain/career-progression.ts apps/afria-recruit/tests/unit/career-progression.test.ts
git commit -m "feat: rank explainable career next actions"
```

### Task 3: Official-source fixture registry

**Files:**
- Create: `apps/afria-recruit/lib/fixtures/career-opportunities.ts`
- Test: `apps/afria-recruit/tests/unit/career-opportunity-registry.test.ts`

**Interfaces:**
- Produces: `OFFICIAL_CAREER_OPPORTUNITIES` for test/E2E use only.
- Consumes: `CareerOpportunity`.

- [ ] **Step 1: Write failing registry provenance test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFICIAL_CAREER_OPPORTUNITIES } from '../../lib/fixtures/career-opportunities.js';

 test('every fixture has official provenance and verification timestamp', () => {
  assert.ok(OFFICIAL_CAREER_OPPORTUNITIES.length >= 4);
  for (const item of OFFICIAL_CAREER_OPPORTUNITIES) {
    assert.equal(item.sourceAuthority, 'OFFICIAL');
    assert.match(item.sourceUrl, /^https:\/\//);
    assert.ok(Number.isFinite(Date.parse(item.verifiedAt)));
  }
});
```

- [ ] **Step 2: Run unit tests and verify RED**

```bash
npm run test:unit
```

Expected: fixture module missing.

- [ ] **Step 3: Add conservative official-source fixtures**

Include at least:

- UNV on-site generic entry with `MANUAL_REVIEW` because assignment criteria vary;
- UNV Online Volunteering with `MIN_AGE=18` plus manual review for assignment-specific requirements;
- FAO Young Professionals Programme with source-backed `MAX_AGE=32`, `MIN_EDUCATION=MASTER`, `MIN_EXPERIENCE_YEARS=1`, `LANGUAGE_IN=['en']`, plus manual review for vacancy/geographic criteria;
- UNDP JPO generic entry with `MIN_EDUCATION=MASTER`, `MIN_EXPERIENCE_YEARS=2`, plus `MANUAL_REVIEW` for sponsor/nationality/vacancy criteria.

Do not hard-code a universal nationality entitlement for JPO or UN YPP. Programme-specific conditions remain manual review until vacancy-level source data is loaded.

- [ ] **Step 4: Run unit tests and verify GREEN**

```bash
npm run test:unit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/afria-recruit/lib/fixtures/career-opportunities.ts apps/afria-recruit/tests/unit/career-opportunity-registry.test.ts
git commit -m "test: add official career pathway fixtures"
```

### Task 4: Candidate service and authenticated API

**Files:**
- Create: `apps/afria-recruit/lib/services/career-pathway-service.ts`
- Create: `apps/afria-recruit/app/api/candidate/career-pathway/route.ts`
- Modify: `apps/afria-recruit/lib/services/runtime.ts`
- Test: `apps/afria-recruit/tests/unit/career-pathway-service.test.ts`

**Interfaces:**
- Produces: `CareerPathwayService.rankNextActions(input)` and runtime key `careerPathwayService`.
- Consumes: candidate ID from authenticated runtime, explicit `CandidateEligibilityProfile`, fixture registry in E2E only.

- [ ] **Step 1: Write failing service test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { CareerPathwayService } from '../../lib/services/career-pathway-service.js';

 test('service returns ranked actions without mutating application state', async () => {
  const service = new CareerPathwayService({ opportunities });
  const result = await service.rankNextActions({ goal, profile, now });
  assert.ok(result.actions.length > 0);
  assert.equal(result.actions[0].eligibility.status, 'ELIGIBLE');
});
```

The service has no dependency on `ApplicationStore`, `ApplicationEventStore`, AI adapters or service-role clients.

- [ ] **Step 2: Run unit tests and verify RED**

```bash
npm run test:unit
```

Expected: service module missing.

- [ ] **Step 3: Implement service and GET route**

`CareerPathwayService` is a thin deterministic wrapper over `rankCareerNextActions`.

`GET /api/candidate/career-pathway` must use:

```ts
import { createCandidateRoute } from '@/lib/http/errors';
import { createCandidateRuntime } from '@/lib/services/runtime';

export const GET = createCandidateRoute(async (request) => {
  const { auth, careerPathwayService } = await createCandidateRuntime(request);
  const url = new URL(request.url);
  const goalTitle = url.searchParams.get('goal')?.trim();
  if (!goalTitle) return Response.json({ error: 'goal_required' }, { status: 400 });
  return Response.json(await careerPathwayService.rankForCandidate(auth.candidateId, goalTitle));
});
```

If the real `auth` object exposes a differently named candidate identifier, use the exact field already returned by `requireAuthenticatedCandidate`; do not guess or derive it. In production runtime, profile fields that are not present in trusted candidate data remain `null` / empty and therefore produce `REVIEW_REQUIRED`. E2E runtime may inject an explicit synthetic eligibility profile.

- [ ] **Step 4: Run unit tests, typecheck and verify GREEN**

```bash
npm run test:unit
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/afria-recruit/lib/services/career-pathway-service.ts apps/afria-recruit/app/api/candidate/career-pathway/route.ts apps/afria-recruit/lib/services/runtime.ts apps/afria-recruit/tests/unit/career-pathway-service.test.ts
git commit -m "feat: expose authenticated career pathway ranking"
```

### Task 5: Candidate CareerPathwayPanel

**Files:**
- Create: `apps/afria-recruit/components/candidate/CareerPathwayPanel.tsx`
- Modify: `apps/afria-recruit/components/candidate/CandidateDashboard.tsx`
- Modify: `apps/afria-recruit/lib/http/api-client.ts`
- Test: `apps/afria-recruit/tests/e2e/career-pathway.spec.ts`

**Interfaces:**
- Consumes: `GET /api/candidate/career-pathway?goal=...`.
- Produces: goal input, ranked cards, provenance link, score component disclosure, missing-data prompt.

- [ ] **Step 1: Write failing Playwright test**

```ts
import { test, expect } from '@playwright/test';

 test('candidate sees ranked career next actions with provenance and no auto-submit', async ({ page }) => {
  await page.goto('/candidate/dashboard?e2e=1');
  await page.getByLabel('Objectif de carrière').fill('Programme Officer');
  await page.getByRole('button', { name: 'Calculer ma prochaine étape' }).click();
  await expect(page.getByRole('heading', { name: 'Prochaines étapes recommandées' })).toBeVisible();
  await expect(page.getByText('Source officielle')).toBeVisible();
  await expect(page.getByText(/À vérifier|Éligible/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Postuler automatiquement/i })).toHaveCount(0);
});
```

- [ ] **Step 2: Run E2E and verify RED**

```bash
npm run test:e2e -- --grep "career next actions"
```

Expected: failure because the UI does not exist.

- [ ] **Step 3: Implement the smallest accessible panel**

Requirements:

- input label exactly `Objectif de carrière`;
- button exactly `Calculer ma prochaine étape`;
- heading exactly `Prochaines étapes recommandées`;
- status copy `Éligible`, `À vérifier`, `Non éligible`;
- external source link text `Source officielle` with `rel="noreferrer"`;
- score label `Score de progression — heuristique explicable`;
- no auto-apply button, no guaranteed-outcome copy.

Keep the component focused; do not move existing Candidate Dashboard responsibilities.

- [ ] **Step 4: Run E2E and full checks**

```bash
npm run test:e2e -- --grep "career next actions"
npm run check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/afria-recruit/components/candidate/CareerPathwayPanel.tsx apps/afria-recruit/components/candidate/CandidateDashboard.tsx apps/afria-recruit/lib/http/api-client.ts apps/afria-recruit/tests/e2e/career-pathway.spec.ts
git commit -m "feat: add candidate career pathway panel"
```

### Task 6: Security, invariant and release evidence

**Files:**
- Modify: `apps/afria-recruit/docs/evidence-matrix.md`
- Modify: `apps/afria-recruit/docs/release-verification.md`
- Modify: `apps/afria-recruit/scripts/scan-source.mjs` only if the new source URLs or labels trigger an existing scanner false positive.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: auditable evidence for M6/S7+/M8 review.

- [ ] **Step 1: Run complete verification before documentation**

```bash
npm ci --ignore-scripts
npm audit --audit-level=high
npm run test:unit
npm run typecheck
npm run build
npm run test:e2e
npm run scan:source
npm run scan:build
```

Expected: all PASS, audit reports 0 high/critical vulnerabilities.

- [ ] **Step 2: Record exact evidence**

Append a `Career Pathway Intelligence — 2026-08-19` section containing exact test counts, build result, scanner result, and explicit non-claims:

- no production deployment claim;
- no hiring/admission probability claim;
- no universal JPO/YPP eligibility claim;
- no live source-ingestion claim;
- no M8 / Big4 claim until those gates are separately completed.

- [ ] **Step 3: Commit**

```bash
git add apps/afria-recruit/docs/evidence-matrix.md apps/afria-recruit/docs/release-verification.md apps/afria-recruit/scripts/scan-source.mjs
git commit -m "docs: record career pathway verification evidence"
```

- [ ] **Step 4: Push and create a draft stacked PR**

Base: `feat/afria-recruit-four-experts-delta`

Title: `feat: add AfrIA Recruit Career Pathway Intelligence`

The PR body must state that it is stacked on #36, remains draft until #35/#36 baseline gates are resolved, and must not be represented as production-ready until fresh CI, authenticated staging, independent security review, M6/S7+/M8 and explicit release decision are complete.