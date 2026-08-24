import { describe, expect, test } from "vitest";
import { compileComputeEconomicsPlan } from "../src/computeEconomics";
import { compileReleaseEvidenceBundle, verifyReleaseEvidenceBundle } from "../src/releaseCenter";

const aiEconomicsCertificate = compileComputeEconomicsPlan({
  workload: {
    workloadId: "WL-MCP-RELEASE",
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
  generatedAt: "2026-08-20T02:03:00Z"
}).certificate;

const baseInput = {
  releaseId: "REL-MCP-0.5.0",
  assetId: "INF-DEPLOYBOT-001",
  version: "0.5.0",
  commitSha: "abc123",
  ciRun: "MCP-CI-200",
  testSummary: "all tests passed",
  gates: { m6: "pass" as const, s7plus: "pass" as const, m8: "pass" as const },
  sovereigntyDecisionRef: "SOV-DEPLOY-001",
  aiEconomicsCertificate,
  provider: {
    provider: "render" as const,
    deploymentId: "dep-1",
    deploymentUrl: "https://provider.example",
    deployedCommitSha: "abc123",
    deployedAt: "2026-08-20T02:00:00Z",
    providerStatus: "live" as const
  },
  domain: {
    hostname: "mcp.afriagenesis.com",
    resolvedTargets: ["provider.example"],
    dnsVerified: true,
    tlsVerified: true,
    certificateIssuer: "Example CA",
    certificateExpiresAt: "2027-08-20T00:00:00Z",
    httpsStatus: 200,
    verifiedAt: "2026-08-20T02:01:00Z"
  },
  finalUrlOrArtifact: "https://mcp.afriagenesis.com",
  healthcheck: {
    url: "https://mcp.afriagenesis.com/health",
    status: 200,
    passed: true as const,
    checkedAt: "2026-08-20T02:02:00Z"
  },
  rollback: { reference: "rollback:dep-1", verified: true as const },
  changelog: ["Add sovereign delivery runtime", "Add AI economics certificate"],
  remeRef: "REME-REL-001",
  generatedAt: "2026-08-20T02:03:00Z"
};

describe("DeployBot Release Center", () => {
  test("generates stable release evidence with AI economics proof", () => {
    const one = compileReleaseEvidenceBundle(baseInput);
    const two = compileReleaseEvidenceBundle(baseInput);
    expect(one.schemaVersion).toBe("1.1.0");
    expect(one.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(two.sha256).toBe(one.sha256);
    expect(one.aiEconomicsCertificate.sha256).toBe(aiEconomicsCertificate.sha256);
  });

  test("requires Big4 for high-risk releases", () => {
    const bundle = compileReleaseEvidenceBundle(baseInput);
    expect(() => verifyReleaseEvidenceBundle(bundle, { riskClass: "high", targetDeliverable: "service" }))
      .toThrow(/Big4/i);
  });

  test("requires canonical DNS and TLS evidence", () => {
    const bundle = compileReleaseEvidenceBundle({
      ...baseInput,
      domain: { ...baseInput.domain, tlsVerified: false }
    });
    expect(() => verifyReleaseEvidenceBundle(bundle, { riskClass: "moderate", targetDeliverable: "service" }))
      .toThrow(/TLS/i);
  });

  test("accepts a complete release and returns both evidence hashes", () => {
    const bundle = compileReleaseEvidenceBundle(baseInput);
    const verification = verifyReleaseEvidenceBundle(bundle, { riskClass: "moderate", targetDeliverable: "service" });
    expect(verification.valid).toBe(true);
    expect(verification.aiEconomicsCertificateSha256).toBe(aiEconomicsCertificate.sha256);
  });
});
