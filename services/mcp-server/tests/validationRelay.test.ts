import { describe, expect, test } from "vitest";
import { compileComputeEconomicsPlan } from "../src/computeEconomics";
import { compileReleaseEvidenceBundle } from "../src/releaseCenter";
import {
  compileValidationRelay,
  type ValidationRelayInput
} from "../src/validationRelay";

const aiEconomicsCertificate = compileComputeEconomicsPlan({
  workload: {
    workloadId: "WL-VALIDATION-RELAY",
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

const baseInput: ValidationRelayInput = {
  validationRef: "CEO-VAL-2026-08-18-001",
  assetId: "INF-DEPLOYBOT-001",
  baselineVersion: "v1.0",
  targetDeliverable: "url",
  riskClass: "moderate",
  sourceRef: "github:lanickbusiness1/newlife",
  budgetEnvelope: { authorized: true },
  deploymentPolicy: {
    stagingAllowed: true,
    productionDelegated: true
  }
};

function serviceBundle() {
  return compileReleaseEvidenceBundle({
    releaseId: "REL-MCP-0.4.0",
    assetId: "INF-DEPLOYBOT-001",
    version: "0.4.0",
    commitSha: "abc123",
    ciRun: "run-release",
    testSummary: "all tests passed",
    gates: { m6: "pass", s7plus: "pass", m8: "pass" },
    sovereigntyDecisionRef: "SOV-DEPLOY-001",
    aiEconomicsCertificate,
    provider: {
      provider: "render",
      deploymentId: "dep-1",
      deploymentUrl: "https://provider.example",
      deployedCommitSha: "abc123",
      deployedAt: "2026-08-20T02:00:00Z",
      providerStatus: "live"
    },
    domain: {
      hostname: "mcp.afriagenesis.com",
      resolvedTargets: ["provider.example"],
      dnsVerified: true,
      tlsVerified: true,
      httpsStatus: 200,
      verifiedAt: "2026-08-20T02:01:00Z"
    },
    finalUrlOrArtifact: "https://mcp.afriagenesis.com",
    healthcheck: {
      url: "https://mcp.afriagenesis.com/health",
      status: 200,
      passed: true,
      checkedAt: "2026-08-20T02:02:00Z"
    },
    rollback: { reference: "rollback:dep-1", verified: true },
    changelog: ["Sovereign Delivery Runtime", "AI Economics Certificate"],
    remeRef: "REME-REL-001",
    generatedAt: "2026-08-20T02:03:00Z"
  });
}

describe("GENESIS V4 CEO Validation Relay", () => {
  test("takes the relay automatically after CEO validation and asks for build evidence next", () => {
    const output = compileValidationRelay(baseInput);

    expect(output.continueAutomatically).toBe(true);
    expect(output.humanApprovalRequired).toBe(false);
    expect(output.autonomyLevel).toBe("A3");
    expect(output.state).toBe("SOURCE_PROVEN");
    expect(output.nextAction).toMatch(/build/i);
  });

  test("stops only on an explicit A4 veto", () => {
    const output = compileValidationRelay({
      ...baseInput,
      a4Vetoes: ["legal_commitment"]
    });

    expect(output.state).toBe("BLOCKED_A4");
    expect(output.continueAutomatically).toBe(false);
    expect(output.humanApprovalRequired).toBe(true);
    expect(output.blockers).toContain("A4:legal_commitment");
  });

  test("never claims a delivered URL without gates, healthcheck and rollback evidence", () => {
    const output = compileValidationRelay({
      ...baseInput,
      evidence: {
        commitSha: "abc123",
        ciRun: "run-1",
        testsPassed: true,
        m6: "pass",
        s7plus: "pass",
        m8: "pass",
        finalUrlOrArtifact: "https://example.africa"
      }
    });

    expect(output.state).not.toBe("DELIVERED_URL");
    expect(output.blockers).toEqual(expect.arrayContaining([
      "Healthcheck proof missing",
      "Rollback proof missing"
    ]));
  });

  test("keeps legacy terminal delivery compatible until bundle enforcement is activated", () => {
    const output = compileValidationRelay({
      ...baseInput,
      evidence: {
        commitSha: "abc123",
        ciRun: "run-2",
        testsPassed: true,
        m6: "pass",
        s7plus: "pass",
        m8: "pass",
        finalUrlOrArtifact: "https://example.africa",
        healthcheckPassed: true,
        rollbackRef: "rollback:v1"
      }
    });

    expect(output.state).toBe("DELIVERED_URL");
  });

  test("fails closed for URL delivery when release bundle enforcement is active", () => {
    const output = compileValidationRelay({
      ...baseInput,
      releaseEvidenceEnforced: true,
      evidence: {
        commitSha: "abc123",
        ciRun: "run-2",
        testsPassed: true,
        m6: "pass",
        s7plus: "pass",
        m8: "pass",
        finalUrlOrArtifact: "https://example.africa",
        healthcheckPassed: true,
        rollbackRef: "rollback:v1"
      }
    });

    expect(output.state).toBe("DEPLOYED_UNVERIFIED");
    expect(output.blockers).toContain("Release Evidence Bundle required");
  });

  test("returns DELIVERED_SERVICE from a verified release bundle", () => {
    const bundle = serviceBundle();
    const output = compileValidationRelay({
      ...baseInput,
      targetDeliverable: "service",
      releaseEvidenceEnforced: true,
      evidence: { releaseEvidenceBundle: bundle }
    });

    expect(output.state).toBe("DELIVERED_SERVICE");
    expect(output.finalDeliverable).toBe("https://mcp.afriagenesis.com");
  });

  test("preserves APK delivery compatibility without public DNS", () => {
    const output = compileValidationRelay({
      ...baseInput,
      targetDeliverable: "apk",
      releaseEvidenceEnforced: true,
      evidence: {
        commitSha: "def456",
        ciRun: "run-3",
        testsPassed: true,
        m6: "pass",
        s7plus: "pass",
        m8: "pass",
        finalUrlOrArtifact: "artifact://afria-app.apk",
        healthcheckPassed: true,
        rollbackRef: "rollback:apk-v1"
      }
    });

    expect(output.state).toBe("DELIVERED_APK");
  });
});
