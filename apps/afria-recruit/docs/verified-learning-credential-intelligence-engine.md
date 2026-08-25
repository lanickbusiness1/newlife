# AfrIA Recruit™ — Verified Learning & Credential Intelligence Engine™

**Canonical asset:** PRD-RECRUIT-001 — AfrIA Recruit™  
**Status:** CANONICAL P0 / IMPLEMENTED / M6 CORE TEST_PROVEN  
**Runtime status:** M6 CORE TEST_PROVEN — HOLD S7+/M8/PRODUCTION  
**Decision date:** 2026-08-24  
**Test reference:** AR-LCI-001 — Logistics & Humanitarian Credentials  
**Product rule:** This is a capability of AfrIA Recruit™ / Candidate OS™ / Talent Intelligence Graph™. It is not a standalone product.

## 1. Decision

AfrIA Recruit™ must not only match candidates to jobs. It must determine why a candidate is not yet eligible and identify the fastest, lowest-cost, verifiable pathway that can close the competency gap.

Canonical loop:

`Job → required skills → candidate evidence → skill gap → eligible learning opportunities → credential verification → skill acquisition → Talent Passport™ update → employability delta → rematching → application → outcome → R.E.M.E™`

The capability is named **Verified Learning & Credential Intelligence Engine™**.

## 2. Problem being solved

Training marketplaces frequently conflate:

- free learning with a free credential;
- course completion with verified assessment;
- a provider badge with an accredited or employer-recognized credential;
- global availability with country eligibility;
- generic training relevance with actual job-gap closure.

AfrIA Recruit™ must resolve these distinctions before making a recommendation.

## 3. Canonical classification taxonomy

Every learning opportunity must be normalized to one of the following states:

- `FREE_CERTIFIED` — learning and credential are free;
- `FREE_CERTIFIED_RESTRICTED` — free credential, but eligibility is restricted;
- `FREE_LEARNING_PAID_CREDENTIAL` — learning is free, credential requires payment;
- `PAID_CERTIFIED` — paid learning/credential;
- `FREE_LEARNING_NO_CREDENTIAL` — free learning with no formal credential;
- `SPECIALIZED_CERTIFIED` — credential is specialized and only relevant for defined roles/sectors;
- `UNVERIFIED_CREDENTIAL` — issuer, assessment, cost, or credential claim cannot be verified;
- `INELIGIBLE` — candidate fails a hard eligibility rule.

No item may be surfaced as “free certification” unless both `learning_cost = 0` and `credential_cost = 0` are verified from primary evidence.

## 4. Canonical data contract

Minimum entity: `learning_opportunity`.

Required fields:

```yaml
learning_opportunity:
  id: string
  provider: string
  course_title: string
  source_url: string
  source_retrieved_at: datetime
  country_eligibility: [string]
  language: [string]
  sector: [string]
  skills: [string]
  duration_hours: number|null
  learning_cost:
    amount: number|null
    currency: string|null
    verified: boolean
  assessment_required: boolean|null
  credential_available: boolean|null
  credential_cost:
    amount: number|null
    currency: string|null
    verified: boolean
  credential_issuer: string|null
  accreditation_or_recognition: string|null
  credential_expiry: string|null
  evidence_refs: [string]
  verification_status: VERIFIED|PARTIAL|UNVERIFIED|REJECTED
  misleading_claim_score: number
  eligibility_gate: PASS|FAIL|REVIEW
  relevance_score: number
  gap_closure_score: number
  final_recommendation_score: number
```

The deterministic M6 core also supports a configurable evidence freshness context:

```yaml
candidate_learning_context:
  as_of: datetime|null
  max_evidence_age_days: number|null
```

When a freshness policy is configured, stale source evidence fails closed with `EVIDENCE_STALE` and no recommendation score is published.

## 5. Hard gates

A recommendation must fail closed when any of these conditions is met:

1. primary-source evidence is missing for a material credential claim;
2. country or organizational eligibility excludes the candidate;
3. candidate language has no overlap with course language;
4. a paid credential is represented as free;
5. provider identity cannot be resolved;
6. the course does not close a skill required by the target job or target pathway;
7. required evidence is stale beyond the configured verification period;
8. the credential requires an assessment but the assessment condition cannot be verified;
9. a specialized course has no target-sector fit.

High-impact employment decisions remain human-reviewed. The engine recommends learning pathways; it does not automatically reject a candidate from employment.

## 6. Recommendation objective

For each skill gap, rank eligible learning opportunities using at minimum:

`gap_closure + credential_verifiability + country_eligibility + language_fit + monetary_cost + time_cost - misleading_claim_risk`

The current deterministic M6 core uses a bounded 0–100 score only after every hard gate passes:

- gap closure: 0–45;
- credential verification: 0–20;
- language fit: 10;
- country fit: 10;
- monetary cost: 0–5;
- duration: 0–5;
- misleading-risk penalty: 0–5.

The system must be able to produce an explainable recommendation such as:

> Candidate lacks procurement, warehouse and fleet evidence. Course X closes all three gaps, is available in French, requires approximately 5 hours, has zero verified learning and credential cost, and issues a verifiable credential after assessment.

Scores are never sufficient alone; evidence references and gate outcomes must travel with every recommendation.

## 7. AR-LCI-001 — automated functional test case

**Persona:** humanitarian logistics candidate / Mali / French / NGO-UN target.

Target skill groups:

- procurement;
- supply chain;
- warehousing;
- inventory;
- transport;
- fleet;
- asset management;
- humanitarian logistics procedures.

Expected and automated behavior from the examples reviewed on 2026-08-24:

| Learning opportunity | Expected classification | Expected decision |
| --- | --- | --- |
| Mercy Corps × DisasterReady — Procurement & Logistics Certificate | `FREE_CERTIFIED` | PRIORITY |
| UNICEF Agora — Logistics at UNICEF | `FREE_CERTIFIED` | PRIORITY |
| UNICEF specialized cold-chain logistics training | `SPECIALIZED_CERTIFIED` | PRIORITY only when role/sector fit exists |
| DHL/Kaya restricted humanitarian logistics course | `FREE_CERTIFIED_RESTRICTED` | FAIL if Mali/candidate context is outside eligible geography |
| edX audit track | `FREE_LEARNING_PAID_CREDENTIAL` | Do not label as free certification |
| Unverified free credential claim | `UNVERIFIED_CREDENTIAL` | FAIL / no score |

The original functional test is now encoded as automated regression contracts. This establishes the **M6 deterministic core**, not the live-data/global release gate.

## 8. Talent Intelligence Graph™ integration

Add relationships:

`Candidate → HAS_SKILL → Skill`  
`Candidate → HAS_GAP → Skill`  
`LearningOpportunity → TEACHES → Skill`  
`LearningOpportunity → ISSUES → Credential`  
`Credential → EVIDENCES → Skill`  
`Candidate → COMPLETED → LearningOpportunity`  
`Candidate → HOLDS → Credential`  
`Job → REQUIRES → Skill`  
`Recommendation → CLOSES → SkillGap`

The Talent Passport™ must distinguish:

- declared skill;
- inferred skill;
- assessed skill;
- credential-evidenced skill;
- employer-validated skill.

Credential possession must never silently imply mastery without the configured evidence policy. The M6 core preserves stronger existing evidence such as `employer-validated` rather than downgrading it when a credential is added.

## 9. ATS & Application Readiness™ integration

The engine feeds Application Readiness™ only through versioned evidence.

Before training:

`CandidateContext + JobSpec → gaps[] → readiness_score`

After verified completion:

`Credential evidence → skill evidence update → CandidateContext vNext → recalculated readiness_score → employability_delta`

The system must preserve both before/after states for audit and R.E.M.E™.

The deterministic employability delta contract is bounded to 0–100 and rejects invalid scores.

## 10. Product outputs

Candidate-facing:

- “Why am I not yet eligible?” explanation;
- prioritized learning pathway;
- verified cost and duration;
- country/language eligibility;
- credential evidence and issuer;
- expected skills closed;
- post-completion rematch.

Recruiter/institution-facing:

- aggregate skill-gap heatmap;
- credential supply map;
- training-provider quality/verification signals;
- time-to-employability;
- cost-to-close-skills;
- cohort completion and placement outcomes;
- skills shortage intelligence.

## 11. Monetization fit

This capability strengthens existing AfrIA Recruit™ revenue lines rather than creating a new product:

- B2C premium career pathway/readiness;
- B2B recruiter and workforce intelligence;
- B2G national employability and reskilling programs;
- NGO/donor workforce readiness programs;
- university/TVET graduate-to-employment analytics;
- API/analytics for training providers and workforce programs.

Commercial invariant: do not sell “guaranteed employment.” Sell measurable readiness improvement, verified gap closure, evidence-backed matching and outcome measurement.

## 12. M6 acceptance criteria

The deterministic M6 core now has automated tests proving:

- free-learning vs free-credential distinction;
- country eligibility hard gate;
- language filtering;
- source/provenance requirement;
- source freshness policy;
- fail-closed behavior for unverified credential claims;
- required-assessment verification;
- specialized-sector gating;
- skill extraction and normalization;
- job-gap-to-course matching;
- cost/time ranking;
- credential completion update to Talent Passport™;
- before/after readiness/employability delta primitive;
- no recommendation score published when any hard gate fails.

Minimum **live** proof remains open:

`1 real sourced job + 1 real authorized candidate profile + 3 real sourced learning opportunities + 1 eligibility rejection + 1 misleading free-certification claim + 1 verified credential pathway → explainable ranking → Talent Passport update simulation → readiness delta`.

## 13. Release gates

`Specification → implementation → unit/contract tests → AR-LCI-001 automated fixture set → M6 core → live proof → S7+ security/privacy → M8 governance/evidence → external review → deployment → Release-to-Revenue → R.E.M.E™`

Current status:

**M6 CORE TEST_PROVEN / GO LIVE-PROOF & S7+ / HOLD M8 & PRODUCTION.**

## 14. M6 Core proof — 24 août 2026

Implementation file:

`apps/afria-recruit/lib/domain/learning-credential-intelligence.ts`

Automated contract:

`apps/afria-recruit/tests/unit/learning-credential-intelligence.test.ts`

TDD evidence:

- RED #192 — `56a24c82d9b4792f24e73c8ff4fc19001cffe591` — module absent, unit-test compilation fails as expected;
- GREEN #193 — `d710a548926e1a628248c1521e64413e569558b9` — initial deterministic core, full Candidate OS workflow SUCCESS;
- RED #194 — `469a5789cd71868833f909f3cbe0f30b2a9772ce` — 83/84 tests; stale evidence incorrectly passes;
- GREEN #195 — `3c0fd2ab09fc1f1e79a869d6e326e1aab2dc5f49` — **84/84 unit tests, 0 failure**, typecheck PASS, Next.js production build PASS, **8/8 Playwright**, source scan PASS, public bundle scan PASS, npm audit **0 vulnerability**.

Release boundary:

- no new database schema;
- no production candidate PII;
- no network/API ingestion implemented in this core;
- no autonomous application rejection;
- no S7+/M8/Big4 claim;
- no production deployment claim;
- branch remains under PR #48 and release governance.
