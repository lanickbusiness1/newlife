# AfrIA Recruit™ — Recruitment Engine Benchmark Amendment

Date: 2026-08-17
Status: CEO-approved benchmark gate
Parent design: `docs/superpowers/specs/2026-08-17-afria-recruit-four-experts-delta-design.md`
Parent product: PRD-RECRUIT-001 — AfrIA Recruit™
Canonical technical baseline: PR #35 head `f334f858ad1b69b78123d487fde716e60822fc00`

## 1. Authority

This amendment is authoritative where it changes prioritization or scope in the parent Four Experts Delta design. It does not replace the parent product, Candidate OS™, Talent Passport™, Evidence Graph, consent model, RLS, human review, Application Factory™, Career CRM™, or existing release gates.

The market benchmark covers the functional families represented by LinkedIn Recruiter/Hiring Assistant, Mercor, Eightfold, Beamery, Workday/HiredScore, Ashby, Greenhouse, SmartRecruiters, Gem, hireEZ, SeekOut, Paradox, HireVue, Indeed, Jobstore, Jobscan, Teal, Huntr, Simplify, Fuzu, BrighterMonday, Jobberman and AfricaWork.

The benchmark conclusion is not to copy any one competitor. AfrIA Recruit™ must combine candidate truth, recruiter calibration, explainable evidence, skills proof and confirmed outcomes into one governed system.

## 2. Revised product moat

AfrIA Recruit™ must optimize for:

`Identity + Skills + Evidence + Context + Assessment + Outcome`

not merely:

`CV + Keywords + Matching`.

The core question the system must answer is:

> Who appears to fit, what is actually known about this candidate, what evidence supports each claim, what remains unverified, what proof should be requested next, and what was learned from confirmed outcomes?

## 3. Mandatory benchmark deltas

### 3.1 Recruiter Intake & Calibration — P0

The recruiter-side role definition must become structured and correctable.

Input model:
- job title;
- country/market context;
- required requirements;
- preferred requirements;
- blocking requirements;
- minimum evidence expectation;
- role-specific context;
- recruiter corrections.

Initial implementation MUST reuse `JobSpec`. P0 must not create a parallel Job model. The additive contract is recruiter-calibration metadata mapped to existing requirements.

### 3.2 Recruiter Reverse Twin™ — P0

The existing deterministic gap analysis is promoted into a recruiter-facing explainable lens.

For every requirement, expose:
- priority: `BLOCKING | HIGH | MEDIUM`;
- coverage: `COVERED | PARTIAL | GAP | NOT_APPLICABLE`;
- evidence references;
- risk flags;
- likely recruiter questions;
- explicit `doNotClaim` guidance;
- proof-of-skill recommendation when evidence is weak or absent.

The system MUST NOT claim to reproduce a private ATS or employer algorithm.

### 3.3 Proof-of-Skill Challenge™ — P0

For an important `PARTIAL` or `GAP` requirement, AfrIA Recruit™ may recommend a bounded next proof action instead of inventing competence or rejecting the candidate.

Allowed challenge types in P0:
- `WORK_SAMPLE`;
- `STRUCTURED_QUESTION`;
- `PORTFOLIO_EVIDENCE`;
- `CERTIFICATE_EVIDENCE`;
- `REFERENCE_EVIDENCE`.

A challenge is a verification action, never proof by itself. Completion MUST NOT promote a claim to `EVIDENCED` or `VERIFIED` without the existing evidence/verification mechanisms.

### 3.4 Evidence Elicitation™ + Achievement Writer™ — P0

Retain the parent design, with one additional rule: elicitation and proof-of-skill recommendations must share the same source requirement/evidence provenance so that the rewrite can show which confirmed facts were actually used.

Raw elicitation answers remain non-persistent in clear text by default.

### 3.5 Structured Interview Context — P0

Interview generation must prioritize:
1. blocking `GAP` / `PARTIAL` requirements;
2. proof-of-skill gaps;
3. contradictions or weak evidence;
4. candidate achievements used in the generated CV;
5. role-specific behavioral questions.

No live covert interview assistance is part of P0.

### 3.6 Two-Sided Outcome Confirmation — P0 contract / P1 workflow

The current candidate-reported outcome remains `unconfirmed` and MUST NOT change canonical status.

Add an explicit confirmation model:
- candidate report;
- employer/institution confirmation;
- system/application event confirmation where available;
- canonical outcome becomes eligible for metrics only after confirmation.

P0 must define the domain/service contract and keep current candidate reporting behavior backward-compatible. Employer workflow and authentication may ship in P1.

### 3.7 Talent Rediscovery — P1

Recruiter OS must be able to reconsider previously seen candidates for a new JobSpec using current Talent Passport facts and evidence, without silently reusing stale conclusions.

Every rediscovery decision must be recomputed and time-stamped.

### 3.8 Candidate Integrity Controls — P1

Add non-accusatory integrity signals for:
- duplicate identity indicators;
- document inconsistency;
- CV ↔ Talent Passport contradiction;
- interview ↔ verified evidence contradiction;
- suspicious claim escalation.

Integrity signals are review triggers, not automatic fraud verdicts.

### 3.9 Conversational Africa Channel — P1

Provide recruiter/candidate workflow adapters for low-friction channels, starting with WhatsApp-capable conversation architecture and low-bandwidth web.

No P1 channel may bypass authentication, consent, provenance or human decision gates. SMS/USSD remain jurisdiction- and provider-dependent extensions, not assumptions.

## 4. Revised delivery slices

### Turbo P0 — build now

1. Recruiter calibration types over existing JobSpec.
2. Deterministic Recruiter Reverse Twin™.
3. Proof-of-Skill recommendation engine.
4. Evidence Elicitation contract and Achievement Writer integration.
5. Structured interview prioritization from recruiter lens.
6. Two-sided outcome confirmation domain contract while preserving current unconfirmed candidate event behavior.
7. Candidate command UX: `Je veux décrocher ce poste`.
8. Unit/API/E2E/security regression tests.

### P1 — immediately after P0 evidence

1. Recruiter workspace and human calibration persistence.
2. Talent rediscovery.
3. Candidate integrity review triggers.
4. Employer/institution outcome confirmation workflow.
5. WhatsApp/low-bandwidth conversational adapter.
6. STRATEX enrichment by country/sector/organization type.

## 5. Non-negotiable invariants

- No unsupported vacancy requirement becomes a candidate skill.
- No challenge completion becomes verified evidence by itself.
- No candidate-reported outcome becomes a confirmed metric by itself.
- No fraud verdict is produced from an integrity signal alone.
- No recruiter score is presented as a hidden-employer-algorithm reconstruction.
- `DECLARED / EVIDENCED / VERIFIED` remain distinct.
- Existing RLS, consent, candidate ownership, no-auto-submit and human-review gates remain intact.
- No public performance promise before confirmed outcome evidence supports it.

## 6. Revised success criteria

Turbo P0 is successful only if:

1. recruiter lens derives from existing JobSpec + RequirementCoverage without promoting GAPs;
2. blocking requirements are visibly distinguishable from secondary requirements;
3. proof-of-skill recommendations are bounded verification actions with provenance;
4. evidence elicitation cannot create a new candidate fact by inference;
5. interview focus follows actual requirement/evidence risk;
6. candidate outcome remains unconfirmed until a distinct confirmation source exists;
7. ATS/Human CV fact parity and human review remain unchanged;
8. existing Candidate OS tests remain green and new tests prove the benchmark deltas;
9. production remains NO until the existing RLS institution/disclosure, authenticated staging, independent review and M6/S7+/M8 gates are satisfied.
