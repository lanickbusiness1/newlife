# AfrIA Recruit™ — Learning Pathway Governance Locks

## Canonical identity

- Product: `PRD-RECRUIT-001`
- Capability: `Verified Learning & Credential Intelligence Engine™`
- Guard: `Learning Pathway Eligibility Guard™`
- Governance status: **LOCKED / NON-BYPASSABLE**
- Validation date: 2026-08-25
- Release branch: `feat/afria-recruit-ats-readiness-p0`
- Reference PR: `#48`

## Purpose

These locks prevent AfrIA Recruit™ from converting a useful training recommendation into a false claim of candidate eligibility, readiness, or release maturity.

## LOCK-LP-001 — Required-gap lock

If any required eligibility gap remains open, the pathway MUST NOT return `PASS`.

Canonical gap kinds:

`skill | language | education | experience | procedure | software | credential | license | other`

Decision contract:

- useful course + all required gaps closed → normal eligibility evaluation may continue;
- useful course + one or more required non-skill gaps still open → `REVIEW`;
- course closes no target gap → `FAIL` for eligibility-remediation purpose;
- unresolved or unsourced required gap → never promote to `PASS`.

## LOCK-LP-002 — Evidence lock

No learning or credential recommendation may be promoted to verified without adequate provenance.

Hard requirements include, where applicable:

- primary source URL;
- evidence reference(s);
- freshness policy;
- country and language eligibility;
- assessment condition;
- verified learning cost;
- verified credential cost;
- credential issuer;
- distinction between free learning and free certification.

A hard evidence failure MUST suppress the recommendation score where the canonical evaluator requires fail-closed behavior.

## LOCK-LP-003 — No misleading-free-certification lock

A course with free learning but a paid credential MUST NOT be represented as a free certification.

`FREE_LEARNING_PAID_CREDENTIAL != FREE_CERTIFIED`

## LOCK-LP-004 — Candidate-truth lock

Learning completion MUST NOT fabricate or infer unsupported candidate facts.

- a credential may evidence only skills actually taught by the verified learning opportunity;
- provenance must be attached to the skill evidence;
- existing stronger evidence states must not be downgraded;
- no credential may substitute automatically for a distinct education, license, employer-specific procedure, language, experience, or software requirement unless the source contract explicitly proves that equivalence.

## LOCK-LP-005 — PII boundary lock

Real candidate evidence may be used only under an authorized processing boundary.

- no raw CV or candidate PII in public GitHub evidence;
- no synthetic pollution of production to manufacture a live proof;
- live evidence bundles must be minimized and de-identified where repository persistence is unnecessary;
- Supabase/RLS boundaries must remain enforced for any real-data E2E.

## LOCK-LP-006 — Release lock

The following states are forbidden until their own evidence gates are satisfied:

- `S7+ PASS`
- `M8 PASS`
- external review PASS
- production release
- claims of real employability uplift

Current allowed status:

`M6 CORE + GAP-SEMANTICS TEST_PROVEN / HOLD REAL-DATA E2E / S7+ / M8 / PROD`

## LOCK-LP-007 — Promotion lock

No human, agent, workflow, UI, API, or future optimization layer may silently override these locks.

Any override requires:

1. an explicit canonical governance decision;
2. a versioned contract change;
3. new RED/GREEN tests covering the changed invariant;
4. updated evidence and release documentation;
5. re-evaluation through the applicable S7+/M8/external-review gates.

## Provenance of the locks

The locks are grounded in the 24–25 August 2026 live-source precheck and TDD hardening:

- RED run `#199` — typed eligibility-gap contract absent;
- GREEN run `#201` — `Learning Pathway Eligibility Guard™` and typed gaps proven;
- final documentation head verification run `#202` — SUCCESS.

## Non-regression rule

These locks are part of the canonical release contract for the learning/credential pathway. Future refactors MUST preserve them or deliberately version and re-approve the governance contract.
