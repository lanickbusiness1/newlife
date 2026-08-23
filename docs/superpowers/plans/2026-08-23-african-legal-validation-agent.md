# African Legal Validation Agent™ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `AGT-LEGAL-AFR-001` as a country-agnostic African legal validation core with versioned Country Legal Packs, regional overlays, deterministic legal rules and auditable decision traces.

**Architecture:** One reusable TypeScript legal core under AfrIA Recruit™. Country-specific law lives in immutable data/config packs, while national and regional applicability is resolved through explicit contracts. Mali is migrated as the first pack; a second African country proves portability before M8.

**Tech Stack:** Next.js 16 / TypeScript / Supabase PostgreSQL + JSONB / existing AfrIA Recruit service and repository patterns / Vitest or existing unit-test runner / Playwright where UI evidence is added.

**Spec:** `docs/superpowers/specs/2026-08-23-african-legal-validation-agent-design.md`

## Global Constraints

- No country-specific decision logic in the core engine.
- No exact article + verified effective status = no adverse production rule.
- A generative model may draft interpretation/rules; deterministic code executes verdicts.
- Same facts + same pack version + same rule version = same verdict.
- Country not `COUNTRY_READY` fails closed for adverse automated decisions.
- Preserve current AfrIA Recruit security/RLS patterns; no synthetic production pollution.
- M6 → S7+ → M8 + rollback + audit evidence required before production decisioning.

---

### Task 1: Canonical legal domain contracts

**Files:**
- Create: `apps/afria-recruit/lib/legal/types.ts`
- Create: `apps/afria-recruit/tests/unit/legal-types.test.ts`

**Interfaces:**
- Produces: `CountryLegalPack`, `LegalSource`, `LegalRegime`, `RegionalLayerRef`, `LegalRule`, `LegalDecision`, `DecisionTrace`, `CountryReadinessStatus`.

- [ ] Write failing compile/runtime contract tests that construct a valid Mali pack and reject missing `countryCode`, `version`, `integrityHash`, `status`, source/article provenance and unsupported verdict values.
- [ ] Run the unit test and verify failure because `lib/legal/types.ts` does not exist.
- [ ] Implement the minimal domain types and runtime assertion helpers `assertCountryLegalPack()` and `assertLegalRule()`.
- [ ] Run the test suite and verify PASS.
- [ ] Commit with `feat(legal): add pan-African legal domain contracts`.

### Task 2: Country Pack Loader

**Files:**
- Create: `apps/afria-recruit/lib/legal/country-pack-loader.ts`
- Create: `apps/afria-recruit/lib/legal/packs/ml.v0.1.ts`
- Test: `apps/afria-recruit/tests/unit/country-pack-loader.test.ts`

**Interfaces:**
- Consumes: `CountryLegalPack`.
- Produces: `loadCountryLegalPack(countryCode, version?)` and `listCountryPackVersions(countryCode)`.

- [ ] Write failing tests proving `ML` loads from data/config, unknown countries fail closed, and loader code contains no `if (country === "ML")` decision branch.
- [ ] Run tests and verify RED.
- [ ] Implement registry-based loading using a map of pack factories keyed by ISO code/version.
- [ ] Encode Mali source registry metadata already approved in the Country Legal Pack; do not encode candidate decisions yet.
- [ ] Run tests and verify GREEN.
- [ ] Commit with `feat(legal): add country pack loader and Mali profile`.

### Task 3: Jurisdiction and legal hierarchy resolvers

**Files:**
- Create: `apps/afria-recruit/lib/legal/jurisdiction-resolver.ts`
- Create: `apps/afria-recruit/lib/legal/hierarchy-resolver.ts`
- Test: `apps/afria-recruit/tests/unit/jurisdiction-resolver.test.ts`
- Test: `apps/afria-recruit/tests/unit/hierarchy-resolver.test.ts`

**Interfaces:**
- Produces: `resolveJurisdiction(context, pack)` and `resolveApplicableSources(jurisdiction, effectiveDate, pack, regionalLayers)`.

- [ ] Write RED tests distinguishing private employment, State civil service and territorial public service for Mali.
- [ ] Add RED tests showing a special statute outranks a general rule when applicability is proven, and unresolved conflicts return `REVIEW_REQUIRED` metadata instead of selecting a source silently.
- [ ] Implement deterministic resolution from pack metadata.
- [ ] Run both test files and verify GREEN.
- [ ] Commit with `feat(legal): resolve jurisdiction and legal hierarchy`.

### Task 4: Regional/Supranational Layer Resolver

**Files:**
- Create: `apps/afria-recruit/lib/legal/regional-layer-resolver.ts`
- Create: `apps/afria-recruit/lib/legal/layers/registry.ts`
- Test: `apps/afria-recruit/tests/unit/regional-layer-resolver.test.ts`

