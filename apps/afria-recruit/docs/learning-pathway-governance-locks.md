# AfrIA Recruit™ — Revenue Pilot Governance Policy

## Canonical identity

- Product: `PRD-RECRUIT-001`
- Capability: `Verified Learning & Credential Intelligence Engine™`
- Guard: `Learning Pathway Eligibility Guard™`
- Commercial status: **COMMERCIAL BLOCK LIFTED / READY_TO_SELL — PAID PILOT**
- Validation date: 2026-08-25
- Release branch: `feat/afria-recruit-ats-readiness-p0`
- Reference PR: `#48`

## CEO release decision — 25 August 2026

The previous release lock that made real-data E2E, S7+, M8 and external review prerequisites to any commercial activation is lifted.

AfrIA Recruit™ MAY now be sold, demonstrated and operated as a **paid controlled pilot** on the surfaces already `TEST_PROVEN`.

The following are no longer commercial-sale blockers:

- real-data E2E completion;
- S7+ completion;
- M8 final approval;
- Big4 / independent external review;
- `PRODUCTION_PROVEN` status.

Those controls remain maturity/scale gates where applicable. They MUST NOT be represented as already passed when they are not.

## Revenue Pilot contract

Allowed now:

- prospecting and selling AfrIA Recruit™;
- paid demonstrations and paid diagnostics;
- bounded paid pilots with authorized users;
- CV/application-readiness services;
- verified learning/credential recommendations;
- Talent Passport™ and gap-analysis services;
- B2B/B2G pilot proposals and invoices;
- collection of real revenue before M8/Big4;
- use of authorized real candidate data inside the existing consent/RLS boundary.

Not allowed to claim without evidence:

- `PRODUCTION_PROVEN`;
- guaranteed hiring, interview, placement or employability uplift;
- M8/S7+/external-review PASS when those gates have not passed;
- regulatory or legal equivalence that has not been sourced and verified.

## HARD-001 — Truth lock — RETAINED

No candidate fact, qualification, metric, credential equivalence or eligibility status may be fabricated.

- unsupported requirements remain explicit gaps;
- a useful course cannot prove a distinct diploma, license, employer-specific procedure, language, experience or software requirement without source-backed equivalence;
- paid-pilot status never changes evidence semantics.

## HARD-002 — Evidence lock — RETAINED

Recommendations must preserve their actual evidence level.

- primary provenance where required;
- freshness, country/language eligibility and assessment/cost status when material;
- `FREE_LEARNING_PAID_CREDENTIAL != FREE_CERTIFIED`;
- unknown evidence remains unknown rather than being promoted for sales convenience.

## HARD-003 — Privacy / security lock — RETAINED

Commercial urgency does not disable security controls.

- consent where required;
- candidate ownership and least privilege;
- Supabase RLS boundaries;
- no raw candidate PII in public GitHub evidence;
- no client-side service-role secrets;
- no synthetic production pollution to manufacture proof.

## HARD-004 — Human-impact lock — RETAINED

AfrIA Recruit™ may recommend, score and prepare, but it must not silently make unsupported high-impact employment decisions or auto-submit applications where human approval is required by the current product contract.

## SCALE-001 — M8/S7+/external review — MOVED AFTER FIRST CASH

M8, S7+ and independent/external review are now **scale and institutional-production gates**, not first-revenue gates.

They become mandatory before any release that is explicitly classified by the applicable governance contract as high-risk, regulated, sovereign/administrative decision-making, or institution-wide production scale.

They do not block:

`SELL → PAID PILOT → COLLECT → DELIVER → EVIDENCE → CASE STUDY → then HARDEN/SCALE`.

## Current canonical commercial state

`TEST_PROVEN + READY_TO_SELL + PAID_PILOT_AUTHORIZED / PRODUCTION_PROVEN NOT CLAIMED`

## Non-regression rule

Future agents and workflows must optimize for revenue without weakening HARD-001..004. Governance gates may delay scale, but must not be converted into imaginary blockers to prospecting, contracting, invoicing, paid pilot delivery or collection when the paid-pilot scope is already technically test-proven.
