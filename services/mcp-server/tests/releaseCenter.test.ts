import { describe, expect, test } from "vitest";
import { compileComputeEconomicsPlan } from "../src/computeEconomics";
import {
  compileAssuranceReport,
  compileIndependentAssurance
} from "../src/independentAssurance";
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

function assurance(snapshotSha = "abc123", externalMandate = false, p1 = false) {
  const roles = [
    "ARCHITECTURE_RUNTIME_AUDITOR",
    "SECURITY_SUPPLY_CHAIN_AUDITOR",
    "SOVEREIGNTY_COMPLIANCE_AUDITOR",
    "ECONOMICS_FINOPS_AUDITOR",
    "ADVERSARIAL_RED_TEAM_AUDITOR"
  ] as const;
  const specialistReports = roles.map((auditorRole, index) => compileAssuranceReport({
    auditorRole,
    auditorId: `agent:assurance:release:${index + 1}`,
    executionContextId: `ctx:assurance:release:${index + 1}`,
    snapshotSha,
    findings: p1 && index === 0 ? [{
      id: "P1-RELEASE",
      severity: "P1",
      title: "unresolved release concern",
      status: "OPEN",
      evidenceRefs: ["release:test"]
    }] : [],
    verdict: p1 && index === 0 ? "HOLD" : "PASS",
    evidenceRefs: ["CI#316"],
    generatedAt: "2026-08-24T15:45:00Z"
  }));
  const arbiterReport = compileAssuranceReport({
    auditorRole: "ASSURANCE_ARBITER",
    auditorId: "agent:assurance:release:arbiter",
    executionContextId: "ctx:assurance:release:arbiter",
    snapshotSha,
    findings: [],
    verdict: "PASS",
    evidenceRefs: ["council:sealed"],
    generatedAt: "2026-08-24T15:46:00Z"
  });
  return compileIndependentAssurance({
    snapshotSha,
    specialistReports,
    arbiterReport,
    builderAgentIds: ["agent:builder:release-fixture"],
    externalMandate,
    evidenceRef: "REME-IAC-RELEASE",
    generatedAt: "2026-08-24T15:47:00Z"
  });
}

const baseInput = {
  releaseId: "REL-MCP-0.6.0",
  assetId: "INF-DEPLOYBOT-001",
  version: "0.6.0",
  commitSha: "abc123",
  ciRun: "MCP-CI-316",
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
  changelog: ["Add internal independent assurance gate"],
  remeRef: "REME-REL-001",
  generatedAt: "2026-08-20T02:03:00Z"
};

describe("DeployBot Release Center", () => {
  test("generates stable release evidence schema 1.2.0 with AI economics proof", () => {
    const one = compileReleaseEvidenceBundle(baseInput);
    const two = compileReleaseEvidenceBundle(baseInput);
    expect(one.schemaVersion).toBe("1.2.0");
    expect(one.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(two.sha256).toBe(one.sha256);
    expect(one.aiEconomicsCertificate.sha256).toBe(aiEconomicsCertificate.sha256);
  });

  test("accepts INTERNAL_BIG4_PASS for high-risk release without external mandate", () => {
    const independentAssurance = assurance();
    const bundle = compileReleaseEvidenceBundle({ ...baseInput, independentAssurance });
    const verified = verifyReleaseEvidenceBundle(bundle, { riskClass: "high", targetDeliverable: "service" });
    expect(verified.valid).toBe(true);
    expect(verified.independentAssuranceSha256).toBe(independentAssurance.sha256);
  });

  test("rejects high-risk release without independent assurance", () => {
    const bundle = compileReleaseEvidenceBundle(baseInput);
    expect(() => verifyReleaseEvidenceBundle(bundle, { riskClass: "high", targetDeliverable: "service" }))
      .toThrow(/assurance/i);
  });

  test("legacy big4 pass is not sufficient for a new high-risk release", () => {
    const bundle = compileReleaseEvidenceBundle({
      ...baseInput,
      gates: { ...baseInput.gates, big4: "pass" as const }
    });
    expect(() => verifyReleaseEvidenceBundle(bundle, { riskClass: "high", targetDeliverable: "service" }))
      .toThrow(/assurance/i);
  });

  test("rejects HOLD council evidence for high-risk release", () => {
    const bundle = compileReleaseEvidenceBundle({ ...baseInput, independentAssurance: assurance("abc123", false, true) });
    expect(() => verifyReleaseEvidenceBundle(bundle, { riskClass: "high", targetDeliverable: "service" }))
      .toThrow(/assurance|hold|passed/i);
  });

  test("external mandate cannot be satisfied by internal assurance alone", () => {
    const bundle = compileReleaseEvidenceBundle({ ...baseInput, independentAssurance: assurance("abc123", true) });
    expect(() => verifyReleaseEvidenceBundle(bundle, { riskClass: "high", targetDeliverable: "service" }))
      .toThrow(/external|assurance/i);
  });

  test("rejects assurance bound to a different release snapshot", () => {
    const bundle = compileReleaseEvidenceBundle({ ...baseInput, independentAssurance: assurance("different-sha") });
    expect(() => verifyReleaseEvidenceBundle(bundle, { riskClass: "high", targetDeliverable: "service" }))
      .toThrow(/snapshot|commit/i);
  });

  test("rejects an unknown risk class received from runtime JSON", () => {
    const bundle = compileReleaseEvidenceBundle(baseInput);
    expect(() => verifyReleaseEvidenceBundle(bundle, { riskClass: "unknown" as any, targetDeliverable: "service" } as any))
      .toThrow(/risk/i);
  });

  test("rejects an unknown target deliverable received from runtime JSON", () => {
    const bundle = compileReleaseEvidenceBundle(baseInput);
    expect(() => verifyReleaseEvidenceBundle(bundle, { riskClass: "moderate", targetDeliverable: "preview" as any } as any))
      .toThrow(/deliverable|target/i);
  });

  test("requires canonical DNS and TLS evidence", () => {
    const bundle = compileReleaseEvidenceBundle({
      ...baseInput,
      domain: { ...baseInput.domain, tlsVerified: false }
    });
    expect(() => verifyReleaseEvidenceBundle(bundle, { riskClass: "moderate", targetDeliverable: "service" }))
      .toThrow(/TLS/i);
  });

  test("accepts a complete moderate release without independent assurance", () => {
    const bundle = compileReleaseEvidenceBundle(baseInput);
    const verification = verifyReleaseEvidenceBundle(bundle, { riskClass: "moderate", targetDeliverable: "service" });
    expect(verification.valid).toBe(true);
    expect(verification.aiEconomicsCertificateSha256).toBe(aiEconomicsCertificate.sha256);
  });
});