# AfrIA Recruit™ — Four Experts Delta Design

Date: 2026-08-17
Status: CEO-approved design baseline; implementation not yet started
Parent product: PRD-RECRUIT-001 — AfrIA Recruit™
Canonical technical baseline: PR #35 head `f334f858ad1b69b78123d487fde716e60822fc00`
Canonical app: `apps/afria-recruit/`

## 1. Decision

The “4 experts” signal is absorbed as an additive Candidate OS™ experience, not a new product, layer, engine, or standalone agent suite.

Visible UX personas:
1. CV Diagnostician
2. Recruiter Lens
3. Achievement Writer™
4. Interview Simulator

They reuse the existing governed flow:

`Talent Passport™ → CV Diagnostic → JobSpec → Gap Matching → Truth/Evidence → Achievement Writer™ → ATS/Human variants → Human Review → Interview Coach™ → Application Factory™ → Career CRM™ → Outcome Events`

No capability may bypass the existing truth, consent, RLS, human-review, audit, or release gates.

## 2. Current code surfaces to extend

Existing UI and API surfaces already provide the correct seams:

- `components/candidate/CvOptimizerFlow.tsx`
- `components/candidate/DiagnosticPanel.tsx`
- `components/candidate/GapMatrix.tsx`
- `components/candidate/VariantComparison.tsx`
- `components/interview/*`
- `components/evidence/*`
- `/api/candidate/diagnostic`
- `/api/candidate/gap-analysis`
- `/api/candidate/rewrite`
- `/api/candidate/interview/start`
- `/api/candidate/interview/respond`
- `/api/candidate/outcome`
- `lib/http/api-client.ts`
- `lib/domain/types.ts`
- `lib/repositories/candidate-context.ts`

The current application already enforces explicit external-processing consent before rewrite, keeps unsupported vacancy requirements as GAP, and requires human validation before the application package stage. Those invariants remain unchanged.

## 3. Alternatives considered

### A. Four independent AI agents
Rejected.

Benefits: easy marketing story and clean persona separation.
Risks: duplicated orchestration, duplicated prompts, extra state, higher privacy surface, inconsistent evidence handling, harder governance.

### B. Four UX personas over one governed Candidate OS pipeline
Selected.

Benefits: fastest delivery; reuses tested code; preserves one evidence graph, one consent model and one outcome loop; lowest regression risk; easiest to commercialize.
Trade-off: personas are experience abstractions, not autonomous services.

### C. New adaptive career orchestrator replacing the existing flow
Deferred.

Benefits: long-term flexibility.
Risks: unnecessary refactor before outcome evidence exists; violates “extend before create”; delays revenue and creates release risk.

## 4. Scope for Turbo P0

### 4.1 Command UX — “Je veux décrocher ce poste”

The candidate starts from one intent rather than selecting tools.

Input:
- target job selected from existing JobSpec inventory in P0;
- Talent Passport™ context from the authenticated candidate session.

Output sequence:
1. diagnostic;
2. recruiter lens;
3. requirement/evidence matrix;
4. targeted evidence questions where a claim can be clarified without inventing facts;
5. achievement rewrite only after consent and candidate confirmation;
6. ATS/Human variants;
7. human review;
8. interview preparation.

P0 does not add arbitrary public-URL job ingestion. That is a later bounded extension because it introduces scraping/provenance/legal variability.

### 4.2 Recruiter Reverse Twin™

This is an explainable decision model, not a claim that AfrIA Recruit knows an employer’s private ATS or hidden hiring algorithm.

For a JobSpec, produce structured dimensions:
- blocking requirements;
- required vs preferred/secondary signals when data exists;
- requirement priority band;
- evidence coverage;
- evidence quality;
- contradiction/risk flags;
- likely recruiter questions derived from GAP/PARTIAL rows;
- explicit “do not claim” items.

Initial data contract:

```ts
export interface RecruiterLensItem {
  requirementId: string;
  requirement: string;
  priority: 'BLOCKING' | 'HIGH' | 'MEDIUM';
  coverage: 'COVERED' | 'PARTIAL' | 'GAP' | 'NOT_APPLICABLE';
  evidenceRefs: string[];
  riskFlags: string[];
  likelyQuestions: string[];
  doNotClaim: string[];
}
```

P0 should derive this deterministically from JobSpec + RequirementCoverage + existing evidence status wherever possible. External-model enrichment is optional and must be schema-validated and consent-gated if candidate text is sent externally.

### 4.3 Evidence Elicitation™

Purpose: ask for missing factual context before rewriting an achievement.

For a selected experience and target JobSpec, the system may ask bounded questions such as:
- scope/volume;
- team size;
- geography;
- duration;
- asset/budget only if the candidate actually knows it;
- observed outcome;
- evidence source availability.

Rules:
- questions may discover information; they may never synthesize a new fact;
- candidate answer is `DECLARED` by default;
- promotion to `EVIDENCED` or `VERIFIED` requires the existing evidence/verification mechanisms;
- unsupported metrics remain absent from final copy;
- raw elicitation answers must not be persisted in clear text by default in P0;
- the final structured candidate-confirmed claim may be used for the current rewrite only unless an existing repository method safely persists it with provenance.

P0 therefore avoids a new database migration unless inspection proves an existing canonical table cannot represent the necessary structured event. If persistence requires schema work, it becomes an explicit additive migration with RLS, rollback, idempotence and tests.

### 4.4 Achievement Writer™ upgrade

Current rewrite remains the execution surface.

