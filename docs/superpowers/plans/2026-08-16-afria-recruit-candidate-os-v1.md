# AfrIA Recruit™ Candidate OS v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/afria-recruit/` as the canonical operational AfrIA Recruit™ Candidate OS and prove one synthetic end-to-end flow from Talent Passport/CV facts through evidence-safe optimization, interview practice, human approval and Career CRM outcome tracking.

**Architecture:** Create a dedicated Next.js 16 application that reads the existing AfrIA Recruit™ Supabase schema through candidate-scoped RLS and performs privileged AI/audit writes only through server routes that first validate the authenticated user and candidate ownership. Reuse existing canonical tables instead of introducing new DDL in this slice: Talent Passport is composed from `candidates` plus candidate fact tables and `verifications`; target vacancies use `jobs` plus job requirement tables; structured generated artifacts live as versioned `ai_decisions`; review uses `human_reviews`; practice interviews use `ai_interviews` and private `interview_responses`; application/outcome tracking uses `applications` and `application_events`.

**Tech Stack:** Next.js `16.3.0`, React `19.2.4`, TypeScript `^5.7.2`, Node.js 24 CI, `@supabase/supabase-js` `^2.112.2`, Playwright `^1.62.1`, native Node test runner after TypeScript test compilation, CSS Modules/global CSS without a new UI framework.

## Global Constraints

- Canonical product remains `PRD-RECRUIT-001`; this work does not create another product.
- Canonical operational path is exactly `apps/afria-recruit/`.
- Do not modify `apps/web/` (GDIZ) or convert `apps/afria-recruit-investor-demo/` into an operational app.
- No production candidate PII in source control, fixtures, screenshots, logs or public artifacts.
- No direct browser access to `SUPABASE_SERVICE_ROLE_KEY`; service role is server-only.
- Every privileged server write must first prove the caller with `supabase.auth.getUser(accessToken)` and prove candidate ownership through a user-token/RLS read.
- Extracted facts remain declared/unverified until evidence status or `verifications` proves otherwise.
- No vacancy keyword becomes a candidate claim without candidate evidence.
- No fabricated metric in XYZ/STAR/CAR rewrites.
- Human approval is mandatory before application package creation.
- Automatic application submission remains disabled.
- No universal ATS certification or guaranteed interview/employment claim.
- No new database DDL in this first slice unless a later review proves an existing semantic gap that cannot be represented safely by existing canonical tables.
- OpenAI/provider integration is optional at runtime; missing provider configuration must fall back to a deterministic, truth-preserving local adapter rather than breaking the product.
- M6/S7+/M8 and independent external review remain separate release gates; passing this plan does not equal production/commercial approval.

---

## Existing schema mapping — KEEP before CREATE

| Candidate OS concept | Existing canonical storage |
|---|---|
| Candidate identity/profile | `candidates`, `user_profiles`, `private.candidate_private` |
| Talent Passport facts | `candidate_experiences`, `candidate_educations`, `candidate_skills`, `candidate_languages`, `candidate_certifications`, `candidate_preferences` |
| Source CV/document | `candidate_documents` |
| Evidence / verification | fact-level `claim_status` / `evidence_status` + `verifications` |
| Consent | `consents` |
| JobSpec | `jobs`, `job_skills`, `job_languages`, `job_locations`, `job_sources` |
| Explainable gap/matching evidence | `candidate_job_matches`, `match_explanations`, `match_runs` when a canonical job exists; local deterministic coverage output before persistence |
| Diagnostic / rewrite / structured AI artifacts | `ai_decisions` with versioned `decision_type`, `input_hash`, `output`, `prompt_version`, `human_review_required` |
| Human approval | `human_reviews` linked to `ai_decisions` or match |
| Practice interview | `ai_interviews`, `private.interview_responses`, `evaluation_scores` |
| Application package | `applications` with `source='candidate'`; no auto-submit |
| Career CRM outcome | `application_events`; confirmed placement remains separate in `placements` |

---

### Task 1: Scaffold the canonical operational application and CI contract

