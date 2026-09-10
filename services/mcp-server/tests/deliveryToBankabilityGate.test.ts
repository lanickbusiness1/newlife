import { describe, expect, test } from "vitest";
import {
  DELIVERY_TO_BANKABILITY_WEIGHTS,
  GENESIS_V4_DELIVERY_TO_BANKABILITY_ANCHOR,
  evaluateDeliveryToBankability
} from "../src/deliveryToBankabilityGate";

const fullScore = {
  deliveryCostSchedule: 100,
  commissioning: 100,
  operationalPerformance: 100,
  continuityAvailability: 100,
  governanceControl: 100,
  financialDiscipline: 100,
  compliance: 100,
  evidenceQuality: 100
};

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    dimensionScores: fullScore,
    deliveryStage: "OUTCOME_VERIFIED",
    commissioningStatus: "VERIFIED",
    operationalStatus: "VERIFIED",
    performanceEvidenceStatus: "VERIFIED",
    materialDisputeStatus: "NONE",
    evidenceRefs: ["reme://delivery/project-001"],
    criticalDependencyReadiness: "VERIFIED",
    ...overrides
  };
}

describe("GENESIS V4 Delivery-to-Bankability Gate", () => {
  test("anchors runtime to V4-DEC-036 and proves delivery only on a fully evidenced outcome", () => {
    const result = evaluateDeliveryToBankability(validInput());

    expect(GENESIS_V4_DELIVERY_TO_BANKABILITY_ANCHOR).toEqual({
      assetId: "GEN-V4-DELIVERY-TO-BANKABILITY-GATE-001",
      decisionId: "V4-DEC-036",
      version: "0.1.0",
      proofMode: "deterministic-fail-closed"
    });
    expect(DELIVERY_TO_BANKABILITY_WEIGHTS).toEqual({
      deliveryCostSchedule: 20,
      commissioning: 15,
      operationalPerformance: 20,
      continuityAvailability: 10,
      governanceControl: 10,
      financialDiscipline: 10,
      compliance: 5,
      evidenceQuality: 10
    });
    expect(result.score).toBe(100);
    expect(result.decision).toBe("PROVEN_OPERATOR");
    expect(result.canClaimDelivered).toBe(true);
    expect(result.canUpdateBankability).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  test("applies the canonical weighted score thresholds", () => {
    const conditional = evaluateDeliveryToBankability(validInput({
      dimensionScores: Object.fromEntries(Object.keys(fullScore).map(key => [key, 70]))
    }));
    const limited = evaluateDeliveryToBankability(validInput({
      dimensionScores: Object.fromEntries(Object.keys(fullScore).map(key => [key, 55]))
    }));
    const unproven = evaluateDeliveryToBankability(validInput({
      dimensionScores: Object.fromEntries(Object.keys(fullScore).map(key => [key, 40]))
    }));

    expect(conditional.score).toBe(70);
    expect(conditional.decision).toBe("CONDITIONALLY_PROVEN");
    expect(conditional.canClaimDelivered).toBe(false);
    expect(limited.decision).toBe("LIMITED_TRACK_RECORD");
    expect(unproven.decision).toBe("UNPROVEN");
  });

  test("fails closed when commissioning is not verified", () => {
    const result = evaluateDeliveryToBankability(validInput({ commissioningStatus: "UNKNOWN" }));

    expect(result.decision).toBe("UNPROVEN");
    expect(result.canClaimDelivered).toBe(false);
    expect(result.blockers).toContain("COMMISSIONING_NOT_VERIFIED");
  });

  test("fails closed when the asset is not operational or operational evidence is absent", () => {
    const result = evaluateDeliveryToBankability(validInput({
      operationalStatus: "FAILED",
      performanceEvidenceStatus: "ABSENT"
    }));

    expect(result.decision).toBe("UNPROVEN");
    expect(result.blockers).toContain("OPERATIONAL_STATUS_FAILED");
    expect(result.blockers).toContain("PERFORMANCE_EVIDENCE_ABSENT");
  });

  test("marks disputed execution evidence as DISPUTED even with a perfect numeric score", () => {
    const result = evaluateDeliveryToBankability(validInput({
      performanceEvidenceStatus: "DISPUTED"
    }));

    expect(result.score).toBe(100);
    expect(result.decision).toBe("DISPUTED");
    expect(result.canClaimDelivered).toBe(false);
    expect(result.canUpdateBankability).toBe(false);
    expect(result.blockers).toContain("PERFORMANCE_EVIDENCE_DISPUTED");
  });

  test("requires outcome-verified stage and R.E.M.E evidence before final delivery claim", () => {
    const result = evaluateDeliveryToBankability(validInput({
      deliveryStage: "PERFORMING",
      evidenceRefs: []
    }));

    expect(result.decision).toBe("UNPROVEN");
    expect(result.blockers).toContain("OUTCOME_NOT_VERIFIED");
    expect(result.blockers).toContain("DELIVERY_EVIDENCE_MISSING");
  });

  test("blocks final proof when a critical dependency is unresolved and caps unknown readiness", () => {
    const blocked = evaluateDeliveryToBankability(validInput({
      criticalDependencyReadiness: "BLOCKED"
    }));
    const unknown = evaluateDeliveryToBankability(validInput({
      criticalDependencyReadiness: "UNKNOWN"
    }));

    expect(blocked.decision).toBe("UNPROVEN");
    expect(blocked.blockers).toContain("CRITICAL_DEPENDENCY_BLOCKED");
    expect(unknown.decision).toBe("CONDITIONALLY_PROVEN");
    expect(unknown.blockers).toContain("CRITICAL_DEPENDENCY_NOT_VERIFIED");
  });

  test("returns INVALID_INPUT instead of throwing on malformed payloads", () => {
    const result = evaluateDeliveryToBankability(null);

    expect(result.decision).toBe("INVALID_INPUT");
    expect(result.score).toBe(0);
    expect(result.canClaimDelivered).toBe(false);
    expect(result.canUpdateBankability).toBe(false);
    expect(result.blockers).toContain("INVALID_INPUT");
  });
});