import { describe, expect, test } from "vitest";
import { compileComputeEconomicsPlan } from "../src/computeEconomics";
import { compileReleaseEvidenceBundle, verifyReleaseEvidenceBundle } from "../src/releaseCenter";

const compute = compileComputeEconomicsPlan({
  workload: {
    workloadId: "WL-RELEASE-001",
    dataClassification: "confidential",
    inputTokensPerRequest: 8000,
    outputTokensPerRequest: 2000,
    requestsPerMonth: 5000,
    revenuePerMonthUsd: 9000,
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
    ttftMs: 450,
    interTokenLatencyMs: 35,
    throughputTokensPerSecond: 130,
    qualityScore: 0.87,
    sovereigntyScore: 90,
    lockInScore: 25,
    energyWhPerThousandTokens: 0.7,
    slaPercent: 99.95
  }],
  generatedAt: "2026-08-24T11:25:00Z"
});

const releaseInput = {
  releaseId: "REL-MCP-0.5.0",
  assetId: "INF-DEPLOYBOT-001",
  version: "0.5.0",
  commitSha: "abc123",
  ciRun: "MCP-CI-258",
  testSummary: "all tests passed",
  gates: { m6: "pass" as const, s7plus: "pass" as const, m8: "pass" as const },
  sovereigntyDecisionRef: "SOV-DEPLOY-002",
  aiEconomicsCertificate: compute.certificate,
  provider: {
    provider: "render" as const,
    deploymentId: "dep-2",
    deploymentUrl: "https://provider.example",
    deployedCommitSha: "abc123",
    deployedAt: "2026-08-24T11:26:00Z",
    providerStatus: "live" as const
  },
  domain: {
    hostname: "mcp.afriagenesis.com",
    resolvedTargets: ["provider.example"],
    dnsVerified: true,
    tlsVerified: true,
    certificateIssuer: "Example CA",
    certificateExpiresAt: "2027-08-24T00:00:00Z",
    httpsStatus: 200,
    verifiedAt: "2026-08-24T11:27:00Z"
  },
  finalUrlOrArtifact: "https://mcp.afriagenesis.com",
  healthcheck: {
    url: "https://mcp.afriagenesis.com/health",
    status: 200,
    passed: true as const,
    checkedAt: "2026-08-24T11:28:00Z"
  },
  rollback: { reference: "rollback:dep-2", verified: true as const },
  changelog: ["Add Compute & Inference Economics Control Layer"],
  remeRef: "REME-REL-002",
  generatedAt: "2026-08-24T11:29:00Z"
};

describe("Release Center AI economics integration", () => {
  test("upgrades release evidence schema and embeds the AI Economics Certificate", () => {
    const bundle = compileReleaseEvidenceBundle(releaseInput as any) as any;
    expect(bundle.schemaVersion).toBe("1.1.0");
    expect(bundle.aiEconomicsCertificate.sha256).toBe(compute.certificate.sha256);
  });

  test("rejects a release that re-hashes an internally tampered economics certificate", () => {
    const tamperedCertificate = {
      ...compute.certificate,
      monthlyInferenceCostUsd: compute.certificate.monthlyInferenceCostUsd + 10
    };
    const bundle = compileReleaseEvidenceBundle({
      ...releaseInput,
      aiEconomicsCertificate: tamperedCertificate
    } as any) as any;

    expect(() => verifyReleaseEvidenceBundle(bundle, {
      riskClass: "moderate",
      targetDeliverable: "service"
    })).toThrow(/economics|certificate|sha|tamper/i);
  });
});
