# AGT-LEGAL-ML-001 — Mali Legal Validation Agent™ — Design canonique Genesis V4

**Status:** Design approved — canonical specification  
**Agent ID:** `AGT-LEGAL-ML-001`  
**Product parent:** AfrIA Recruit™ (`PRD-RECRUIT-001`)  
**Subsystem:** Government Workforce OS™  
**Runtime:** Mali Legal Rules Engine™  
**Canonical corpus:** Country Legal Pack Mali™  
**First proof case:** Mali territorial health recruitment — `21,990 candidates → 170 positions`

## 1. Mission

Transform Mali legal sources applicable to employment, labour law, State civil service and territorial civil service into executable, explainable and auditable rules. No unsourced interpretation may be promoted to a production rule.

## 2. Architecture

AGT-LEGAL-ML-001 is a single supervising agent with five specialized internal capabilities.

### 2.1 Legal Source Verifier

- verify instrument type, number, date, issuing authority and publication;
- verify official or institutional source;
- detect amendment, repeal, replacement and effective date;
- emit `SOURCE_VERIFIED`, `SOURCE_CONFLICT` or `SOURCE_INCOMPLETE`;
- preserve URL, version, retrieval date and integrity metadata.

### 2.2 Legal Interpretation Engine

- resolve the applicable legal regime before interpreting a rule;
- distinguish general rule, special regime, cumulative condition, exception, discretion and prohibition;
- produce a concise structured interpretation with provenance;
- prohibit inference beyond the verified legal text and its applicable context.

### 2.3 Rule Compiler

Transforms a validated norm into a deterministic rule object.

```json
{
  "rule_id": "ML-TERR-ELIG-001",
  "country": "ML",
  "regime": "territorial_public_service",
  "source_id": "ML-TERR-001",
  "article": "ARTICLE_EXACT",
  "effective_from": "YYYY-MM-DD",
  "conditions": [],
  "exceptions": [],
  "required_facts": [],
  "decision": "PASS|FAIL|REVIEW_REQUIRED",
  "human_signature_required": false
}
```

### 2.4 Adversarial Legal Reviewer

Before rule promotion it must:

- search for newer or more specific instruments;
- search for omitted exceptions;
- test a reasonable competing interpretation;
- detect conflicts between law, decree, order, special statute or collective agreement;
- emit `CROSS_CHECKED` only when no blocking contradiction remains.

### 2.5 Decision Trace Generator

Every decision must emit:

`fact → regime → source → article → rule → calculation → verdict → evidence level → missing elements → review/appeal path`

No `FAIL` may exist without this trace.

## 3. Rule lifecycle

Canonical lifecycle:

`DISCOVERED → SOURCE_VERIFIED → RULE_DRAFTED → CROSS_CHECKED → TESTED → TECHNICALLY_VALIDATED`

Alternative terminal or holding states:

- `REVIEW_REQUIRED` — substantial ambiguity or insufficient facts;
- `SOURCE_CONFLICT` — incompatible source/version evidence;
- `SIGNATURE_REQUIRED` — law reserves the act to a competent human/public authority;
- `REJECTED` — rule cannot be demonstrated from the evidence.

## 4. Non-negotiable invariants

1. No exact article, no production rule.
2. No verified effective status, no adverse decision.
3. Resolve legal regime before applying rules.
4. Apply the special regime over the general regime when legally applicable.
5. Sensitive information may influence a decision only when legally necessary and explicitly governed.
6. Any rule that excludes, ranks or changes a candidate's rights must produce a complete trace.
7. A generative model never directly assigns `FAIL`; it proposes a rule and a deterministic engine executes it.
8. Any unresolved legal conflict produces `REVIEW_REQUIRED`, never extrapolation.

## 5. Source hierarchy

1. Official Gazette / Secrétariat général du Gouvernement du Mali.
2. Competent ministry or public authority.
3. Applicable supranational institutions.
4. Institutional legal databases such as ILO/NATLEX.
5. Secondary commentary only for context, never as the sole basis of a binding rule.

