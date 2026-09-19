# AfrIA Recruit UN Pathways Eligibility Core — Design

## Status

CEO-approved P0 slice of `PRD-RECRUIT-001 — AfrIA Recruit™`. This design implements the first bounded software slice of `UN System Entry Pathways Intelligence™`; it does not create a new product.

## Goal

Add a deterministic institutional-pathway eligibility core that keeps professional fit separate from hard eligibility, represents dynamic programme state, and returns an explainable `APPLY / PREPARE / SKIP` recommendation without inferring sensitive candidate attributes.

## Scope

This slice implements:

1. `Dynamic Eligibility Matrix™` core data contract.
2. `Program State Machine™` states: `VERIFIED_OPEN`, `CLOSED`, `RECURRING`, `COUNTRY_DEPENDENT`, `SPONSOR_DEPENDENT`, `REVIEW_REQUIRED`.
3. Rule-by-rule eligibility evaluation: `ELIGIBLE`, `INELIGIBLE`, `REVIEW_REQUIRED`.
4. Strict invariant `FIT != ELIGIBILITY`: fit score can never override a failed hard rule.
5. Candidate recommendation: `APPLY`, `PREPARE`, `SKIP`.
6. Deterministic pathway ladder ordering for multiple institutional routes.

This slice does not implement live UN source connectors, persistence migrations, CV generation, auto-submission, external notifications, or outcome learning. Those remain follow-on slices after this core is proven.

## Architecture

Create a focused domain module at `apps/afria-recruit/lib/domain/institutional-pathways.ts`. The module remains pure and deterministic: callers provide a source-backed pathway object and an explicitly declared candidate eligibility profile; the module returns rule evaluations and recommendations. No network calls, database calls, AI inference, or implicit candidate enrichment occur in this layer.

The existing Candidate OS remains unchanged. This domain slice is deliberately isolated so future source adapters can normalize UN Careers, UNV, UNICEF, UNDP-JPO, WHO and other institutional programmes into the same `InstitutionalPathway` contract.

## Data contracts

### Programme state

```ts
export type ProgramState =
  | 'VERIFIED_OPEN'
  | 'CLOSED'
  | 'RECURRING'
  | 'COUNTRY_DEPENDENT'
  | 'SPONSOR_DEPENDENT'
  | 'REVIEW_REQUIRED';
```

### Hard-rule kinds

```ts
export type EligibilityRuleKind =
  | 'nationality'
  | 'age'
  | 'education'
  | 'experience'
  | 'language'
  | 'sponsor'
  | 'country_participation'
  | 'post_graduation_window'
  | 'residency'
  | 'document';
```

Every rule is source-backed and has an identifier, human label and `sourceRef`. Rules may specify allowed codes, minimum/maximum values or required document codes depending on kind.

### Candidate eligibility profile

Only explicitly supplied facts may be evaluated. Missing hard-rule data never defaults to PASS.

```ts
export interface CandidateEligibilityProfile {
  nationalityCodes?: string[];
  age?: number;
  highestEducationLevel?: 'secondary' | 'bachelor' | 'master' | 'doctorate';
  yearsExperience?: number;
  languageCodes?: string[];
  sponsorCountryCode?: string;
  participatingCountryCodes?: string[];
  monthsSinceGraduation?: number;
  residenceCountryCode?: string;
  availableDocumentCodes?: string[];
}
```

No field is derived from name, photo, language, homeCountry, currentCountry or any other proxy.

## Eligibility semantics

For each hard rule:

- explicit conflict with the source-backed rule => `FAIL`;
- explicit satisfaction => `PASS`;
- candidate data required to resolve the rule is absent => `REVIEW_REQUIRED`.

Overall result:

- any `FAIL` => `INELIGIBLE`;
- otherwise any `REVIEW_REQUIRED` => `REVIEW_REQUIRED`;
- otherwise => `ELIGIBLE`.

A high fit score never changes these outcomes.

## Recommendation semantics

- `SKIP` when overall eligibility is `INELIGIBLE`.
- `SKIP` when programme state is `CLOSED`, even if the candidate would otherwise be eligible.
- `APPLY` only when state is `VERIFIED_OPEN` and eligibility is `ELIGIBLE`.
- `PREPARE` for unresolved eligibility or non-open dynamic states (`RECURRING`, `COUNTRY_DEPENDENT`, `SPONSOR_DEPENDENT`, `REVIEW_REQUIRED`).

The recommendation includes `fitScore` only for ranking/explanation; it is never used to bypass hard rules.

## Pathway ladder

For multiple pathways, deterministic ranking is:

1. `APPLY` before `PREPARE` before `SKIP`.
2. Within the same recommendation, higher `fitScore` first.
3. Ties resolved lexicographically by pathway id for deterministic output.

## Error handling

Invalid source contracts fail fast:

- blank pathway id/title/sourceRef;
- source timestamp missing;
- rule without id/label/sourceRef;
- invalid fit score outside 0–100;
- rule configuration missing the operand required for its kind.

These are programmer/data-normalization errors, not candidate eligibility outcomes.

## Verification criteria

Unit tests must prove at minimum:

1. 95% fit + failed nationality rule => `INELIGIBLE` and `SKIP`.
2. sponsor-dependent rule with missing sponsor fact => `REVIEW_REQUIRED` and `PREPARE`.
3. candidate satisfies all rules but programme is `CLOSED` => `SKIP`.
4. candidate satisfies all rules and programme is `VERIFIED_OPEN` => `APPLY`.
5. missing country-participation evidence => `REVIEW_REQUIRED`.
6. ladder ordering is deterministic and never promotes an ineligible high-fit pathway above an eligible lower-fit pathway.

## Release boundary

Passing this slice establishes only a TEST_PROVEN domain core. It does not close real-data E2E, live source freshness, S7+, M8, external review, or public production deployment gates.