**Files:**
- Create: `apps/afria-recruit/package.json`
- Create: `apps/afria-recruit/package-lock.json`
- Create: `apps/afria-recruit/tsconfig.json`
- Create: `apps/afria-recruit/tsconfig.test.json`
- Create: `apps/afria-recruit/next.config.ts`
- Create: `apps/afria-recruit/next-env.d.ts`
- Create: `apps/afria-recruit/.env.example`
- Create: `apps/afria-recruit/app/layout.tsx`
- Create: `apps/afria-recruit/app/globals.css`
- Create: `apps/afria-recruit/app/page.tsx`
- Create: `apps/afria-recruit/README.md`
- Create: `apps/afria-recruit/scripts/scan-build.mjs`
- Create: `.github/workflows/afria-recruit-candidate-os.yml`
- Test: `apps/afria-recruit/tests/unit/scaffold.test.ts`

**Interfaces:**
- Produces: a standalone buildable Next.js app with scripts `test:unit`, `typecheck`, `build`, `test:e2e`, `scan:build`, `check`.
- Consumes: no product code from the investor demo or GDIZ app.

- [ ] **Step 1: Write the failing scaffold contract test**

Create `tests/unit/scaffold.test.ts` that reads `package.json`, `.env.example`, and source files and asserts:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);

