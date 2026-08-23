# AGT-LEGAL-ML-001 — Mali Country Legal Profile™

**Status:** Country profile / compatibility specification — NOT an independent legal core  
**Parent agent:** `AGT-LEGAL-AFR-001 — African Legal Validation Agent™`  
**Parent spec:** `docs/superpowers/specs/2026-08-23-african-legal-validation-agent-design.md`  
**ADR:** `ADR-LEGAL-AFR-001 — One African Legal Core, Many Country Legal Profiles™`  
**Product:** AfrIA Recruit™ (`PRD-RECRUIT-001`)  
**Country:** Mali (`ML`)  
**Canonical corpus:** Country Legal Pack Mali™  
**Proof case:** territorial health recruitment 2026 — `21,990 candidates → 170 positions`

## Architecture status

`AGT-LEGAL-ML-001` no longer represents a separate agent implementation. It is the Mali runtime/profile of the shared African core:

`AGT-LEGAL-AFR-001 + Country Legal Pack ML → Legal Runtime ML`

All source verification, hierarchy resolution, rule compilation, adversarial review, deterministic evaluation, change monitoring and decision tracing MUST use the shared African core.

## Mali-specific legal regimes

The Mali pack must distinguish at minimum:

- private employment / NGO / enterprise;
- State civil service;
- territorial/local public service;
- sectoral and special statutes;
- collective agreements where applicable;
- personal-data and sensitive-data rules.

The Labour Code must not be treated as the default governing source for public officials subject to special statutory regimes.

## P0 source registry

The country pack includes, subject to exact-article/effective-status verification before rule promotion:

- `ML-LAB-001` — Loi n°92-020 du 23 septembre 1992 portant Code du travail, as amended;
- `ML-LAB-002` — Décret n°96-178/P-RM du 13 juin 1996 and applicable amendments;
- `ML-LAB-003` — Arrêté n°2024-4363/MTFPDS-SG du 27 décembre 2024;
- `ML-SOC-001` — Code de prévoyance sociale and amendments;
- `ML-PUB-001` — Ordonnance n°2026-003/PT-RM du 2 mars 2026 portant Statut général des fonctionnaires;
- `ML-TERR-001` — Loi n°2018-035 du 27 juin 2018 portant Statut des fonctionnaires des Collectivités territoriales;
- `ML-DIS-001` — Loi n°2018-027 du 12 juin 2018 and Décret n°2021-0662/PT-RM du 23 septembre 2021 concerning disability rights/equal opportunity;
- `ML-DATA-001` — Loi n°2013-015 du 21 mai 2013 on personal-data protection;
- `ML-COLLECTIVE-001` — applicable sectoral collective agreements.

## Mali benchmark

Pipeline:

`official competition notice → opening instrument → positions/corps → jurisdiction resolution → ML-TERR-001 + applicable special statutes → ML-DIS-001 when legally relevant → exact published criteria → deterministic rules → adversarial tests → eligibility → compliant ranking controls → assignment → Lost Talent Recovery Engine™`

The system must distinguish:

- legally eligible but not ranked high enough;
- legally ineligible with exact trace;
- documentary verification required;
- quota/special-rule evaluation required;
- unresolved ambiguity requiring `REVIEW_REQUIRED`.

## Mali invariants

1. No exact article, no adverse production rule.
2. No verified effective status, no adverse production rule.
3. Same facts + same ML pack version + same rule version = same verdict.
4. An unresolved conflict between general and special statutes yields `REVIEW_REQUIRED`.
5. Sensitive candidate facts are minimized and used only where legally necessary.
6. The Mali pack MUST NOT introduce Mali-specific branching inside the shared core.
7. Human/public-authority signature remains required only where applicable law formally reserves the act to a competent authority.

## Promotion gate

Mali becomes `COUNTRY_READY` only after the P0 corpus is versioned, exact-article rules for the benchmark are compiled, adversarial tests pass, decision traces are replayable, and M6 → S7+ → M8 plus rollback/audit evidence are green.
