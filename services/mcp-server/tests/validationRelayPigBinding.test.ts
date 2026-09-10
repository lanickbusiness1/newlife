import { expect, test } from "vitest";
import { compileValidationRelay } from "../src/validationRelay";
import {
  PRODUCTION_CONTROL_IDS,
  type ProductionInfrastructureGateInput
} from "../src/productionInfrastructureGate";

function provenPigInput(releaseId: string): ProductionInfrastructureGateInput {
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

test("rejects a PIG PASS replayed from a different commit/release", () => {
  const output = compileValidationRelay({
    validationRef: "CEO-VAL-REPLAY-001",
    assetId: "INF-DEPLOYBOT-001",
    baselineVersion: "v1.0",
    targetDeliverable: "url",
    riskClass: "moderate",
    sourceRef: "github:lanickbusiness1/newlife",
    evidence: {
      commitSha: "new-commit-sha",
      ciRun: "run-new-commit",
      testsPassed: true,
      productionInfrastructureGate: "pass",
      productionReadinessScore: 100,
      productionCriticalFailures: [],
      productionInfrastructureEvidenceRef: "reme://PIG-001/old-commit-sha",
      productionInfrastructureInput: provenPigInput("old-commit-sha"),
      m6: "pass",
      s7plus: "pass",
      m8: "pass"
    }
  });

  expect(output.state).toBe("CORRECTING");
  expect(output.blockers.some(item => item.includes("PIG release mismatch"))).toBe(true);
});