test('canonical app has safe scripts and no browser service-role variable', async () => {
  const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  assert.equal(pkg.name, 'afria-recruit');
  assert.match(pkg.scripts.check, /test:unit/);
  assert.match(pkg.scripts.check, /typecheck/);
  assert.match(pkg.scripts.check, /build/);
  const env = await readFile(new URL('.env.example', root), 'utf8');
  assert.doesNotMatch(env, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE/i);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run from `apps/afria-recruit/` after the minimal test compiler is present:

```bash
npm run test:unit
```

Expected: FAIL because the scaffold files do not yet exist or do not satisfy the contract.

- [ ] **Step 3: Implement the minimal Next.js scaffold**

Use repository-aligned versions:

```json
{
  "name": "afria-recruit",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": ">=24 <25" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "next typegen && tsc --noEmit",
    "test:compile": "tsc -p tsconfig.test.json",
    "test:unit": "npm run test:compile && node --test .test-dist/tests/unit/*.test.js",
    "test:e2e": "playwright test",
    "scan:build": "node scripts/scan-build.mjs .next",
    "check": "npm run test:unit && npm run typecheck && npm run build && npm run scan:build"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.112.2",
    "next": "16.3.0",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@playwright/test": "^1.62.1",
    "@types/node": "^22.10.1",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "typescript": "^5.7.2"
  }
}
```

`.env.example` must contain names only, never values:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
AFRIA_RECRUIT_AI_PROVIDER=
AFRIA_RECRUIT_E2E_MODE=
```

- [ ] **Step 4: Add the release workflow**

The workflow must use Node 24, `npm ci --ignore-scripts`, `npm audit --audit-level=high`, unit tests, typecheck, build, Playwright and build scan. Reuse the repository's pinned checkout/setup-node action SHAs rather than floating action tags.

- [ ] **Step 5: Run the full local scaffold check**

```bash
npm ci --ignore-scripts
npm audit --audit-level=high
npm run test:unit
npm run typecheck
npm run build
npm run scan:build
```

Expected: all PASS; no secrets or source maps in `.next/static` public assets.

- [ ] **Step 6: Commit**

```bash
git add apps/afria-recruit .github/workflows/afria-recruit-candidate-os.yml
git commit -m "feat(afria-recruit): scaffold canonical Candidate OS app"
```

---

### Task 2: Freeze live database types and build the authenticated repository boundary

**Files:**
- Create: `apps/afria-recruit/lib/supabase/database.types.ts`
- Create: `apps/afria-recruit/lib/supabase/config.ts`
- Create: `apps/afria-recruit/lib/supabase/user-client.ts`
- Create: `apps/afria-recruit/lib/supabase/admin-client.ts`
- Create: `apps/afria-recruit/lib/auth/authenticated-user.ts`
- Create: `apps/afria-recruit/lib/repositories/candidate-context.ts`
- Create: `apps/afria-recruit/lib/repositories/live-candidate-repository.ts`
- Create: `apps/afria-recruit/lib/repositories/fixture-candidate-repository.ts`
- Test: `apps/afria-recruit/tests/unit/auth-boundary.test.ts`
- Test: `apps/afria-recruit/tests/unit/repository-contract.test.ts`

**Interfaces:**
- Produces: `AuthenticatedUser`, `CandidateContext`, `CandidateRepository`.
- Produces: `requireAuthenticatedCandidate(request): Promise<{ user; candidate; userClient; adminClient }>`.
- Consumes: generated Supabase `Database` types from the live canonical project.

- [ ] **Step 1: Commit generated database types from the canonical Supabase project**

Generate types with the Supabase tool/CLI and store the exact output in `lib/supabase/database.types.ts`. The file must include existing `candidates`, fact tables, `jobs`, `ai_decisions`, `ai_interviews`, `applications`, `application_events`, `human_reviews`, `verifications` and relationships.

- [ ] **Step 2: Write failing auth-boundary tests**

Tests must prove:

```ts
await assert.rejects(() => requireAuthenticatedCandidate(fakeRequestWithoutBearer), /authentication required/i);
await assert.rejects(() => requireAuthenticatedCandidate(requestForUserWithoutCandidate), /candidate profile required/i);
```

and prove `admin-client.ts` throws at construction when `SUPABASE_SERVICE_ROLE_KEY` is missing rather than falling back to a public key.

- [ ] **Step 3: Implement token validation and ownership proof**

`authenticated-user.ts` must:

1. read `Authorization: Bearer <access-token>`;
2. call a public Supabase client `auth.getUser(token)`;
3. create a second client carrying the user's bearer token;
4. select the candidate by `user_id = authenticatedUser.id` through RLS;
5. only after that succeeds, construct the server-only admin client.

Never accept `candidate_id` supplied by the browser as ownership proof.

- [ ] **Step 4: Implement CandidateRepository**

`CandidateContext` contains only the fields needed by the optimizer:

```ts
export interface CandidateContext {
  candidate: CandidateSummary;
  experiences: ExperienceFact[];
  educations: EducationFact[];
  skills: SkillFact[];
  languages: LanguageFact[];
  certifications: CertificationFact[];
  preferences: CandidatePreferences | null;
  verifications: VerificationFact[];
  documents: CandidateDocumentSummary[];
}
```

`LiveCandidateRepository.loadContext(candidateId)` reads only RLS-allowed candidate tables. `FixtureCandidateRepository` returns synthetic FR/EN fixtures and is selected only when `AFRIA_RECRUIT_E2E_MODE=1` **and** `CI=true`.

- [ ] **Step 5: Run tests and typecheck**

```bash
npm run test:unit
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/afria-recruit/lib apps/afria-recruit/tests/unit
git commit -m "feat(afria-recruit): add authenticated candidate repository boundary"
```

---

### Task 3: Implement truth-preserving domain engines before any AI call

**Files:**
- Create: `apps/afria-recruit/lib/domain/types.ts`
- Create: `apps/afria-recruit/lib/domain/evidence.ts`
- Create: `apps/afria-recruit/lib/domain/cv-diagnostic.ts`
- Create: `apps/afria-recruit/lib/domain/job-spec.ts`
- Create: `apps/afria-recruit/lib/domain/gap-matching.ts`
- Create: `apps/afria-recruit/lib/domain/truth-consistency.ts`
- Create: `apps/afria-recruit/lib/domain/achievement-writer.ts`
- Create: `apps/afria-recruit/lib/domain/metrics.ts`
- Create: `apps/afria-recruit/tests/fixtures/candidate-humanitarian-fr.ts`
- Create: `apps/afria-recruit/tests/fixtures/candidate-tech-en.ts`
- Create: `apps/afria-recruit/tests/fixtures/job-finance-fr.ts`
- Test: `apps/afria-recruit/tests/unit/domain.test.ts`

**Interfaces:**
- Produces: `diagnoseCv(context)`, `buildJobSpec(job)`, `classifyRequirementCoverage(context, jobSpec)`, `findTruthConflicts(context)`, `rewriteAchievement(input)`, `calculateObservedMetrics(events)`.
- Consumes: normalized `CandidateContext` and existing job data.

- [ ] **Step 1: Write RED tests for the core invariants**

At minimum:

```ts
test('extracted candidate claim stays DECLARED', ...);
test('unsupported vacancy keyword never becomes a candidate claim', ...);
test('qualitative achievement is never converted into an invented percentage', ...);
test('chronology contradiction is blocking', ...);
test('fixed fixtures produce deterministic COVERED PARTIAL GAP classifications', ...);
test('unconfirmed outcomes are excluded from conversion metrics', ...);
```

- [ ] **Step 2: Implement evidence normalization**

Map canonical statuses to three product levels without upgrading them:

```ts
export type EvidenceLevel = 'DECLARED' | 'EVIDENCED' | 'VERIFIED';

export function normalizeEvidenceLevel(status: string): EvidenceLevel {
  if (status.toLowerCase() === 'verified') return 'VERIFIED';
  if (['evidenced', 'supported', 'documented'].includes(status.toLowerCase())) return 'EVIDENCED';
  return 'DECLARED';
}
```

- [ ] **Step 3: Implement deterministic CV diagnostic**

Return findings with `severity`, `code`, `message`, `evidenceRefs`, and `blocking`. Do not return a universal ATS certification. If an internal score is added, its components and denominator must be returned alongside it.

- [ ] **Step 4: Implement gap matching**

Coverage is based on candidate facts and evidence only. `GAP` never generates a new claim. Output:

```ts
export interface RequirementCoverage {
  requirementId: string;
  requirement: string;
  coverage: 'COVERED' | 'PARTIAL' | 'GAP' | 'NOT_APPLICABLE';
  evidenceRefs: string[];
  explanation: string;
}
```

- [ ] **Step 5: Implement truth and achievement rules**

`rewriteAchievement` accepts a source statement plus explicitly supplied factual metrics. If no metric exists, it may improve action/result wording but must not synthesize a number.

- [ ] **Step 6: Run RED→GREEN suite**

```bash
npm run test:unit
npm run typecheck
```

Expected: all domain invariant tests PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/afria-recruit/lib/domain apps/afria-recruit/tests
git commit -m "feat(afria-recruit): add evidence-safe Candidate OS domain engines"
```

---

### Task 4: Add a structured AI adapter with deterministic safe fallback

**Files:**
- Create: `apps/afria-recruit/lib/ai/contracts.ts`
- Create: `apps/afria-recruit/lib/ai/validators.ts`
- Create: `apps/afria-recruit/lib/ai/deterministic-adapter.ts`
- Create: `apps/afria-recruit/lib/ai/openai-adapter.ts`
- Create: `apps/afria-recruit/lib/ai/index.ts`
- Create: `apps/afria-recruit/lib/ai/persist-decision.ts`
- Test: `apps/afria-recruit/tests/unit/ai-adapter.test.ts`

**Interfaces:**
- Produces `CandidateAiAdapter`:

```ts
export interface CandidateAiAdapter {
  diagnose(input: DiagnosticInput): Promise<DiagnosticOutput>;
  analyzeJob(input: JobAnalysisInput): Promise<JobAnalysisOutput>;
  rewrite(input: RewriteInput): Promise<RewriteOutput>;
  interviewTurn(input: InterviewTurnInput): Promise<InterviewTurnOutput>;
}
```

- `getCandidateAiAdapter()` selects OpenAI only when configured; otherwise deterministic adapter.
- `persistValidatedDecision()` writes a validated artifact to `ai_decisions` through admin client after ownership proof has already occurred.

- [ ] **Step 1: Write schema-rejection tests**

Prove malformed provider output is rejected and cannot be persisted as an approved `ai_decisions` artifact.

- [ ] **Step 2: Implement strict manual validators**

Do not add a validation dependency solely for this slice. Validators must reject missing required keys, unknown evidence refs, non-finite scores, fabricated metrics and strings longer than the defined limits.

- [ ] **Step 3: Implement deterministic adapter**

It delegates to Task 3 domain rules and provides predictable outputs for test/absence-of-provider mode.

- [ ] **Step 4: Implement OpenAI adapter server-side**

Before coding, verify the current official OpenAI Responses API documentation. Use native `fetch`, `OPENAI_API_KEY` server-side only, bounded timeout with `AbortSignal.timeout`, one bounded retry for transient 429/5xx responses, and schema validation before returning. Never log prompts containing candidate facts.

- [ ] **Step 5: Persist only validated outputs**

Use `ai_decisions.decision_type` values:

```text
candidate_cv_diagnostic_v1
candidate_job_gap_analysis_v1
candidate_achievement_rewrite_v1
candidate_cv_variants_v1
candidate_interview_feedback_v1
```

Set `human_review_required=true`, store `input_hash`, adapter/model metadata and structured `output`; never mark the artifact as human-approved automatically.

- [ ] **Step 6: Run tests**

```bash
npm run test:unit
npm run typecheck
```

Expected: malformed outputs FAIL closed; deterministic adapter PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/afria-recruit/lib/ai apps/afria-recruit/tests/unit
git commit -m "feat(afria-recruit): add structured AI adapter and safe fallback"
```

---

### Task 5: Build authenticated Candidate OS API routes and persistence orchestration

**Files:**
- Create: `apps/afria-recruit/app/api/candidate/context/route.ts`
- Create: `apps/afria-recruit/app/api/candidate/diagnostic/route.ts`
- Create: `apps/afria-recruit/app/api/candidate/jobs/route.ts`
- Create: `apps/afria-recruit/app/api/candidate/gap-analysis/route.ts`
- Create: `apps/afria-recruit/app/api/candidate/rewrite/route.ts`
- Create: `apps/afria-recruit/app/api/candidate/variants/route.ts`
- Create: `apps/afria-recruit/app/api/candidate/review/route.ts`
- Create: `apps/afria-recruit/lib/http/errors.ts`
- Create: `apps/afria-recruit/lib/services/candidate-optimizer-service.ts`
- Test: `apps/afria-recruit/tests/unit/api-authorization.test.ts`
- Test: `apps/afria-recruit/tests/unit/optimizer-service.test.ts`

**Interfaces:**
- All routes consume bearer authentication.
- All writes derive candidate id from authenticated identity, never from trusted browser input.
- Existing canonical job selection is the fully persisted v1 route; pasted external vacancy may be analyzed ephemerally but cannot create an application package until mapped to a canonical `jobs.id`.

- [ ] **Step 1: Write authorization tests**

Prove unauthenticated requests return `401`, candidate ownership mismatch returns `403`, malformed body returns `400`, provider failure returns a safe `502/503` message without provider/database details.

- [ ] **Step 2: Implement service orchestration**

`CandidateOptimizerService` performs:

```text
load candidate context
→ deterministic truth checks
→ optional structured AI augmentation
→ validate output
→ persist ai_decision
→ return sanitized result
```

- [ ] **Step 3: Implement canonical job listing/selection**

Read open jobs through the user client. A candidate may select an existing `jobs.id`; load `job_skills`, `job_languages`, and `job_locations`. Do not create or edit organizations/jobs from a candidate browser request in this slice.

- [ ] **Step 4: Implement dual CV variant contract**

Store ATS and Human structured variants together in `ai_decisions.output` with a shared fact fingerprint. Verify `factsFingerprint(ats) === factsFingerprint(human)` before persistence. PDF/DOCX download remains disabled until export fidelity is separately proven; the UI can copy/preview text.

- [ ] **Step 5: Implement human review write**

After authenticating candidate ownership, server creates `human_reviews` tied to the relevant `ai_decision`, with `reviewer_id=authenticated user id`, outcome `approved|rejected`, and rationale. A review cannot approve if Task 3 returns any unresolved blocking truth conflict.

- [ ] **Step 6: Run unit/service tests**

```bash
npm run test:unit
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/afria-recruit/app/api apps/afria-recruit/lib/services apps/afria-recruit/lib/http apps/afria-recruit/tests/unit
git commit -m "feat(afria-recruit): add authenticated optimizer API orchestration"
```

---

### Task 6: Build the mobile-first CV Optimizer user flow

**Files:**
- Create: `apps/afria-recruit/app/login/page.tsx`
- Create: `apps/afria-recruit/app/candidate/dashboard/page.tsx`
- Create: `apps/afria-recruit/app/candidate/cv-optimizer/page.tsx`
- Create: `apps/afria-recruit/components/auth/LoginForm.tsx`
- Create: `apps/afria-recruit/components/candidate/CandidateDashboard.tsx`
- Create: `apps/afria-recruit/components/candidate/CvOptimizerFlow.tsx`
- Create: `apps/afria-recruit/components/candidate/DiagnosticPanel.tsx`
- Create: `apps/afria-recruit/components/candidate/GapMatrix.tsx`
- Create: `apps/afria-recruit/components/evidence/EvidenceBadge.tsx`
- Create: `apps/afria-recruit/components/candidate/VariantComparison.tsx`
- Create: `apps/afria-recruit/lib/http/api-client.ts`
- Test: `apps/afria-recruit/tests/e2e/optimizer.spec.ts`

**Interfaces:**
- Primary CTA: `Optimiser mon CV`.
- State machine: `profile_review → diagnostic → job_target → gap_analysis → rewrite → variants → human_review → interview`.

- [ ] **Step 1: Write failing Playwright journey test**

The E2E fixture candidate must prove:

```text
login fixture
→ dashboard
→ click Optimiser mon CV
→ inspect declared facts
→ run diagnostic
→ select canonical synthetic job
→ see COVERED/PARTIAL/GAP rows
→ see unsupported claim blocked
→ generate ATS/Human variants
→ approve review
```

- [ ] **Step 2: Implement accessible login and dashboard**

Production login uses Supabase email/password. CI E2E mode may inject a synthetic authenticated session only when both `CI=true` and `AFRIA_RECRUIT_E2E_MODE=1`; otherwise the test route/session helper must not exist functionally.

- [ ] **Step 3: Implement the optimizer state machine**

Use a single typed reducer/state model rather than implicit DOM state. Every step defines loading, recoverable error, blocking error and review states.

- [ ] **Step 4: Implement evidence-first UI**

Display `DECLARED`, `EVIDENCED`, `VERIFIED` badges. `GAP` rows must say the skill/evidence is missing; never offer a button that silently inserts the claim.

- [ ] **Step 5: Implement dual variant comparison**

Show before/after material changes and fact-evidence references. Human approval button remains disabled while unresolved blocking conflicts exist.

- [ ] **Step 6: Run Playwright and accessibility smoke**

```bash
npm run build
npm run start -- -p 4174 &
npx playwright test tests/e2e/optimizer.spec.ts
```

Also test a `390x844` viewport and keyboard-only progression through the main flow.

- [ ] **Step 7: Commit**

```bash
git add apps/afria-recruit/app apps/afria-recruit/components apps/afria-recruit/lib/http apps/afria-recruit/tests/e2e
git commit -m "feat(afria-recruit): deliver interactive evidence-safe CV optimizer"
```

---

### Task 7: Add Interview Coach, Application Factory handoff and Career CRM outcomes

**Files:**
- Create: `apps/afria-recruit/app/candidate/interview-coach/page.tsx`
- Create: `apps/afria-recruit/app/candidate/applications/page.tsx`
- Create: `apps/afria-recruit/components/interview/InterviewCoach.tsx`
- Create: `apps/afria-recruit/components/candidate/ApplicationPackage.tsx`
- Create: `apps/afria-recruit/components/candidate/OutcomeTracker.tsx`
- Create: `apps/afria-recruit/app/api/candidate/interview/start/route.ts`
- Create: `apps/afria-recruit/app/api/candidate/interview/respond/route.ts`
- Create: `apps/afria-recruit/app/api/candidate/application-package/route.ts`
- Create: `apps/afria-recruit/app/api/candidate/outcome/route.ts`
- Create: `apps/afria-recruit/lib/services/interview-service.ts`
- Create: `apps/afria-recruit/lib/services/application-service.ts`
- Test: `apps/afria-recruit/tests/unit/interview-application.test.ts`
- Test: `apps/afria-recruit/tests/e2e/candidate-loop.spec.ts`

**Interfaces:**
- `InterviewService.start(candidate, job, consent)` writes `ai_interviews` server-side after auth/ownership and practice consent.
- `InterviewService.respond(...)` writes private interview response and validated feedback; raw answer never enters analytics.
- `ApplicationService.createPackage(...)` requires approved `human_reviews` and canonical `job_id`; creates `applications` with candidate source but does **not** submit externally.
- `ApplicationService.recordOutcome(...)` writes `application_events`; candidate-reported outcomes default to unconfirmed metadata until evidence/confirmation exists.

- [ ] **Step 1: Write RED tests for review gate and auto-submit prohibition**

Prove package creation fails without an approved human review and that no code path invokes an external job submission URL.

- [ ] **Step 2: Implement practice consent and interview session**

Use `consents` with purpose `interview_practice`, candidate-only scope and an explicit policy version. Start `ai_interviews` with provider/model/prompt metadata. Persist question/answer content only in private interview storage/tables.

- [ ] **Step 3: Implement contextual interview feedback**

Questions use canonical job requirements plus country/sector/organization context available from the job and candidate profile. Feedback dimensions: clarity, relevance, evidence, gaps. Never claim exact employer-question prediction.

- [ ] **Step 4: Implement application package**

Require:

```text
canonical job id
+ candidate ownership
+ approved CV variants ai_decision
+ approved human review
+ candidate consent where required
```

Create `applications` with a pre-submission status and `source='candidate'`. Do not set `applied_at`; no external POST/send action exists.

- [ ] **Step 5: Implement Career CRM outcome recording**

Write application events for `rejected`, `interview`, `offer`, `hired`. Store candidate-reported confirmation state in metadata. Metrics code includes only confirmed events.

- [ ] **Step 6: Extend E2E through the full synthetic loop**

Prove:

```text
approved variants
→ practice interview question
→ candidate answer
→ contextual feedback
→ application package created
→ no auto-submit
→ synthetic interview outcome recorded
```

- [ ] **Step 7: Run tests**

```bash
npm run test:unit
npm run typecheck
npm run build
npm run test:e2e
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/afria-recruit
git commit -m "feat(afria-recruit): close Candidate OS interview and application loop"
```

---

### Task 8: Security, privacy, bundle and regression gates

**Files:**
- Modify: `apps/afria-recruit/scripts/scan-build.mjs`
- Create: `apps/afria-recruit/scripts/scan-source.mjs`
- Create: `apps/afria-recruit/tests/unit/privacy-contract.test.ts`
- Create: `apps/afria-recruit/tests/e2e/security.spec.ts`
- Modify: `.github/workflows/afria-recruit-candidate-os.yml`
- Modify only if required for path coverage: `.github/dependabot.yml`

**Interfaces:**
- Produces a CI verdict for code quality/security, not a production-readiness claim.

- [ ] **Step 1: Add privacy and secret RED tests**

Scan source, fixtures and built browser chunks for:

```text
SUPABASE_SERVICE_ROLE_KEY value patterns
OPENAI_API_KEY values
sk-proj-
service_role
real-looking personal emails/phone numbers in fixtures
raw provider/database stack traces
sourceMappingURL in public JS
```

The literal env variable name may exist in server source; its value or browser exposure may not.

- [ ] **Step 2: Add server-only boundary assertions**

Tests must fail if `admin-client.ts` is imported from a file containing `'use client'`, or if client components reference `SUPABASE_SERVICE_ROLE_KEY` / `OPENAI_API_KEY`.

- [ ] **Step 3: Add E2E safe-failure cases**

Prove invalid CV/profile input, malformed job selection, AI timeout simulation and unauthorized request show safe user messages without backend/provider internals.

- [ ] **Step 4: Add CI release gates**

Final workflow order:

```text
checkout immutable revision
→ setup Node 24
→ npm ci --ignore-scripts
→ npm audit --audit-level=high
→ npm run test:unit
→ npm run typecheck
→ npm run build
→ install Playwright Chromium
→ npm run test:e2e
→ npm run scan:source
→ npm run scan:build
```

- [ ] **Step 5: Run final local verification**

```bash
npm ci --ignore-scripts
npm audit --audit-level=high
npm run test:unit
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
npm run scan:source
npm run scan:build
```

Expected: all PASS, zero high/critical audit findings, no secret/PII scan finding.

- [ ] **Step 6: Commit**

```bash
git add apps/afria-recruit .github
git commit -m "test(afria-recruit): enforce Candidate OS security and release gates"
```

---

### Task 9: Canonical documentation, evidence matrix and governance handoff

**Files:**
- Modify: `apps/afria-recruit/README.md`
- Create: `apps/afria-recruit/docs/evidence-matrix.md`
- Create: `apps/afria-recruit/docs/release-verification.md`
- Modify: `docs/superpowers/specs/2026-08-16-afria-recruit-candidate-os-v1-design.md` only to add implementation references, not to rewrite approved design.
- Modify: `docs/superpowers/plans/2026-08-16-afria-recruit-candidate-os-v1.md` to mark completed tasks.

**Interfaces:**
- Produces a traceable mapping from spec requirement → code/test → evidence.

- [ ] **Step 1: Build evidence matrix**

For every Definition of Done item, record:

```text
requirement
implementation file(s)
test name(s)
CI run URL/ID
status PASS/FAIL/NOT-YET-GATED
```

- [ ] **Step 2: Document exact truth status**

Use only these kinds of claims after evidence exists:

```text
unit tests green
production build green
browser flow proven on synthetic fixtures
security scans green
```

Do not claim production deployment, M8 final approval, Big4 certification, real candidate conversion uplift or commercial performance.

- [ ] **Step 3: Run final verification again after documentation changes**

```bash
npm run check
npm run test:e2e
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/afria-recruit/docs apps/afria-recruit/README.md docs/superpowers
git commit -m "docs(afria-recruit): record Candidate OS v1 verification evidence"
```

---

## Plan self-review

### Spec coverage

- Canonical `apps/afria-recruit/` operational boundary: Task 1.
- Existing Talent Passport reuse and authentication/RLS boundary: Task 2.
- CV diagnostic, JobSpec coverage, Evidence Verifier, Truth Check, Achievement Writer: Task 3.
- Structured AI, safe fallback and validation: Task 4.
- Versioned persistence and human approval: Task 5.
- Mobile Candidate OS UX and dual CV variants: Task 6.
- Interview Coach, Application Factory and Career CRM loop: Task 7.
- Security/privacy/accessibility/release gates: Task 8.
- Traceability and governance handoff: Task 9.

### Deliberate scope refinement

The approved spec allowed additive database objects only when existing semantics do not match. Live schema inspection on 2026-08-16 confirmed the required first-slice semantics already exist across canonical tables. Therefore this plan deliberately introduces **no DDL** in the first slice. A future schema change requires a separate migration review after the repository's historical schema reproducibility is restored.

### Placeholder scan

No TBD/TODO/“implement later” placeholders remain. Optional external-provider runtime configuration has an explicit deterministic fallback and does not block the synthetic vertical slice.

### Type/interface consistency

`CandidateContext` feeds all domain engines and the AI adapter. `ai_decisions` is the single versioned artifact store for diagnostic/gap/rewrite/variant/feedback outputs. `human_reviews` gates package creation. `applications`/`application_events` close the Career CRM loop. No duplicate CV-builder or interview product is introduced.
