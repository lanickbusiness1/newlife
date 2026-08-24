import { describe, expect, test } from "vitest";
import { compileComputeEconomicsPlan } from "../src/computeEconomics";
import { compileDeploymentRequest, evaluateDeployment } from "../src/deploymentOrchestrator";
import { compileDomainIntent, verifyDomainEvidence } from "../src/domainManager";
import { compileReleaseEvidenceBundle, verifyReleaseEvidenceBundle } from "../src/releaseCenter";
import { compileValidationRelay } from "../src/validationRelay";

const aiEconomicsCertificate = compileComputeEconomicsPlan({
  workload: {
    workloadId: "WL-SOV-DELIVERY",
    dataClassification: "confidential",
    inputTokensPerRequest: 1000,
    outputTokensPerRequest: 500,
    requestsPerMonth: 1000,
    revenuePerMonthUsd: 1000,
    minQualityScore: 0.8,
    maxTtftMs: 1000,
    maxInterTokenLatencyMs: 100
  },
  candidates: [{
    provider: "provider-a",
    model: "model-a",
    accelerator: "gpu-a",
    region: "africa-west",
    inputUsdPerMillionTokens: 1,
    outputUsdPerMillionTokens: 4,
    ttftMs: 500,
    interTokenLatencyMs: 40,
    throughputTokensPerSecond: 120,
    qualityScore: 0.86,
    sovereigntyScore: 88,
    lockInScore: 30,
    energyWhPerThousandTokens: 0.8,
    slaPercent: 99.95
  }],
  generatedAt: "2026-08-20T02:00:00Z"
}).certificate;

function buildServiceBundle(overrides: Record<string, unknown> = {}) {
  const request = compileDeploymentRequest({
    assetId: "INF-DEPLOYBOT-001",
    version: "0.4.0",
    commitSha: "abc123",
    environment: "production",
    provider: "render",
    artifactRef: "oci://afriagenesis/mcp:0.4.0",
    healthPath: "/health",
    desiredHostname: "mcp.afriagenesis.com",
    sovereigntyDecisionRef: "SOV-DEPLOY-001"
  });

  const provider = {
    provider: "render" as const,
    deploymentId: "dep-mcp-1",
    deploymentUrl: "https://provider.example",
    deployedCommitSha: "abc123",
    deployedAt: "2026-08-20T02:00:00Z",
    providerStatus: "live" as const
  };

  expect(evaluateDeployment({ request, providerEvidence: provider }).state).toBe("DOMAIN_PENDING");

  const intent = compileDomainIntent({
    service: "mcp",
    environment: "production",
    recordType: "CNAME",
    target: "provider.example",
    providerDeploymentId: provider.deploymentId
  });

  const domain = {
    hostname: intent.hostname,
    resolvedTargets: ["provider.example"],
    dnsVerified: true,
    tlsVerified: true,
    httpsStatus: 200,
    verifiedAt: "2026-08-20T02:01:00Z"
  };

  expect(verifyDomainEvidence({ intent, evidence: domain }).state).toBe("HTTPS_VERIFIED");

  return compileReleaseEvidenceBundle({
    releaseId: "REL-MCP-0.4.0",
    assetId: request.assetId,
    version: request.version,
    commitSha: request.commitSha,
    ciRun: "MCP-CI-200",
    testSummary: "sovereign delivery suite passed",
    gates: { m6: "pass", s7plus: "pass", m8: "pass" },
    sovereigntyDecisionRef: request.sovereigntyDecisionRef,
    aiEconomicsCertificate,
    provider,
    domain,
    finalUrlOrArtifact: "https://mcp.afriagenesis.com",
    healthcheck: {
      url: "https://mcp.afriagenesis.com/health",
      status: 200,
      passed: true,
      checkedAt: "2026-08-20T02:02:00Z"
    },
    rollback: { reference: "rollback:dep-mcp-1", verified: true },
    changelog: ["DeployBot Sovereign Delivery Runtime 0.4.0", "AI Economics Certificate"],
    remeRef: "REME-REL-MCP-001",
    generatedAt: "2026-08-20T02:03:00Z",
    ...overrides
  } as any);
}

describe("Sovereign Delivery Runtime integration", () => {
  test("provider -> domain -> release bundle -> relay reaches DELIVERED_SERVICE", () => {
    const bundle = buildServiceBundle();
    const verified = verifyReleaseEvidenceBundle(bundle, {
      riskClass: "moderate",
      targetDeliverable: "service"
    });
    expect(verified.valid).toBe(true);

    const relay = compileValidationRelay({
      validationRef: "CEO-VAL-MCP-001",
      assetId: "INF-DEPLOYBOT-001",
      baselineVersion: "0.4.0",
      targetDeliverable: "service",
      riskClass: "moderate",
      sourceRef: "github:lanickbusiness1/newlife",
      releaseEvidenceEnforced: true,
      deploymentPolicy: { stagingAllowed: true, productionDelegated: true },
      budgetEnvelope: { authorized: true },
      evidence: { releaseEvidenceBundle: bundle }
    });

    expect(relay.state).toBe("DELIVERED_SERVICE");
    expect(relay.finalDeliverable).toBe("https://mcp.afriagenesis.com");
  });

  test("missing TLS blocks release verification", () => {
    const bundle = buildServiceBundle({
      domain: {
        hostname: "mcp.afriagenesis.com",
        resolvedTargets: ["provider.example"],
        dnsVerified: true,
        tlsVerified: false,
        httpsStatus: 200
      }
    });
    expect(() => verifyReleaseEvidenceBundle(bundle, { riskClass: "moderate", targetDeliverable: "service" }))
      .toThrow(/TLS/i);
  });

  test("failed healthcheck blocks release verification", () => {
    const bundle = buildServiceBundle({
      healthcheck: {
        url: "https://mcp.afriagenesis.com/health",
        status: 503,
        passed: false,
        checkedAt: "2026-08-20T02:02:00Z"
      }
    });
    expect(() => verifyReleaseEvidenceBundle(bundle, { riskClass: "moderate", targetDeliverable: "service" }))
      .toThrow(/healthcheck/i);
  });

  test("missing rollback proof blocks release verification", () => {
    const bundle = buildServiceBundle({ rollback: { reference: "", verified: false } });
    expect(() => verifyReleaseEvidenceBundle(bundle, { riskClass: "moderate", targetDeliverable: "service" }))
      .toThrow(/rollback/i);
  });

  test("high-risk release fails without Big4 pass", () => {
    const bundle = buildServiceBundle();
    expect(() => verifyReleaseEvidenceBundle(bundle, { riskClass: "high", targetDeliverable: "service" }))
      .toThrow(/Big4/i);
  });
});