**Interfaces:**
- Produces: `resolveRegionalLayers(countryCode, subject, effectiveDate)`.

- [ ] Write failing tests that attach only explicitly applicable layers and never assume OHADA/UEMOA/CEMAC/CEDEAO/EAC/SADC/OIT applicability solely from geography.
- [ ] Implement a registry driven by membership/effectivity/subject metadata.
- [ ] Verify no layer is copied into the Mali pack payload.
- [ ] Run tests and verify GREEN.
- [ ] Commit with `feat(legal): add shared regional legal overlays`.

### Task 5: Source verification and effective-status graph

**Files:**
- Create: `apps/afria-recruit/lib/legal/source-verifier.ts`
- Create: `apps/afria-recruit/lib/legal/source-graph.ts`
- Test: `apps/afria-recruit/tests/unit/source-verifier.test.ts`

**Interfaces:**
- Produces: `verifyLegalSource(source)` and `resolveEffectiveInstrument(sourceId, date, graph)`.

- [ ] Write RED tests for modified, repealed, replaced, future-effective and conflicting instruments.
- [ ] Implement evidence-status evaluation using source metadata only; no LLM confidence score may substitute for source state.
- [ ] Return `SOURCE_VERIFIED`, `SOURCE_CONFLICT` or `SOURCE_INCOMPLETE`.
- [ ] Run tests and verify GREEN.
- [ ] Commit with `feat(legal): verify source lineage and effectivity`.

### Task 6: Rule compiler and deterministic evaluator

**Files:**
- Create: `apps/afria-recruit/lib/legal/rule-compiler.ts`
- Create: `apps/afria-recruit/lib/legal/rule-evaluator.ts`
- Test: `apps/afria-recruit/tests/unit/legal-rule-evaluator.test.ts`

**Interfaces:**
- Produces: `compileLegalRule(draft, verifiedSources)` and `evaluateLegalRules(facts, rules, context)`.

- [ ] Write RED tests proving a rule without exact article/effective status cannot become `TECHNICALLY_VALIDATED`.
- [ ] Write RED tests for `PASS`, `FAIL`, `REVIEW_REQUIRED`, missing facts and deterministic replay.
- [ ] Implement rule compilation as validation/normalization; do not let free-form model text execute directly.
- [ ] Implement evaluator using explicit conditions/exceptions only.
- [ ] Run tests twice with identical inputs and assert identical serialized output.
- [ ] Commit with `feat(legal): compile and evaluate deterministic legal rules`.

### Task 7: Adversarial legal review harness

**Files:**
- Create: `apps/afria-recruit/lib/legal/adversarial-review.ts`
- Create: `apps/afria-recruit/lib/legal/legal-test-harness.ts`
- Test: `apps/afria-recruit/tests/unit/legal-adversarial-review.test.ts`

**Interfaces:**
- Produces: `crossCheckRule(rule, evidenceSet)` and `runLegalRuleTestMatrix(rule, fixtures)`.

- [ ] Write failing tests for omitted exceptions, superseded sources, special-statute conflict, non-discrimination, adjacent non-applicable regime and supranational conflict.
- [ ] Implement cross-check output with blocking findings and `CROSS_CHECKED` only when all mandatory checks pass.
- [ ] Implement reusable legal test matrix runner.
- [ ] Run tests and verify GREEN.
- [ ] Commit with `feat(legal): add adversarial legal rule verification`.

### Task 8: Decision Trace and append-only Legal Audit Ledger

**Files:**
- Create: `apps/afria-recruit/lib/legal/decision-trace.ts`
- Create: `apps/afria-recruit/lib/legal/legal-audit-ledger.ts`
- Test: `apps/afria-recruit/tests/unit/legal-decision-trace.test.ts`

**Interfaces:**
- Produces: `buildDecisionTrace(...)`, `hashDecisionTrace(trace)`, `appendLegalAuditRecord(record)`.

- [ ] Write RED tests asserting every `FAIL` has facts, jurisdiction, source IDs, exact articles, rule versions, verdict, conflicts/missing facts, review path and hash.
- [ ] Implement canonical JSON serialization and SHA-256 hashing consistent with repository audit patterns.
- [ ] Reject mutation/rewrite of an existing audit record identifier.
- [ ] Run tests and verify GREEN.
- [ ] Commit with `feat(legal): add legal decision trace and audit ledger`.

### Task 9: Country-agnostic API boundary

**Files:**
- Create: `apps/afria-recruit/app/api/legal/[country]/decision/evaluate/route.ts`
- Create: `apps/afria-recruit/app/api/legal/[country]/jurisdiction/resolve/route.ts`
- Create: `apps/afria-recruit/app/api/legal/[country]/rules/compile/route.ts`
- Test: `apps/afria-recruit/tests/unit/legal-api.test.ts`

