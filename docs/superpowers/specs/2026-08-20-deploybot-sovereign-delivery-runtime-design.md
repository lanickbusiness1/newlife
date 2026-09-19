# DeployBot Sovereign Delivery Runtime™ — Design

**Date:** 2026-08-20  
**Status:** CEO-approved design, implementation pending  
**Canonical parent:** `Genesis Release-to-Revenue Control Plane™ / ADR-0007`  
**Canonical asset:** `INF-DEPLOYBOT-001 — DeployBot AfrIAgenesis®`  
**Scope:** Internal infrastructure capability. No new standalone commercial product is created.

## 1. Purpose

Close the remaining gap between `READY_TO_DEPLOY` and a cryptographically/auditably defensible `DELIVERED_*` state.

The runtime must turn a validated build into a verifiable public or packaged release with:

- authorized deployment-provider execution;
- environment-aware deployment state;
- canonical `*.afriagenesis.com` domain intent;
- DNS resolution evidence;
- HTTPS/TLS evidence;
- healthcheck/smoke evidence;
- rollback/reversibility evidence;
- versioned release metadata;
- a single immutable release evidence bundle consumed by `validationRelay`.

The first dogfood target is the GENESIS MCP service itself.

## 2. Canonical execution chain

```text
CEO VALIDATION
→ Validation Relay
→ Build / CI
→ M6 / S7+ / M8 / Big4-if-required
→ Deployment Orchestrator
→ Provider Adapter
→ Domain Manager Runtime
→ DNS Verification
→ HTTPS/TLS Verification
→ Smoke / Availability Verification
→ Rollback Verification
→ Release Center
→ Release Evidence Bundle
→ Validation Relay terminal decision
→ DELIVERED_URL | DELIVERED_SERVICE | DELIVERED_APK | DELIVERED_AAB | DELIVERED_INFRASTRUCTURE
→ Revenue & Growth Engine when applicable
```

## 3. Architectural decision

Three focused internal components are added under the existing MCP server. They are implementation modules of DeployBot, not catalog products.

### 3.1 `deploymentOrchestrator.ts`

Responsibility: deterministic deployment-state compilation and provider execution contract.

It does not contain provider credentials and does not call a provider directly. Instead it compiles a provider-neutral deployment request and accepts evidence returned by a provider adapter.

Core types:

```ts
export type DeploymentEnvironment = "development" | "staging" | "production";
export type DeploymentProvider = "egreed" | "render" | "railway" | "fly" | "cloudflare" | "vps";
export type DeploymentState =
  | "DEPLOYMENT_PLANNED"
  | "PROVIDER_PENDING"
  | "PROVIDER_DEPLOYED"
  | "DOMAIN_PENDING"
  | "VERIFYING"
  | "RELEASE_READY"
  | "DEPLOYMENT_FAILED"
  | "ROLLED_BACK";

export interface DeploymentRequest {
  assetId: string;
  version: string;
  commitSha: string;
  environment: DeploymentEnvironment;
  provider: DeploymentProvider;
  artifactRef: string;
  healthPath: string;
  desiredHostname?: string;
  sovereigntyDecisionRef: string;
}

export interface ProviderDeploymentEvidence {
  provider: DeploymentProvider;
  deploymentId: string;
  deploymentUrl: string;
  deployedCommitSha: string;
  deployedAt: string;
  providerStatus: "live" | "failed" | "rolled_back";
  providerLogRef?: string;
}
```

Invariants:

- production is impossible without a sovereignty decision reference;
- provider evidence must identify the deployed commit SHA;
- provider-reported `live` is not equivalent to final delivery;
- failed provider execution cannot advance to domain verification;
- rollback transitions terminate the deployment attempt as `ROLLED_BACK`.

### 3.2 `domainManager.ts`

Responsibility: compile and verify the canonical hostname contract for AfrIAgenesis environments.

Core types:

