# AfrIA Recruit™ — Sector-Reputation Credential™ — Bioforce

**Canonical asset:** PRD-RECRUIT-001 — AfrIA Recruit™  
**Decision date:** 2026-08-25  
**Status:** CANONICAL P0 / SPECIFIED / NOT YET CODED  
**Scope:** Verified Learning & Credential Intelligence Engine™ + Talent Intelligence Graph™ + ATS/Application Readiness™

## 1. Decision

AfrIA Recruit™ must not treat all formally valid credentials as equivalent.

A credential may carry additional labor-market value because employers in a specific sector repeatedly recognize, request or prefer it. This is modeled as a **Sector-Reputation Credential™** signal.

**Bioforce is the first canonical calibration case for the French and francophone humanitarian/NGO labor market.**

## 2. Bioforce policy

Bioforce credentials receive a contextual reputation boost when the target role belongs to humanitarian logistics, humanitarian program operations, field coordination, supply chain, NGO administration or adjacent humanitarian functions and the employer ecosystem is French/francophone or demonstrably values Bioforce credentials.

The boost MUST NOT be applied globally or outside the evidenced sector/employer context.

Examples of evidence supporting this calibration include:

- Bioforce's `Responsable Logistique de l’Action Humanitaire` certification is presented by Bioforce as an RNCP level 6 professional certification: https://www.bioforce.org/learn/les-certifications-humanitaires-bioforce/la-certification-humanitaire-responsable-logistique/
- Humanitarian vacancies published through Coordination SUD can explicitly cite a Bioforce-type humanitarian logistics diploma as an accepted/preferred qualification: https://www.coordinationsud.org/offre-emploi/coordinateur-logistique-volant-h-f-2-2-2/
- Coordination SUD describes Bioforce training pathways within the humanitarian professional ecosystem: https://www.coordinationsud.org/formation/bachelor-humanitaire/

These references are calibration evidence, not a permanent universal score. Employer-demand evidence must remain refreshable and source-backed.

## 3. Credential hierarchy

AfrIA Recruit™ must distinguish at minimum:

1. full Bioforce professional certification / RNCP credential;
2. Bioforce Bachelor or degree-level pathway where applicable;
3. Bioforce competency block / validated unit;
4. Bioforce short course / continuing education;
5. attendance-only or non-assessed learning.

A short course MUST NOT inherit the reputation weight of a full professional certification.

## 4. Canonical contextual score

Credential value is not a single global number.

The target model is:

`CredentialValue(job, candidate, credential) = formal_recognition + role_skill_fit + sector_reputation + employer_preference_evidence + geography_language_fit + credential_depth + evidence_strength`

with penalties for:

`stale_evidence + unverifiable_claim + sector_mismatch + credential_level_mismatch`.

The `sector_reputation` and `employer_preference_evidence` components must be contextual to the target vacancy or employer cluster.

## 5. Employer-demand evidence

AfrIA Recruit™ should maintain evidence edges such as:

`EmployerCluster → VALUES → CredentialIssuer`

`Vacancy → ACCEPTS_OR_PREFERS → Credential`

`Credential → ISSUED_BY → Provider`

`Credential → RECOGNIZED_AS → FormalLevel`

`Credential → RELEVANT_IN → Sector`

`Credential → REPUTATION_WEIGHT_IN → EmployerCluster`

Repeated sourced vacancy evidence can increase confidence that a credential is genuinely valued in that labor market.

## 6. Guardrails

- No employer preference may be invented from provider marketing alone.
- Formal recognition and employer reputation are separate dimensions.
- A reputation boost cannot override a missing mandatory eligibility requirement.
- A prestigious credential does not prove experience, language, software, license or employer-specific procedures unless those facts are separately evidenced.
- Historical preference evidence must be timestamped and refreshable.
- No guaranteed hiring or placement claim may be generated from credential reputation.

## 7. First calibration case

For humanitarian logistics roles in French/francophone NGO ecosystems:

- full Bioforce humanitarian logistics credentials: **HIGH contextual sector reputation** when supported by target-market evidence;
- Bioforce short courses: reputation signal may be positive but materially lower than full certification;
- outside humanitarian/NGO contexts: no automatic Bioforce boost without employer/sector evidence.

## 8. Product effect

AfrIA Recruit™ must evolve from:

`Is this credential formally valid?`

to:

`Is this credential formally valid, relevant to the target role, and observably valued by this employer ecosystem?`

This signal feeds:

`Job → Employer/Sector Context → Required Skills & Credentials → Candidate Evidence → Credential Reputation Weight → Eligibility Guard → Matching/Readiness → Explanation`.

## 9. Implementation boundary

Current decision status is **SPECIFIED / NOT YET CODED**.

Next implementation must add:

- contextual credential reputation model;
- credential-depth normalization;
- employer/vacancy preference evidence registry;
- time-stamped source provenance;
- deterministic reputation-weight tests using Bioforce as the first fixture;
- fail-closed behavior when sector/employer evidence is absent;
- integration with Talent Intelligence Graph™, Talent Passport™ and Application Readiness™.

No production behavior is claimed by this document alone.
