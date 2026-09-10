import { describe, expect, test } from "vitest";
import { compileDfreExecutionReadiness } from "../src/dfreExecutionAdapter";

const provenExecution = {
  dimensionScores: {
    deliveryCostSchedule: 100,
    commissioning: 100,
    operationalPerformance: 100,
    continuityAvailability: 100,
    governanceControl: 100,
    financialDiscipline: 100,
    compliance: 100,
    evidenceQuality: 100
  },
  deliveryStage: "OUTCOME_VERIFIED",
  commissioningStatus: "VERIFIED",
  operationalStatus: "VERIFIED",
  performanceEvidenceStatus: "VERIFIED",
  materialDisputeStatus: "NONE",
  evidenceRefs: ["reme://operator/project-1/outcome"],
  criticalDependencyReadiness: "VERIFIED"
};

describe("V4-DEC-036 DFRE execution adapter", () => {
  test("returns READY_FOR_DUE_DILIGENCE only when project, operator and critical dependencies are all proven", () => {
    const result = compileDfreExecutionReadiness({
      projectBankabilityScore: 86,
      sponsorExecutionInput: provenExecution,
      criticalDependencyReadiness: "VERIFIED"
    });

    expect(result.projectBankabilityScore).toBe(86);
    expect(result.sponsorExecutionDecision).toBe("PROVEN_OPERATOR");
    expect(result.sponsorExecutionCredibilityScore).toBe(100);
    expect(result.criticalDependencyReadiness).toBe("VERIFIED");
    expect(result.decision).toBe("READY_FOR_DUE_DILIGENCE");
    expect(result.canPresentAsExecutionProven).toBe(true);
  });

  test("fails closed when a strong project is carried by an unproven operator", () => {
    const result = compileDfreExecutionReadiness({
      projectBankabilityScore: 92,
      sponsorExecutionInput: {
        ...provenExecution,
        commissioningStatus: "UNKNOWN"
      },
      criticalDependencyReadiness: "VERIFIED"
    });

    expect(result.decision).toBe("HOLD");
    expect(result.canPresentAsExecutionProven).toBe(false);
    expect(result.blockers).toContain("SPONSOR_EXECUTION_NOT_PROVEN");
  });

  test("keeps project bankability and dependency readiness separate instead of averaging them away", () => {
    const result = compileDfreExecutionReadiness({
      projectBankabilityScore: 88,
      sponsorExecutionInput: provenExecution,
      criticalDependencyReadiness: "PARTIAL"
    });

    expect(result.projectBankabilityScore).toBe(88);
    expect(result.sponsorExecutionCredibilityScore).toBe(100);
    expect(result.criticalDependencyReadiness).toBe("PARTIAL");
    expect(result.decision).toBe("CONDITIONAL_REVIEW");
    expect(result.blockers).toContain("CRITICAL_DEPENDENCIES_NOT_FULLY_VERIFIED");
  });

  test("returns INVALID_INPUT on malformed payload", () => {
    const result = compileDfreExecutionReadiness(null);

    expect(result.decision).toBe("INVALID_INPUT");
    expect(result.canPresentAsExecutionProven).toBe(false);
  });
});
