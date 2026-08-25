# AfrIA Recruit™ Candidate OS v1 Design

**Status:** CEO-approved architecture — implementation not yet authorized by this document alone  
**Canonical product:** AfrIA Recruit™ — `PRD-RECRUIT-001`  
**Canonical application path:** `apps/afria-recruit/`  
**Date:** 2026-08-16

## 1. Goal

Materialize the operational AfrIA Recruit™ application as a dedicated canonical app and deliver one end-to-end Candidate OS vertical slice:

`CV / Talent Passport™ → CV Diagnostic → JobSpec → Recruiter Gap Matching → Evidence Verifier → Truth & Consistency Check → Achievement Writer → CV ATS + CV humain → Interview Coach → Human Approval → Application Factory™ → Career CRM™ outcome tracking`.

The vertical slice must be useful with synthetic fixtures before any production candidate data is introduced.

## 2. Architecture decision

### Chosen approach

Create `apps/afria-recruit/` as the canonical operational application for AfrIA Recruit™.

This is **not a new product**. It is the software container for the already-canonical Living Talent OS™ and its Candidate OS™, Talent Passport™, Opportunity Intelligence™, Explainable Matching™, Application Factory™ and Career CRM™ capabilities.

### Explicit boundaries

- `apps/afria-recruit/` contains authenticated operational candidate/recruiter product flows.
- `apps/afria-recruit-investor-demo/` remains a public, sanitized demonstrator. It must never become the operational Candidate OS or receive production candidate PII.
- `apps/web/` remains owned by GDIZ Smart Service Node and is not reused or renamed for AfrIA Recruit™.
- `supabase/` remains the canonical AfrIA Recruit™ data layer. New database work must be additive, idempotent, RLS-first, tested and reversible.
- Existing public investor release contracts remain unchanged unless a later, separate spec explicitly integrates them.

## 3. Technology baseline

The operational app uses repository-compatible technologies:

- Next.js 16 App Router
- React 19
- TypeScript
- Node.js 24 in CI; application engine floor `>=22`
- Supabase Postgres, Auth, Storage and Row Level Security
- Server-side AI adapter only; no provider secret in browser code
- Structured model outputs validated by schema before persistence
- Playwright for browser proof
- Node test runner or the repository-standard unit-test mechanism for domain tests

No framework migration of existing apps is part of this work.

## 4. Product experience

### 4.1 Entry point

The authenticated Candidate OS dashboard exposes a primary action: **« Optimiser mon CV »**.

The user can begin from either:

1. an existing Talent Passport™ populated with declared facts; or
2. a CV upload that creates draft `DECLARED` facts pending candidate review.

No extracted CV claim is automatically treated as verified.

### 4.2 Stage 1 — CV Diagnostic

The system diagnoses:

- missing or ambiguous sections;
- chronology inconsistencies;
- readability and linear parsing risks;
- unsupported claims;
- weak achievement wording;
- missing evidence for quantified statements;
- ATS-layout hazards in the machine-readable variant.

The UI returns dimension-level findings, not a magical universal ATS score. Any aggregate score shown must be transparently derived from documented local rules and labelled as an internal diagnostic score.

### 4.3 Stage 2 — JobSpec and Recruiter Gap Matching

The candidate pastes or selects a target vacancy. The system creates a versioned `JobSpec` containing role, country, language, required criteria, preferred criteria and provenance.

Requirements are compared against Talent Passport™ facts and classified:

- `COVERED`
- `PARTIAL`
- `GAP`
- `NOT_APPLICABLE`

Keywords from the vacancy may only be used in candidate-facing text when a corresponding candidate fact supports them.

### 4.4 Stage 3 — Evidence Verifier and Truth & Consistency Check

Every candidate claim has an evidence level:

- `DECLARED`: asserted by the candidate or extracted from a candidate-provided document;
- `EVIDENCED`: linked to a supporting source or document;
- `VERIFIED`: supported by source, verifier identity and timestamp.

Truth checks compare dates, employers, titles, education, certifications, languages, skills and quantified achievements across the Talent Passport™, source CV, generated variants and interview answers.

Blocking contradictions must be resolved or explicitly acknowledged before final export. Revoking evidence invalidates dependent approved variants.

### 4.5 Stage 4 — Achievement Writer

The writer proposes stronger bullet points using XYZ, STAR or CAR structures when source facts support the transformation.

Rules:

- reformulation is allowed;
- fabrication is prohibited;
- a missing number stays missing;
- a qualitative result may not be turned into an invented percentage;
- every material rewrite is traceable to its supporting claim(s);
- candidate can accept or reject sensitive changes.

### 4.6 Stage 5 — Dual CV output

Two factual-equivalent variants are produced:

**ATS variant**
- one column;
- standard section titles;
- selectable text;
- no photo, icons, tables, text boxes, headers or footers by default;
- machine-readable ordering;
- PDF and DOCX export only after the corresponding export path is proven.