New behavior:
1. show original statement;
2. show evidence state;
3. ask targeted evidence questions if useful;
4. show candidate-confirmed structured facts;
5. request consent;
6. rewrite;
7. show which facts were used;
8. reject any output that introduces unsupported facts or metrics.

The current `rewrite(sourceRef, sourceStatement, jobId, consent)` contract may be extended additively with a structured `confirmedFacts` object. Existing callers must continue to work or be migrated atomically with tests.

### 4.5 Interview Simulator upgrade

P0 uses the existing Interview Coach route and adds recruiter-lens context.

Question generation priority:
1. blocking/partial requirements;
2. contradictions or weak evidence;
3. achievements selected in the generated CV;
4. role-specific behavioral questions.

Feedback labels should include:
- `VAGUE`
- `UNSUPPORTED`
- `CONTRADICTORY`
- `STAR_INCOMPLETE`
- `TOO_LONG`
- `GOOD_EVIDENCE`

Raw practice answers remain non-persistent in clear text.

## 5. P1/P2 boundaries

P1:
- adaptive Interview World Model™ across turns;
- richer recruiter-lens weighting by sector/country/organization type using existing STRATEX contextualization;
- Career Evidence Graph projections using verified outcome history.

P2:
- governed strategy optimization from confirmed outcome events;
- controlled experimentation across CV variants;
- evidence-backed recommendations about which presentation strategies correlate with interviews/offers.

No performance claim is permitted until outcome evidence supports it.

## 6. Data flow

```text
Authenticated Candidate
  → CandidateContext / Talent Passport™
  → Diagnostic
  → JobSpec
  → Gap Analysis
  → Recruiter Lens (deterministic first)
  → Evidence Elicitation questions
  → Candidate-confirmed structured facts
  → Consent gate
  → Achievement Rewrite
  → ATS/Human variants with fact parity
  → Human Review
  → Interview Simulator
  → Application Package (not auto-submitted)
  → Career CRM OutcomeEvent
```

Every downstream representation must preserve provenance back to existing candidate facts/evidence references.

## 7. Security and governance invariants

Must remain true after the delta:

- no invented skill, metric, degree, employer, date or achievement;
- `DECLARED / EVIDENCED / VERIFIED` remain distinct;
- no public candidate PII;
- no bearer token in browser storage;
- HttpOnly/SameSite session behavior unchanged;
- external processing requires auditable consent before provider invocation;
- structured-output schema validation for model output;
- no raw interview or elicitation answer persistence in clear text by default;
- candidate ownership checked before privileged server access;
- no auto-submit;
- no hidden-employer-algorithm claims;
- kill switch/fallback behavior preserved;
- all new write paths RLS-first and least-privilege.

## 8. Error handling

- Safe API errors only; no backend stack/internal identifiers returned to browser.
- If recruiter-lens enrichment fails, fall back to deterministic lens derived from RequirementCoverage.
- If elicitation output fails schema validation, show no generated claim and retain the original statement.
- If external rewrite fails, retain the current deterministic/manual fallback.
- If consent is absent/revoked, block external processing.
- If evidence is revoked, dependent generated content must not be presented as verified.

## 9. Test strategy — TDD first

Before implementation, add failing tests for the following behavior.

### Domain/unit
- `recruiter_lens_never_promotes_gap_test`
- `recruiter_lens_marks_blocking_required_requirement_test`
- `do_not_claim_contains_unsupported_requirement_test`
- `elicitation_question_does_not_create_fact_test`
- `elicited_answer_defaults_to_declared_test`
- `rewrite_rejects_unconfirmed_metric_test`
- `rewrite_uses_only_confirmed_facts_test`
- `revoked_evidence_invalidates_rewrite_context_test`
- `interview_prioritizes_gap_and_partial_test`
- `interview_feedback_flags_unsupported_claim_test`

### API/security
- `recruiter_lens_requires_authenticated_candidate_test`
- `candidate_cannot_request_other_candidate_lens_test`
- `elicitation_external_processing_requires_consent_test`
- `elicitation_raw_answer_not_logged_test`
- `schema_invalid_model_output_is_rejected_test`

### Browser/E2E
- “Je veux décrocher ce poste” happy path on 390×844;
- keyboard-only progression;
- GAP remains visibly GAP after recruiter lens;
- evidence question → candidate confirmation → rewrite;
- no rewrite button enabled before consent;
- interview questions reflect target job gaps;
- no automatic submission is triggered.

Existing 49 unit tests, 8 Playwright tests, typecheck, build, npm audit and privacy/bundle scans must remain green.

## 10. Success criteria

Turbo P0 is complete only if:

1. candidate can enter through one target-job intent flow;
2. recruiter lens is explainable and references evidence/coverage;
3. evidence elicitation cannot create or promote unsupported claims;
4. Achievement Writer uses only candidate-confirmed facts and preserves consent;
5. interview preparation prioritizes actual gaps/weak evidence;
6. ATS/Human fact parity remains intact;
7. existing test/security suite stays green;
8. new tests cover the delta;
9. no production deployment occurs before the existing RLS institution/disclosure, authenticated staging, independent review and M6/S7+/M8 gates.

## 11. Delivery strategy

Use a dedicated delta branch based exactly on PR #35 head. Keep PR #35 unchanged as the reconciled Candidate OS baseline.

Implementation commits should remain small and ordered:
1. tests + domain contracts;
2. deterministic recruiter lens;
3. evidence elicitation service/API;
4. Achievement Writer integration;
5. command UX integration;
6. interview-context upgrade;
7. security/privacy regression checks;
8. full CI evidence.

The delta becomes merge-eligible only after PR #35 baseline is merged or the delta is explicitly retargeted/rebased with equivalent CI evidence.
