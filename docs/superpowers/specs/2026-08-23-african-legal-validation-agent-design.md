# AGT-LEGAL-AFR-001 — African Legal Validation Agent™ — Design canonique Genesis V4

**Status:** Design approved — canonical specification  
**Agent ID:** `AGT-LEGAL-AFR-001`  
**ADR:** `ADR-LEGAL-AFR-001 — One African Legal Core, Many Country Legal Profiles™`  
**Primary product:** AfrIA Recruit™ (`PRD-RECRUIT-001`)  
**First country profile:** Mali (`ML`)  
**First benchmark:** Mali territorial health recruitment — `21,990 candidates → 170 positions`

## 1. Architecture decision

AfrIAgenesis® uses one reusable African legal intelligence core. A new country MUST be onboarded by configuration, corpus, jurisdiction metadata, regional overlays and versioned rules; it MUST NOT require a new legal agent implementation.

Canonical invariant:

`One African Legal Core → Many Country Legal Profiles™`

`AGT-LEGAL-ML-001` is retained only as the Mali runtime/profile compatibility name backed by `AGT-LEGAL-AFR-001`.

## 2. Mission

Transform verified African legal sources into executable, explainable, deterministic and auditable rules while resolving national, special-regime, regional, continental and international layers applicable to the exact matter and effective date.

No unsourced interpretation may be promoted to a production rule. A generative model proposes structured interpretation and candidate rules; the deterministic rule engine executes adverse decisions.

## 3. Core capabilities

### 3.1 Legal Country Bootstrap Engine™

Given an ISO country code, it builds a country onboarding dossier:

`DISCOVERED → SOURCE_MAPPED → SOURCE_VERIFIED → RULES_DRAFTED → CROSS_CHECKED → TESTED → COUNTRY_READY`

It identifies official gazettes, ministries, labour/public-service authorities, data-protection authorities, courts/jurisprudence sources, social-security bodies, collective-agreement sources and applicable supranational organisations.

### 3.2 Jurisdiction Resolver

Resolves at minimum:

- country and effective date;
- private employment / NGO / enterprise;
- State civil service;
- territorial/local public service;
- sectoral or special statute;
- data protection and sensitive-data constraints;
- competent authority.

### 3.3 Legal Hierarchy Resolver

Resolves legal priority and applicability across constitution, legislation, ordinance, decree, order, special statute, collective agreement, case law and supranational instruments. A special applicable regime must not be silently overridden by a general rule.

### 3.4 Legal Source Verifier

Verifies instrument identifier, date, issuing authority, publication source, effective date, amendment, repeal/replacement and integrity metadata. Emits `SOURCE_VERIFIED`, `SOURCE_CONFLICT` or `SOURCE_INCOMPLETE`.

### 3.5 Country Pack Loader

Loads immutable, versioned `CountryLegalPack` objects without changing core logic.

Minimum contract:

```ts
export interface CountryLegalPack {
  countryCode: string;
  version: string;
  legalLanguages: string[];
  authorities: LegalAuthority[];
  hierarchy: LegalHierarchyEntry[];
  regimes: LegalRegime[];
  sources: LegalSource[];
  regionalLayers: RegionalLayerRef[];
  effectiveFrom: string;
  integrityHash: string;
  status: "DISCOVERED" | "SOURCE_MAPPED" | "SOURCE_VERIFIED" | "RULES_DRAFTED" | "CROSS_CHECKED" | "TESTED" | "COUNTRY_READY";
}
```

### 3.6 Regional/Supranational Layer Resolver

Shared layers include, when legally applicable: OHADA, UEMOA, CEMAC, CEDEAO, EAC, SADC, Union africaine, OIT and other ratified or binding instruments. They are resolved dynamically by jurisdiction, subject matter and date; they are not copied into each country pack.

### 3.7 Legal Interpretation Engine

Produces a structured interpretation that explicitly identifies rule, conditions, exceptions, discretion, prohibitions, hierarchy and provenance. It must not infer beyond verified material.

### 3.8 Rule Compiler

Compiles verified norms into deterministic versioned rules.