**Human premium variant**
- richer visual hierarchy is allowed;
- facts and evidence must remain identical to the ATS variant;
- it may never silently introduce claims absent from the ATS/evidence graph.

The candidate sees a before/after diff and evidence coverage before approval.

### 4.7 Stage 6 — Interview Coach

The coach uses the target `JobSpec`, the candidate evidence graph and STRATEX context to conduct a realistic practice interview.

It supports:

- role-specific questions;
- behavioural questions;
- evidence-probing follow-ups;
- contextual questions based on country, sector and organization type;
- candidate answer capture;
- feedback on clarity, relevance, evidence and gaps;
- repeat practice.

It does not claim to predict the exact employer interview and never makes an employment decision.

### 4.8 Stage 7 — Human Approval, Application Factory™ and Career CRM™

Human approval is required before export or application creation.

The first vertical slice may create an approved application package and hand it to Application Factory™, but **automatic submission is disabled**.

Career CRM™ records observed outcomes only:

- `rejected`
- `interview`
- `offer`
- `hired`

Unverified outcome reports remain `unconfirmed` until supported by confirmation or evidence.

## 5. STRATEX contextualization

Optimization is contextualized at minimum by:

- country and jurisdiction;
- target language and locale;
- sector;
- organization type;
- recruitment conventions;
- privacy and disclosure constraints.

STRATEX may alter presentation guidance, question selection and requirement interpretation. It may not weaken truth, consent, evidence or human-review invariants.

## 6. Core domain contracts

The implementation must reuse existing tables/types where semantics already match. Otherwise it may add the following minimal contracts.

### `JobSpec`

- `id`
- `candidate_id`
- `source_url` nullable
- `source_text_hash`
- `captured_at`
- `language`
- `country`
- `role`
- `requirements`
- `preferred_requirements`
- `version`
- `provenance`

### `ClaimEvidence`

- `id`
- `candidate_id`
- `claim_type`
- `claim_value`
- `evidence_level` = `DECLARED | EVIDENCED | VERIFIED`
- `source_ref` nullable
- `verified_by` nullable
- `verified_at` nullable
- `revoked_at` nullable

### `RequirementEvidenceLink`

- `job_spec_id`
- `requirement_id`
- `claim_evidence_id` nullable
- `coverage` = `COVERED | PARTIAL | GAP | NOT_APPLICABLE`
- `explanation`
- `human_review_status`

### `CVVariant`

- `id`
- `candidate_id`
- `job_spec_id`
- `kind` = `ATS | HUMAN`
- `locale`
- `version`
- `content_hash`
- `approval_status`
- `generated_at`
- `invalidated_at` nullable

### `ApplicationApproval`

- `application_id`
- `candidate_id`
- `approver_id`
- `scope`
- `approved_at`
- `revoked_at` nullable

### `InterviewPracticeSession`

- `id`
- `candidate_id`
- `job_spec_id`
- `started_at`
- `completed_at` nullable
- `question_set_version`
- `context_snapshot`
- answer content stored privately and excluded from analytics payloads

### `OutcomeEvent`

- `application_id`
- `type` = `REJECTED | INTERVIEW | OFFER | HIRED`
- `occurred_at`
- `evidence_ref` nullable
- `confirmation_status` = `UNCONFIRMED | CONFIRMED`
- `recorded_by`

## 7. Security and privacy

### Mandatory controls

- Authenticated candidate isolation through RLS.
- Institution users cannot read candidate-private data without an explicit authorized relationship and consent.
- Candidate documents live in private storage; public buckets are prohibited for CVs and evidence.
- Signed URLs are short-lived and scoped if file download is implemented.
- Service-role credentials are server-only and never bundled into browser assets.
- AI prompts containing candidate information are not written to application logs.
- Error messages shown to users never expose raw database, provider or infrastructure details.
- Audit events cover generation, approval, revocation, export and outcome changes.
- Synthetic fixtures only in source control and automated tests.
- Deletion and consent revocation invalidate downstream access where technically applicable.

## 8. AI boundary

The first implementation uses an adapter interface rather than model calls scattered through UI code.

The adapter contract must:

1. accept a minimized structured context;
2. return schema-validated structured output;
3. include prompt/ruleset/model version metadata internally;
4. have bounded timeout and retry behaviour;
5. fail closed into a reviewable manual draft state;
6. never persist a partially validated response as approved content.

Provider choice is configuration, not domain logic. No new provider or model family is authorized without an ADR if it changes privacy, cost or data residency assumptions.

## 9. UX states

Every stage must define:

- empty state;
- loading state;
- recoverable error state;
- blocking validation state;
- success/review state.

The flow is mobile-first, keyboard usable and compatible with reduced-motion preferences. Accessibility smoke tests cover labels, focus order, buttons, dialogs and error announcements.

## 10. Metrics

Only observed events may feed product metrics:

- `parse_success_rate`
- `evidence_coverage_rate`
- `human_approval_rate`
- `application_completion_rate`
- `interview_rate`
- `offer_rate`
- `time_to_interview`
- `interview_practice_completion_rate`

No baseline, uplift, conversion promise or target threshold is invented in product copy or dashboards.

## 11. Failure behaviour

- Invalid CV input: reject safely with a user-readable reason; do not create verified facts.
- JobSpec parse uncertainty: surface ambiguous requirements for human correction.
- Evidence conflict: block approval of dependent material claims.
- AI schema failure: discard the response and offer retry/manual draft.
- AI timeout: bounded retry then safe fallback; no endless spinner.
- Storage failure: do not mark upload/export successful.
- RLS denial: generic authorization response; raw database error stays server-side.
- Evidence revocation after CV approval: invalidate the dependent variant and require re-review.
- Interview session interruption: preserve only the authorized private session state and allow resume/restart.

## 12. Testing strategy

### Domain/unit tests

At minimum:

- extracted claim remains `DECLARED`;
- unsupported vacancy keyword is never inserted as a candidate fact;
- evidence revocation invalidates dependent CV variants;
- ATS and human variants have factual parity;
- XYZ/STAR/CAR rewrite never invents a metric;
- requirement coverage classifications are deterministic for fixed fixtures;
- blocking chronology conflict prevents approval;
- outcome metrics exclude unconfirmed events;
- AI schema rejection never produces approved output.

### Database/security tests

- candidate A cannot read candidate B private records;
- institution membership does not implicitly grant candidate-private access;
- consent/authorized relationship is required for institutional sharing;
- private document storage policy blocks unauthorized reads;
- migration is idempotent or has a documented rollback path;
- service-role-only operations are not callable by `anon`/ordinary candidate roles.

### Browser tests

Use synthetic Humanitarian, Tech and Finance fixtures in FR and EN.

Prove:

1. user enters Candidate OS and starts « Optimiser mon CV »;
2. CV/Talent Passport draft is reviewed;
3. JobSpec is created;
4. COVERED/PARTIAL/GAP results are visible and understandable;
5. unsupported claims cannot be approved;
6. dual variants render and show factual diff/evidence;
7. human approval gates export/application package;
8. interview practice accepts answers and returns contextual feedback;
9. application package is created without auto-submit;
10. mobile viewport has no horizontal overflow;
11. keyboard navigation and error announcements work.

### Release gates

Before merge:

- locked dependency install;
- dependency audit at high severity threshold;
- unit/domain tests;
- database contract/RLS tests;
- typecheck;
- production build;
- Playwright against production build;
- bundle scan for secrets and source maps where applicable;
- no production candidate PII in fixtures, snapshots or logs.

M6/S7+/M8 and independent review remain required before claiming production/commercial performance readiness.

## 13. Repository structure target

```text
apps/afria-recruit/
  app/
    (auth)/
    candidate/
      dashboard/
      cv-optimizer/
      interview-coach/
      applications/
  components/
    candidate/
    evidence/
    interview/
  lib/
    ai/
    domain/
    supabase/
    validation/
  tests/
    unit/
    integration/
    e2e/
  package.json
  package-lock.json
  tsconfig.json
  next.config.*

supabase/
  migrations/
  tests/
```

The implementation plan may refine filenames after inspecting repository conventions, but it may not collapse the operational app into the investor demo or GDIZ app.

## 14. Non-goals for Candidate OS v1 vertical slice

- automatic job application submission;
- autonomous hiring decisions;
- universal ATS certification;
- public candidate profiles;
- employer production portal beyond the minimum contracts needed by this candidate flow;
- payments/subscriptions;
- WhatsApp automation;
- migration or redesign of the investor demo;
- invented production KPIs or customer claims.

## 15. Definition of done for the first vertical slice

The slice is complete only when a synthetic candidate can, through the production-built app:

1. authenticate in a test environment;
2. review imported/declared career facts;
3. target a versioned vacancy;
4. see evidence-backed requirement coverage and real gaps;
5. accept truth-preserving achievement rewrites;
6. generate ATS and human variants with factual parity;
7. complete a contextual practice interview;
8. explicitly approve an application package;
9. record a synthetic observed outcome;
10. pass the full automated security, domain, accessibility and browser suite.

No deployment or commercial readiness claim follows automatically from passing this definition. Release status is determined separately by governance gates.

## 16. Self-review result

- **Placeholder scan:** no TBD/TODO or undefined feature commitments.
- **Scope:** one Candidate OS vertical slice; employer portal, billing, auto-apply and investor-demo refactor excluded.
- **Consistency:** canonical path, data boundaries, evidence states, approval gates and testing requirements are aligned with CV ATS Evidence Loop™ v2.1 and the Master Blueprint.
- **Ambiguity resolved:** `apps/afria-recruit/` is operational; investor demo and GDIZ remain separate; automatic submission is explicitly off.
