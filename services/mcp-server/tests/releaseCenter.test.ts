import { describe, expect, test } from "vitest";
import {
  compileReleaseEvidenceBundle,
  verifyReleaseEvidenceBundle
} from "../src/releaseCenter";

const baseInput = {
  releaseId: "REL-MCP-0.4.0",
  assetId: "INF-DEPLOYBOT-001",
  version: "0.4.0",
  commitSha: "abc123",
  ciRun: "MCP-CI-200",
  testSummary: "all tests passed",
  gates: { m6: "pass" as const, s7plus: "pass" as const, m8: "pass" as const },
  sovereigntyDecisionRef: "SOV-DEPLOY-001",
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
  changelog: ["Add sovereign delivery runtime"],
  remeRef: "REME-REL-001",
  generatedAt: "2026-08-20T02:03:00Z"
};

describe("DeployBot Release Center", () => {
  test("generates a stable SHA-256 for identical release evidence", () => {
    const one = compileReleaseEvidenceBundle(baseInput);
    const two = compileReleaseEvidenceBundle(baseInput);
    expect(one.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(two.sha256).toBe(one.sha256);
  });

  test("detects bundle tampering", () => {
    const bundle = compileReleaseEvidenceBundle(baseInput);
    const tampered = { ...bundle, version: "9.9.9" };
    expect(() => verifyReleaseEvidenceBundle(tampered, { riskClass: "moderate", targetDeliverable: "service" }))
      .toThrow(/sha|tamper/i);
  });

  test("rejects provider evidence for a different commit", () => {
    expect(() => compileReleaseEvidenceBundle({
      ...baseInput,
      provider: { ...baseInput.provider, deployedCommitSha: "different" }
    })).toThrow(/commit/i);
  });

  test("requires Big4 for high-risk releases", () => {
    const bundle = compileReleaseEvidenceBundle(baseInput);
    expect(() => verifyReleaseEvidenceBundle(bundle, { riskClass: "high", targetDeliverable: "service" }))
      .toThrow(/Big4/i);
  });

  test("requires canonical DNS and TLS evidence for afriagenesis service URLs", () => {
    const bundle = compileReleaseEvidenceBundle({
      ...baseInput,
      domain: { ...baseInput.domain, tlsVerified: false }
    });
    expect(() => verifyReleaseEvidenceBundle(bundle, { riskClass: "moderate", targetDeliverable: "service" }))
      .toThrow(/TLS/i);
  });

  test("requires verified healthcheck, rollback and R.E.M.E evidence", () => {
    const bundle = compileReleaseEvidenceBundle(baseInput);
    expect(() => verifyReleaseEvidenceBundle({ ...bundle, rollback: { ...bundle.rollback, verified: false as true } }, { riskClass: "moderate", targetDeliverable: "service" }))
      .toThrow();
  });

  test("accepts a complete moderate-risk service bundle", () => {
    const bundle = compileReleaseEvidenceBundle(baseInput);
    expect(verifyReleaseEvidenceBundle(bundle, { riskClass: "moderate", targetDeliverable: "service" }).valid)
      .toBe(true);
  });
});