## 6. Input contracts

Minimum legal input:

- `legal_source`;
- `context`: private / State / territorial authority / special regime;
- `use_case`;
- `effective_date`;
- `facts_schema`;
- `target_decision`;
- `source_registry_snapshot`.

Candidate-related facts must be minimized and pseudonymized for testing. Disability or other sensitive data is processed only when legally necessary and under the applicable data-governance controls.

## 7. Output contracts

Each evaluation returns:

- `applicable_regime`;
- `applicable_sources[]`;
- `applicable_rules[]`;
- `decision`: `PASS|FAIL|REVIEW_REQUIRED|NOT_APPLICABLE`;
- `decision_trace[]`;
- `missing_facts[]`;
- `conflicts[]`;
- `confidence_basis` derived from evidence quality, not model self-confidence;
- `signature_required`;
- `audit_hash`.

## 8. Legal test harness

Every rule must pass:

- positive nominal case;
- negative nominal case;
- boundary value;
- missing fact;
- statutory exception;
- adjacent but non-applicable regime;
- superseded legal text;
- conflict with a special statute;
- non-discrimination test;
- deterministic reproducibility test.

Determinism invariant: same facts + same corpus version + same rule version = same verdict.

## 9. First benchmark — Mali territorial health recruitment 2026

Pipeline:

`official notice → opening instrument → positions/corps → ML-TERR-001 → ML-DIS-001 → health special statutes → published criteria → machine rules → adversarial tests → eligibility → compliant ranking → quota/equal opportunity → assignment → Lost Talent Recovery Engine™`

The engine must distinguish at minimum:

- legally eligible but not ranked high enough;
- legally ineligible;
- documentary verification required;
- quota/special rule evaluation required;
- unresolved legal ambiguity requiring `REVIEW_REQUIRED`.

## 10. Security and governance

- data minimization and pseudonymization in tests;
- append-only decision/audit logs;
- immutable rule versioning;
- rollback to prior rule versions;
- separation of draft / validated / production rules;
- role-based access control;
- no silent learning from individual legal decisions;
- every improvement must rerun tests and promotion gates.

## 11. Human escalation is exceptional, not a dependency

Escalate only when:

- an official text is unavailable or contradictory;
- a decisive constitutional/jurisprudential issue remains unresolved;
- a reasonably contestable interpretation could cause an adverse outcome;
- the law formally requires a signature, authorization or decision by a competent authority;
- a recent regulatory change has not been consolidated.

## 12. Target API

- `POST /legal/ml/sources/verify`
- `POST /legal/ml/rules/compile`
- `POST /legal/ml/rules/cross-check`
- `POST /legal/ml/rules/test`
- `POST /legal/ml/decision/evaluate`
- `GET /legal/ml/decision/{id}/trace`
- `GET /legal/ml/rules/{id}/versions`
- `POST /legal/ml/rules/{id}/promote`

## 13. Definition of Done

AGT-LEGAL-ML-001 is ready when:

1. P0 corpus is versioned and resolved by legal regime.
2. Rules for the territorial recruitment proof case are compiled with exact articles.
3. Every rule has automated adversarial tests.
4. No unsourced rule can reach production.
5. Verdicts are deterministic and replayable.
6. Full legal decision trace is generated.
7. M6 security, S7+ resilience and M8 legal/algorithmic controls are green.
8. Rollback and audit are demonstrated.

## 14. Architecture decision

**Selected architecture:** one supervising legal agent with specialized internal capabilities. This preserves separation of concerns, contradiction testing and end-to-end evidence without unnecessary multi-agent orchestration overhead.

## 15. Responsibility boundary

AGT-LEGAL-ML-001 may produce automated technical legal validation and promote rules when source, contradiction and testing gates are satisfied. It does not impersonate or replace a public or professional authority where applicable law formally requires a human signature, authorization or legally competent decision-maker.
