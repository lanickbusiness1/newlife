# AfrIA Recruit™ Career Pathway Intelligence™ Design

## Status

CEO-approved architectural delta for `PRD-RECRUIT-001`. This extends the existing `Opportunity Intelligence™` and Candidate OS™ inside `apps/afria-recruit/`. It is **not** a new product, a new framework, or a replacement for JobSpec / Explainable Matching.

## Goal

Move AfrIA Recruit™ from "find the next matching job" to "rank the safest, highest-value next career action and explain how it advances the candidate toward a declared career goal".

## Signal and source verification

The design was triggered by a 19 August 2026 signal describing multiple United Nations career entry routes. Official sources confirm the underlying pattern:

- UNV publishes on-site and online volunteer opportunities through its Unified Volunteering Platform and Global Talent Pool: https://www.unv.org/become-volunteer/
- UNV Online Volunteering can provide practical development-sector experience and certificates; each assignment has its own requirements: https://www.unv.org/become-online-volunteer
- UN Careers exposes YPP / early-career pathways and related programmes: https://careers.un.org/
- FAO exposes Internship, Volunteer, Fellows, JPO and Young Professionals programmes under Young Talent: https://www.fao.org/employment/young-talent-programme/en/
- UNDP JPO Service Centre administers JPO / SDP pathways with sponsor- and vacancy-specific eligibility: https://www.undp.org/jposc

The product must therefore treat eligibility as source-backed and time-sensitive. It must never infer eligibility from nationality, age, education or work authorization when those fields are missing.

## Existing baseline

This delta is stacked on PR #36 (`feat/afria-recruit-four-experts-delta`) which itself is stacked on PR #35. Existing invariants remain authoritative:

- `GAP` never becomes a skill.
- `DECLARED / EVIDENCED / VERIFIED` remain distinct.
- No automatic application submission.
- Candidate-reported outcomes remain unconfirmed without employer/system confirmation.
- External AI processing requires explicit consent.
- Candidate ownership and RLS boundaries remain mandatory.

## Product behavior

A candidate declares a career goal such as "Programme Officer in a UN agency". AfrIA Recruit™ evaluates available opportunities that may include jobs, volunteering, online volunteering, internships, fellowships, JPO/YPP-like programmes, graduate programmes, consultancies, rosters, scholarships, certifications and mentorships.

For each opportunity the system returns:

1. deterministic eligibility status: `ELIGIBLE`, `INELIGIBLE`, or `REVIEW_REQUIRED`;
2. a transparent progression score from 0 to 100;
3. the score components and weights;
4. blocking eligibility reasons;
5. missing data that prevents a safe decision;
6. expected evidence / skill / network / eligibility gains;
7. official source provenance and verification date;
8. a human-readable "why this next" explanation.

The first governed vertical slice ranks next actions. It does not claim a causal guarantee of employment, does not auto-apply and does not fabricate future outcomes.

## Domain model

### Opportunity

`OpportunityKind`:

- `JOB`
- `INTERNSHIP`
- `VOLUNTEERING`
- `ONLINE_VOLUNTEERING`
- `FELLOWSHIP`
- `YOUNG_PROFESSIONAL_PROGRAM`
- `JPO`
- `GRADUATE_PROGRAM`
- `TRAINEESHIP`
- `CONSULTANCY`
- `TALENT_POOL`
- `ROSTER`
- `SCHOLARSHIP`
- `CERTIFICATION`
- `MENTORSHIP`

`CareerOpportunity` carries:

- identity: `id`, `title`, `organization`, `kind`;
- geography / work mode: `countryCode`, `remote`;
- source provenance: `sourceUrl`, `sourceAuthority`, `verifiedAt`;
- lifecycle: `opensAt`, `closesAt` when known;
- requirements: deterministic eligibility rules;
- progression effects: skills/evidence/network/future-eligibility signals;
- burden: estimated time and direct cost when explicitly known; otherwise `null`.

### Candidate eligibility profile

Eligibility uses an explicit profile instead of overloading `CandidateContext`:

- `candidateId`
- `age: number | null`
- `nationalities: string[]`
- `residenceCountryCode: string | null`
- `highestEducationLevel: SECONDARY | BACHELOR | MASTER | PHD | null`
- `yearsExperience: number | null`
- `languageCodes: string[]`

Unknown values remain unknown. `homeCountry` must never be treated as nationality.