```ts
export interface LegalRule {
  ruleId: string;
  countryCode: string;
  regime: string;
  sourceId: string;
  article: string;
  effectiveFrom: string;
  effectiveTo?: string;
  conditions: LegalCondition[];
  exceptions: LegalCondition[];
  requiredFacts: string[];
  status: "RULE_DRAFTED" | "CROSS_CHECKED" | "TESTED" | "TECHNICALLY_VALIDATED" | "REVIEW_REQUIRED" | "REJECTED";
  signatureRequired: boolean;
}
```

### 3.9 Adversarial Legal Reviewer

Before promotion it must search for newer/special instruments, omitted exceptions, competing reasonable interpretations, hierarchy conflicts and non-discrimination failures. Blocking uncertainty yields `REVIEW_REQUIRED`.

### 3.10 Legal Change Monitor

A source modification/repeal must identify impacted rules, invalidate promotion where necessary, trigger regression tests and preserve the previous rule version for rollback.

### 3.11 Decision Trace Generator

Every evaluation emits:

`facts → jurisdiction → regime → national sources → regional/supranational layers → exact articles → rule versions → calculation → verdict → evidence basis → missing facts/conflicts → review/appeal path → audit hash`

No adverse verdict may exist without a complete trace.

## 4. Production invariants

1. No exact article, no production rule.
2. No verified effective status, no adverse decision.
3. Resolve jurisdiction/regime before rule application.
4. No unresolved hierarchy conflict may yield `FAIL`.
5. Same facts + same pack version + same rule version = same verdict.
6. Sensitive data may influence outcomes only when legally necessary and governed.
7. Rule promotion is immutable/versioned; changes create a new version.
8. Human/public authority boundaries remain when law formally requires a signature, authorization or sovereign decision.
9. A country not `COUNTRY_READY` fails closed for adverse automated decisions.
10. Country onboarding must not require modifications to the core engine.

## 5. Country profile model

A country profile is configuration plus corpus, not code duplication.

Examples:

`AGT-LEGAL-AFR-001 + Country Legal Pack ML → Legal Runtime ML`

`AGT-LEGAL-AFR-001 + Country Legal Pack BJ → Legal Runtime BJ`

`AGT-LEGAL-AFR-001 + Country Legal Pack KE → Legal Runtime KE`

The Mali design remains the first profile-level benchmark and must be migrated to this model without losing its legal-rule and audit requirements.

## 6. API contract

Country-agnostic routes:

- `POST /legal/{country}/bootstrap`
- `POST /legal/{country}/sources/verify`
- `POST /legal/{country}/jurisdiction/resolve`
- `POST /legal/{country}/rules/compile`
- `POST /legal/{country}/rules/cross-check`
- `POST /legal/{country}/rules/test`
- `POST /legal/{country}/decision/evaluate`
- `GET /legal/{country}/decision/{id}/trace`
- `GET /legal/{country}/rules/{id}/versions`
- `POST /legal/{country}/rules/{id}/promote`

## 7. Data and security

- country packs and rule versions are immutable once promoted;
- append-only audit trail;
- integrity hashes for sources, packs, rules and decision traces;
- tenant and role isolation;
- test data pseudonymization;
- no silent learning from individual legal decisions;
- rollback to a previous rule/pack version must be demonstrable;
- legal source retrieval and model reasoning are evidence-producing steps, not authority substitutes.

## 8. Testing

Every rule must pass positive, negative, boundary, missing-fact, exception, non-applicable-regime, superseded-source, special-statute conflict, supranational-conflict, non-discrimination and deterministic-replay tests.

Portability test: the African core must run at least two country packs without conditional country-specific code in the core decision engine.

## 9. First proof sequence

1. Migrate Mali to `CountryLegalPack ML`.
2. Compile exact-article Mali territorial recruitment rules.
3. Prove the `21,990 → 170` benchmark with deterministic trace and Lost Talent Recovery handoff.
4. Bootstrap a second African country to prove portability.
5. Run M6 → S7+ → M8, rollback and audit.

## 10. Definition of Done

`AGT-LEGAL-AFR-001` is ready when:

- the core contains no Mali-specific decision logic;
- Mali is loaded only as a Country Legal Pack/Profile;
- at least one second African country runs through the same core;
- regional/supranational overlays resolve automatically;
- no unsourced or stale rule can reach production;
- adverse verdicts are deterministic, replayable and fully traced;
- legal changes trigger impacted-rule review and regression;
- M6, S7+, M8, rollback and audit evidence are green.
