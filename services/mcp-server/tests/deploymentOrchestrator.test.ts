import { describe, expect, test } from "vitest";
import {
  compileDeploymentRequest,
  evaluateDeployment
} from "../src/deploymentOrchestrator";

const base = {
  assetId: "INF-DEPLOYBOT-001",
  version: "0.4.0",
  commitSha: "abc123",
  environment: "production" as const,
  provider: "render" as const,
  artifactRef: "oci://afriagenesis/mcp:0.4.0",
  healthPath: "/health",
  desiredHostname: "mcp.afriagenesis.com",
  sovereigntyDecisionRef: "SOV-DEPLOY-001"
};

describe("DeployBot deployment orchestrator", () => {
  test("rejects production without a sovereignty decision reference", () => {
    expect(() => compileDeploymentRequest({ ...base, sovereigntyDecisionRef: "" }))
      .toThrow(/sovereignty/i);
  });

  test("compiles a valid provider-neutral deployment plan", () => {
    const request = compileDeploymentRequest(base);
    expect(request.environment).toBe("production");
    expect(request.provider).toBe("render");
    expect(request.desiredHostname).toBe("mcp.afriagenesis.com");
  });

  test("rejects provider evidence for a different commit", () => {
    const request = compileDeploymentRequest(base);
    expect(() => evaluateDeployment({
      request,
      providerEvidence: {
        provider: "render",
        deploymentId: "dep-1",
        deploymentUrl: "https://provider.example",
        deployedCommitSha: "different",
        deployedAt: "2026-08-20T02:00:00Z",
        providerStatus: "live"
      }
    })).toThrow(/commit/i);
  });

  test("advances a live provider deployment to DOMAIN_PENDING", () => {
    const request = compileDeploymentRequest(base);
    const result = evaluateDeployment({
      request,
      providerEvidence: {
        provider: "render",
        deploymentId: "dep-1",
        deploymentUrl: "https://provider.example",
        deployedCommitSha: "abc123",
        deployedAt: "2026-08-20T02:00:00Z",
        providerStatus: "live"
      }
    });
    expect(result.state).toBe("DOMAIN_PENDING");
  });

  test("returns DEPLOYMENT_FAILED for failed provider evidence", () => {
    const request = compileDeploymentRequest(base);
    const result = evaluateDeployment({
      request,
      providerEvidence: {
        provider: "render",
        deploymentId: "dep-2",
        deploymentUrl: "https://provider.example",
        deployedCommitSha: "abc123",
        deployedAt: "2026-08-20T02:00:00Z",
        providerStatus: "failed"
      }
    });
    expect(result.state).toBe("DEPLOYMENT_FAILED");
  });

  test("returns ROLLED_BACK when provider evidence is rolled back", () => {
    const request = compileDeploymentRequest(base);
    const result = evaluateDeployment({
      request,
      providerEvidence: {
        provider: "render",
        deploymentId: "dep-3",
        deploymentUrl: "https://provider.example",
        deployedCommitSha: "abc123",
        deployedAt: "2026-08-20T02:00:00Z",
        providerStatus: "rolled_back"
      }
    });
    expect(result.state).toBe("ROLLED_BACK");
  });
});