### Eligibility rules

P0 supports:

- minimum / maximum age;
- nationality allow-list;
- residence allow-list;
- minimum education level;
- minimum years of experience;
- required language;
- sponsor-country requirement represented as an explicit nationality rule sourced from the vacancy/programme.

Rules may be marked `blocking`. Unsupported free-text requirements are allowed but force `REVIEW_REQUIRED` instead of a false `ELIGIBLE`.

## Eligibility semantics

`INELIGIBLE` only when a known candidate value conflicts with a blocking deterministic rule.

`REVIEW_REQUIRED` when:

- a blocking rule cannot be evaluated because candidate data is missing;
- a requirement is not yet machine-evaluable;
- the source is stale beyond its configured freshness threshold;
- the programme explicitly says vacancy-specific criteria apply and no vacancy-level rule set is loaded.

`ELIGIBLE` only when every blocking rule is evaluated and passes.

## Progression scoring

`CareerProgressionScore` is deterministic and explainable.

Weights for P0:

- career-goal alignment: 30%
- evidence gain: 20%
- skill gain: 15%
- future eligibility unlocked: 15%
- network / institutional exposure: 10%
- immediate fit: 10%

Burden does not silently reduce the score. It is returned separately so the candidate can see cost/time trade-offs. An `INELIGIBLE` opportunity is never recommended as the next action. `REVIEW_REQUIRED` opportunities may be shown below eligible options with a data-completion action.

The score is a prioritization heuristic, not a probability of hiring or admission.

## Career goal and pathway output

`CareerGoal` P0 contains:

- `id`
- `title`
- optional `targetOrganization`
- optional `targetKind`
- optional target skill IDs / evidence categories.

`rankCareerNextActions(goal, opportunities, candidateProfile)` returns ranked `CareerNextAction[]` with:

- `opportunity`
- `eligibility`
- `progressionScore`
- `rank`
- `whyThisNext[]`
- `missingData[]`

P0 intentionally ranks one-step next actions. Multi-step 6/12/24/36-month simulation is a follow-on subsystem once outcomes and transition data are sufficiently evidenced; no synthetic causal path is presented as proven.

## UI

Add a `CareerPathwayPanel` to the existing Candidate OS journey. It must:

- show the declared goal;
- list eligible actions first, ordered by progression score;
- visually separate `REVIEW_REQUIRED` opportunities;
- expose score components and source provenance;
- show a "complete these facts" prompt for missing eligibility data;
- never display "guaranteed", "best chance" or hiring-probability language.

## API

Add `GET /api/candidate/career-pathway` under the existing authenticated candidate route wrapper.

P0 uses a deterministic official-source fixture registry for tests and E2E only. Live ingestion of UN/FAO/UNDP opportunities is a separate source-adapter wave and must not scrape or persist terms in a way that violates source conditions.

## Security and privacy

- No sensitive PII is sent to external AI for eligibility or scoring.
- Eligibility and scoring are deterministic P0 code paths.
- No age/nationality inference from name, photo, language or home country.
- No source access token or scraper credential in the browser bundle.
- Existing consent and RLS boundaries are unchanged.
- Logging records rule IDs and result classes, not unnecessary raw PII.

## Testing

TDD is mandatory.

Unit tests must prove:

1. unknown nationality never becomes inferred eligibility;
2. known conflict with a blocking rule returns `INELIGIBLE`;
3. missing blocking data returns `REVIEW_REQUIRED`;
4. fully satisfied blocking rules return `ELIGIBLE`;
5. ineligible opportunities never outrank eligible ones;
6. score component weights are transparent and sum to 100;
7. the same inputs produce the same ranking;
8. stale / manual-review sources cannot produce `ELIGIBLE` automatically.

E2E must prove the candidate can see ranked next actions, source links and missing-data prompts without any auto-application side effect.

## Release gates

This delta does not bypass the existing stacked-PR gates. Before merge/publication eligibility:

1. resolve PR #35 mergeability / baseline integration;
2. merge or rebase/retarget PR #36 with equivalent fresh CI;
3. fresh CI for this delta;
4. live institution-disclosure / consent RLS boundary proof;
5. authenticated staging;
6. independent security review;
7. M6;
8. S7+;
9. M8;
10. explicit release decision.

Big4 commercial/economic review remains required before claims of conversion uplift or institutional-scale economics.