```ts
export type DnsRecordType = "A" | "AAAA" | "CNAME";
export type DomainVerificationState =
  | "DOMAIN_INTENT"
  | "DNS_PENDING"
  | "DNS_VERIFIED"
  | "TLS_PENDING"
  | "HTTPS_VERIFIED"
  | "DOMAIN_FAILED";

export interface DomainIntent {
  hostname: string;
  environment: DeploymentEnvironment;
  recordType: DnsRecordType;
  target: string;
  providerDeploymentId: string;
}

export interface DomainEvidence {
  hostname: string;
  resolvedTargets: string[];
  dnsVerified: boolean;
  tlsVerified: boolean;
  certificateIssuer?: string;
  certificateExpiresAt?: string;
  httpsStatus?: number;
  verifiedAt?: string;
}
```

Canonical naming policy:

- production product/service hostname: `<service>.afriagenesis.com`;
- staging hostname: `<service>-staging.afriagenesis.com`;
- development hostname is not required to be public;
- first dogfood hostname target: `mcp.afriagenesis.com`.

Invariants:

- no `HTTPS_VERIFIED` without `dnsVerified === true` and `tlsVerified === true`;
- a certificate must be valid for the canonical hostname;
- HTTP success on a provider hostname does not prove canonical domain readiness;
- domain verification evidence is observational; DNS mutation is delegated to an authorized adapter.

### 3.3 `releaseCenter.ts`

Responsibility: build the sole delivery authority object: `ReleaseEvidenceBundle`.

Core type:

```ts
export interface ReleaseEvidenceBundle {
  schemaVersion: "1.0.0";
  releaseId: string;
  assetId: string;
  version: string;
  commitSha: string;
  ciRun: string;
  testSummary: string;
  gates: {
    m6: "pass";
    s7plus: "pass";
    m8: "pass";
    big4?: "pass";
  };
  sovereigntyDecisionRef: string;
  provider: ProviderDeploymentEvidence;
  domain?: DomainEvidence;
  finalUrlOrArtifact: string;
  healthcheck: {
    url: string;
    status: number;
    passed: true;
    checkedAt: string;
  };
  rollback: {
    reference: string;
    verified: true;
  };
  changelog: string[];
  remeRef: string;
  generatedAt: string;
  sha256: string;
}
```

The bundle hash is computed from a canonical JSON representation with `sha256` excluded from its own digest input.

## 4. Validation Relay integration

`validationRelay.ts` currently accepts loosely coupled evidence fields. This design upgrades the delivery contract without changing earlier relay states.

New rule:

> `NO RELEASE WITHOUT RELEASE EVIDENCE BUNDLE`.

For URL/service/infrastructure deliveries, a `DELIVERED_*` terminal state requires a valid `ReleaseEvidenceBundle`.

APK/AAB packaging may use the same bundle without `domain`, but still requires artifact integrity, CI, gates, health/package verification where applicable, rollback/reversibility, R.E.M.E reference and bundle hash.

Backward-compatible migration rule:

- existing evidence fields may continue to drive pre-deployment states;
- terminal delivery evaluation uses `releaseEvidenceBundle` when present;
- once this runtime reaches `TEST_PROVEN`, URL/service/infrastructure terminal delivery must fail closed if only legacy loose evidence is supplied.

## 5. Provider adapter boundary

Provider-specific code is isolated behind a minimal interface:

```ts
export interface DeploymentProviderAdapter {
  deploy(request: DeploymentRequest): Promise<ProviderDeploymentEvidence>;
  rollback(deploymentId: string): Promise<{ reference: string; verified: boolean }>;
}
```

The core runtime does not embed Render, EGREED, GoDaddy, Cloudflare, Railway, Fly.io or VPS API logic.

Provider adapters may be added later without changing `validationRelay`, `domainManager` or `releaseCenter` contracts.

Priority order:

1. EGREED adapter when an executable API/connector is available;
2. existing Render deployment path for immediate dogfood evidence;
3. sovereign VPS/runner adapters for workloads requiring stronger residency/control.

## 6. Sovereignty and authorization

The runtime inherits `CORE-027 — No Deployment Without Sovereignty Decision`.

Production requests require:

- `sovereigntyDecisionRef`;
- an allowed environment decision;
- explicit provider authorization in deployment policy;
- A3 delegation for reversible production actions;
- A4 escalation only for an explicit human veto/sensitive action.

The runtime never downgrades a `BLOCK` sovereignty decision.

## 7. Error and recovery semantics

All failures are typed and fail closed.

- provider failure → `DEPLOYMENT_FAILED`;
- DNS mismatch/timeout → remain `DNS_PENDING` or fail `DOMAIN_FAILED` after policy timeout;
- invalid/missing TLS → `TLS_PENDING`/`DOMAIN_FAILED`;
- failed healthcheck → no release bundle;
- rollback proof missing → no terminal delivery;
- commit mismatch between CI and deployed provider evidence → hard failure;
- release bundle SHA mismatch → hard failure;
- `R.E.M.E` reference missing → bundle invalid.

No automatic retry can change the target commit, environment, hostname or provider without recompiling the deployment request and recording a new attempt.

## 8. Release Evidence Bundle validation

The validator must check at least:

1. schema version supported;
2. non-empty release ID, asset ID, version and commit SHA;
3. CI run + test summary present;
4. M6/S7+/M8 `pass`;
5. Big4 `pass` for high/regulated releases when required by caller policy;
6. deployed provider commit equals release commit;
7. provider status is `live`;
8. canonical URL/artifact is present;
9. URL/service delivery has DNS + TLS verified when hostname is under `afriagenesis.com`;
10. healthcheck passed;
11. rollback verified;
12. sovereignty decision reference present;
13. R.E.M.E reference present;
14. SHA-256 recomputes exactly.

## 9. Dogfood release #1

Target: GENESIS MCP service.

Expected release path:

```text
lanickbusiness1/newlife@main
→ MCP CI
→ provider deployment
→ mcp.afriagenesis.com
→ HTTPS
→ /health
→ rollback test/proof
→ ReleaseEvidenceBundle v1
→ validationRelay
→ DELIVERED_SERVICE
→ PRODUCTION_PROVEN only after real provider/domain evidence exists
```

The current `render.yaml` remains a provider configuration, not proof by itself.

## 10. Testing strategy

TDD is mandatory.

Unit tests:

- deployment request validation and state transitions;
- provider commit mismatch rejection;
- environment/sovereignty policy rejection;
- hostname policy compilation;
- DNS/TLS truth table;
- release bundle canonicalization and SHA-256 stability;
- tamper detection;
- terminal relay fail-closed behavior.

Integration tests:

- provider evidence → domain evidence → healthcheck → release bundle → relay terminal state;
- negative path with missing TLS;
- negative path with failed healthcheck;
- negative path with rollback missing;
- high/regulated release with Big4 missing.

No test may use production credentials or real mutable DNS by default.

## 11. MCP tool surface

The first implementation exposes deterministic compile/verify tools only:

- `deploybot.deployment.compile`
- `deploybot.domain.compile`
- `deploybot.release.compile`
- `deploybot.release.verify`

Provider mutation tools are intentionally deferred until a provider adapter can be authenticated and scoped with least privilege.

## 12. Non-goals for this increment

- no new commercial product entry;
- no generic cloud-management platform;
- no embedded DNS provider credentials;
- no automated GoDaddy/Cloudflare mutation without an authorized adapter;
- no billing/FinOps engine duplication;
- no replacement of `Validation Relay`;
- no marketing/revenue logic duplication;
- no production claim without external evidence.

## 13. Definition of Done

This increment is `TEST_PROVEN` when:

- the three modules exist with typed contracts;
- the four MCP tools are registered;
- all TDD unit/integration tests pass;
- existing MCP CI remains green;
- `validationRelay` fails closed for forged/incomplete release bundles;
- bundle tampering is detected;
- no legacy terminal-delivery behavior can bypass the new rule for URL/service/infrastructure after feature activation;
- documentation and R.E.M.E/Notion evidence are updated with commit and CI proof.

It becomes `PRODUCTION_PROVEN` only after a real provider deployment, canonical DNS/HTTPS, healthcheck and rollback proof are captured in a valid bundle for the dogfood MCP release.
