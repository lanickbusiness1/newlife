# DeployBot Sovereign Delivery Runtime™ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DeployBot produce and verify a sovereign, tamper-evident release proof before `validationRelay` may emit URL/service/infrastructure `DELIVERED_*` states.

**Architecture:** Add three deterministic modules under the existing MCP server: deployment orchestration, canonical domain verification, and release-evidence compilation/verification. Keep provider mutation behind adapters and integrate terminal delivery into the existing Validation Relay. Register four deterministic MCP tools using the existing governed `deploy:plan` scope.

**Tech Stack:** Node.js >=20, TypeScript 5.9, Vitest 3.2, Node `crypto`, existing MCP SDK/Zod.

**Spec:** `docs/superpowers/specs/2026-08-20-deploybot-sovereign-delivery-runtime-design.md`

## Global Constraints

- No new standalone catalog product; this remains `INF-DEPLOYBOT-001` under ADR-0007.
- TDD RED -> GREEN is mandatory for every behavior change.
- No provider/DNS credentials in core modules.
- No production claim from configuration alone.
- URL/service/infrastructure terminal delivery fails closed without a valid Release Evidence Bundle once enforcement is active.
- APK/AAB remain package-compatible and do not require public DNS.
- No additional runtime dependency is required.

---

### Task 1: Deployment Orchestrator

**Files:**
- Create: `services/mcp-server/tests/deploymentOrchestrator.test.ts`
- Create: `services/mcp-server/src/deploymentOrchestrator.ts`

**Interfaces:**
- Produces: `compileDeploymentRequest(input)`, `evaluateDeployment(input)`, `DeploymentRequest`, `ProviderDeploymentEvidence`, `DeploymentState`.
- Rejects missing sovereignty decision for production and provider commit mismatches.

- [ ] Write tests proving production requires `sovereigntyDecisionRef`, provider evidence must match `commitSha`, live provider evidence advances to `DOMAIN_PENDING`, failed evidence returns `DEPLOYMENT_FAILED`, and rollback evidence returns `ROLLED_BACK`.
- [ ] Run `npm test -- deploymentOrchestrator.test.ts` and record RED because the module is absent.
- [ ] Implement the minimal deterministic state compiler.
- [ ] Run the focused test and full `npm test`, then `npm run typecheck`.

### Task 2: Domain Manager Runtime

**Files:**
- Create: `services/mcp-server/tests/domainManager.test.ts`
- Create: `services/mcp-server/src/domainManager.ts`

**Interfaces:**
- Consumes: `DeploymentEnvironment` from Task 1.
- Produces: `compileDomainIntent(input)`, `verifyDomainEvidence(input)`, `DomainIntent`, `DomainEvidence`, `DomainVerificationState`.

- [ ] Write tests proving `mcp.afriagenesis.com`/`mcp-staging.afriagenesis.com` naming, DNS-before-TLS ordering, canonical-hostname enforcement, and provider-hostname non-equivalence.
- [ ] Run focused test and record RED.
- [ ] Implement hostname compilation and observational DNS/TLS verification only.
- [ ] Run focused/full tests and typecheck.

### Task 3: Release Center and Tamper-Evident Bundle

**Files:**
- Create: `services/mcp-server/tests/releaseCenter.test.ts`
- Create: `services/mcp-server/src/releaseCenter.ts`

**Interfaces:**
- Consumes: `ProviderDeploymentEvidence` and `DomainEvidence`.
- Produces: `compileReleaseEvidenceBundle(input)`, `verifyReleaseEvidenceBundle(bundle, policy)`, `ReleaseEvidenceBundle`.

- [ ] Write tests for stable SHA-256, tamper rejection, commit mismatch rejection, missing M6/S7+/M8 rejection, Big4 enforcement for high/regulated policy, DNS/TLS enforcement for canonical URL/service releases, healthcheck/rollback/R.E.M.E requirements.
- [ ] Run focused test and record RED.
- [ ] Implement canonical JSON normalization, SHA-256 generation, and fail-closed verification.
- [ ] Run focused/full tests and typecheck.

### Task 4: Validation Relay Terminal Enforcement

**Files:**
- Modify: `services/mcp-server/tests/validationRelay.test.ts`
- Modify: `services/mcp-server/src/validationRelay.ts`

**Interfaces:**
- Adds `releaseEvidenceBundle?: ReleaseEvidenceBundle` and `releaseEvidenceEnforced?: boolean` to relay evidence/policy.
- URL/service/infrastructure terminal state requires verified bundle when enforcement is active.

- [ ] Add failing tests proving legacy loose evidence can no longer forge URL/service/infrastructure terminal delivery under enforcement, a valid bundle reaches `DELIVERED_SERVICE`, and APK/AAB compatibility is preserved.
- [ ] Run focused test and record RED.
- [ ] Integrate `verifyReleaseEvidenceBundle` without changing pre-deployment relay states.
- [ ] Run focused/full tests and typecheck.

### Task 5: MCP Tool Registration and Version Surface

**Files:**
- Modify: `services/mcp-server/src/index.ts`
- Modify: `services/mcp-server/package.json`
- Test: existing MCP smoke/CI plus new unit suite.

**Interfaces:**
- Register `deploybot.deployment.compile`, `deploybot.domain.compile`, `deploybot.release.compile`, `deploybot.release.verify` with scope `deploy:plan`.
- Bump MCP package version to `0.4.0` and control-plane revision to `0.7.0`.

- [ ] Add/extend tests or static assertions that the four tools are surfaced.
- [ ] Record RED before tool registration/version bump.
- [ ] Register the tools using existing `register(...)` governance wrapper and expose runtime identity in `/health`.
- [ ] Run `npm test`, `npm run typecheck`, and `npm run build`.

### Task 6: Integration Proof and Evidence Sync

**Files:**
- Create: `services/mcp-server/tests/sovereignDelivery.integration.test.ts`
- Update: `docs/superpowers/specs/2026-08-20-deploybot-sovereign-delivery-runtime-design.md` only if implementation evidence requires a status appendix.

**Interfaces:**
- Exercises provider evidence -> domain evidence -> bundle -> Validation Relay `DELIVERED_SERVICE` and negative TLS/health/rollback/Big4 paths.

- [ ] Write integration test first and record RED if any contract is incomplete.
- [ ] Make only the minimum corrections needed for GREEN.
- [ ] Run complete `npm test`, `npm run typecheck`, `npm run build`, and dependency audit through existing CI.
- [ ] Record head SHA, CI run, test counts and final `TEST_PROVEN` boundary; keep `PRODUCTION_PROVEN` false until real provider/DNS/HTTPS/rollback evidence exists.