**Interfaces:**
- Consumes core legal services only.
- Produces HTTP contracts matching the canonical spec.

- [ ] Write RED tests for valid ML requests, unknown country, non-`COUNTRY_READY` pack, incomplete source evidence and traceable `REVIEW_REQUIRED`.
- [ ] Implement routes with existing auth/error conventions.
- [ ] Confirm no route contains Mali-specific law logic.
- [ ] Run tests and production typecheck/build on the Candidate OS branch stack.
- [ ] Commit with `feat(legal): expose country-agnostic legal API`.

### Task 10: Mali exact-article benchmark

**Files:**
- Create: `apps/afria-recruit/lib/legal/packs/ml/rules/territorial-recruitment.ts`
- Create: `apps/afria-recruit/tests/fixtures/legal/ml-territorial-health-2026.ts`
- Test: `apps/afria-recruit/tests/unit/ml-territorial-recruitment.test.ts`

**Interfaces:**
- Produces first validated ML rule set and benchmark fixtures.

- [ ] Add only rules whose exact article, effective status and official source have been verified from the Country Legal Pack evidence.
- [ ] Encode fixtures distinguishing eligible/not-ranked, legally ineligible, documentary review, quota/special-rule review and unresolved ambiguity.
- [ ] Run adversarial matrix and deterministic replay.
- [ ] Verify Lost Talent Recovery handoff receives only recruitment outcome category and permitted skills metadata, not unnecessary sensitive legal facts.
- [ ] Commit with `feat(legal): prove Mali territorial recruitment benchmark`.

### Task 11: Legal Country Bootstrap Engine™

**Files:**
- Create: `apps/afria-recruit/lib/legal/country-bootstrap.ts`
- Create: `apps/afria-recruit/lib/legal/bootstrap-types.ts`
- Test: `apps/afria-recruit/tests/unit/country-bootstrap.test.ts`

**Interfaces:**
- Produces: `bootstrapCountryLegalProfile(input)` returning source map, gaps, status and draft pack; never auto-promotes to `COUNTRY_READY` without verification/test gates.

- [ ] Write RED tests for source discovery output, missing official gazette, incomplete authority map and deterministic status transitions.
- [ ] Implement bootstrap state machine `DISCOVERED → SOURCE_MAPPED → SOURCE_VERIFIED → RULES_DRAFTED → CROSS_CHECKED → TESTED → COUNTRY_READY`.
- [ ] Keep network/source acquisition behind an adapter so unit tests use fixtures.
- [ ] Run tests and verify GREEN.
- [ ] Commit with `feat(legal): add country legal bootstrap engine`.

### Task 12: Second-country portability proof

**Files:**
- Create: `apps/afria-recruit/lib/legal/packs/bj.v0.1.ts` or another already-authorized African Country Legal Pack.
- Test: `apps/afria-recruit/tests/unit/legal-core-portability.test.ts`

**Interfaces:**
- Reuses every core function unchanged.

- [ ] Create a second Country Pack from verified legal-source metadata; do not add country conditionals to core code.
- [ ] Write a portability test loading ML and the second country through the same interfaces.
- [ ] Assert core source files contain no ISO-specific branching for `ML` or the second country.
- [ ] Run tests and verify GREEN.
- [ ] Commit with `test(legal): prove multi-country portability`.

### Task 13: Legal change monitoring, rollback and M6/S7+/M8 evidence

**Files:**
- Create: `apps/afria-recruit/lib/legal/legal-change-monitor.ts`
- Create: `apps/afria-recruit/tests/unit/legal-change-monitor.test.ts`
- Create: `docs/releases/2026-08-23-african-legal-validation-agent-evidence.md`
- Create or modify appropriate CI workflow for AfrIA Recruit Candidate OS.

**Interfaces:**
- Produces impacted-rule set, invalidation/review state and rollback proof.

- [ ] Write RED test: a source repeal/change marks dependent promoted rules for review and blocks stale adverse evaluation.
- [ ] Implement impact graph and immutable previous-version rollback.
- [ ] Add CI gates for legal unit tests, typecheck, build, source scans and deterministic replay.
- [ ] Execute M6 security review, S7+ resilience/recovery, M8 legal/algorithmic control matrix and rollback/re-apply proof.
- [ ] Record exact commit, workflow run, test counts and remaining external boundaries in the evidence doc.
- [ ] Commit with `chore(legal): close validation evidence gates`.

## Final Acceptance

The implementation is acceptable only if `AGT-LEGAL-AFR-001` runs Mali and a second African country through the same core without duplicated agent logic, all adverse decisions fail closed on missing/stale evidence, every verdict is replayable with a full legal trace, and M6/S7+/M8 plus rollback evidence are green.
