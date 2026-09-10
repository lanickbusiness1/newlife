import { describe, expect, test } from "vitest";
import {
  compileValidationRelay,
  type ValidationRelayInput
} from "../src/validationRelay";
import {
  PRODUCTION_CONTROL_IDS,
  type ProductionInfrastructureGateInput
} from "../src/productionInfrastructureGate";

function fullyProvenPigInput(releaseId: string): ProductionInfrastructureGateInput {
  return {
    assetId: "INF-DEPLOYBOT-001",
    releaseId,
    environment: "preproduction",
    multiTenant: true,
    controls: Object.fromEntries(
      PRODUCTION_CONTROL_IDS.map(id => [id, {
        status: "pass" as const,
        evidenceRefs: [`reme://${releaseId}/${id}/proof`]
      }])
    ) as ProductionInfrastructureGateInput["controls"]
  };
}

function deployableInput(): ValidationRelayInput {
  const commitSha = "delivery-proof-binding";
  return {
    validationRef: "CEO-VAL-V4-DEC-036-BINDING",
    assetId: "INF-DEPLOYBOT-001",
    baselineVersion: "v0.1.0",
    targetDeliverable: "url",
    riskClass: "moderate",
    sourceRef: "github:lanickbusiness1/newlife",
    budgetEnvelope: { authorized: true },
    deploymentPolicy: { stagingAllowed: true, productionDelegated: true },
    evidence: {
      commitSha,
      ciRun: "run-v4-dec-036-binding",
      testsPassed: true,
      productionInfrastructureGate: "pass",
      productionReadinessScore: 100,
      productionCriticalFailures: [],
      productionInfrastructureEvidenceRef: `reme://PIG-001/${commitSha}`,
      productionInfrastructureInput: fullyProvenPigInput(commitSha),
      m6: "pass",
      s7plus: "pass",
      m8: "pass",
      finalUrlOrArtifact: "https://delivery-proof.afriagenesis.com",
      healthcheckPassed: true,
      rollbackRef: "rollback:v4-dec-036-binding"
    }
  };
}

describe("V4-DEC-036 Validation Relay delivery proof binding", () => {
  test("does not claim DELIVERED after deploy/healthcheck/rollback without Delivery-to-Bankability proof", () => {
    const result = compileValidationRelay(deployableInput());

    expect(result.state).toBe("DEPLOYED_UNVERIFIED");
    expect(result.continueAutomatically).toBe(true);
    expect(result.blockers.some(item => /delivery-to-bankability/i.test(item))).toBe(true);
  });
});
