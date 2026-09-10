import { describe, expect, test } from "vitest";
import {
  GENESIS_V4_IP_TO_CAPITAL_ANCHOR,
  evaluateIpToCapitalReadiness
} from "../src/ipToCapitalReadinessGate";

const fullScore = {
  ownershipChainOfTitle: 100,
  protectionEnforceability: 100,
  technicalEvidence: 100,
  marketEvidence: 100,
  monetizationCashflowAttribution: 100,
  valuationRobustness: 100,
  liquidityTransferability: 100,
  businessExecutionCapacity: 100,
  financingRepaymentLogic: 100,
  evidenceGovernance: 100
};

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    dimensionScores: fullScore,
    chainOfTitleStatus: "VERIFIED",
    protectionStatus: "VERIFIED_ACTIVE",
    protectionRequired: true,
    criticalFinancialAssumptionsSourced: true,
    hasMarketEvidence: true,
    ipCashflowAttributable: true,
    materialDisputeStatus: "NONE",
    transferabilityStatus: "VERIFIED",
    targetGuaranteeProgram: "EXAMPLE_PROGRAM",
    guaranteeCriteriaVerified: true,
    valuationReference: 1_000_000,
    riskHaircut: 0.25,
    ...overrides
  };
}

describe("GENESIS V4 IP-to-Capital Readiness Gate", () => {
  test("anchors runtime to V4-DEC-035 and reaches READY only on a fully proven dossier", () => {
    const result = evaluateIpToCapitalReadiness(validInput());

    expect(GENESIS_V4_IP_TO_CAPITAL_ANCHOR).toEqual({
      assetId: "GEN-V4-IP-TO-CAPITAL-READINESS-GATE-001",
      decisionId: "V4-DEC-035",
      version: "0.1.0",
      proofMode: "deterministic-fail-closed"
    });
    expect(result.score).toBe(100);
    expect(result.decision).toBe("READY");
    expect(result.canPromoteM6).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  test("applies the canonical weighted 100-point scorecard and returns CONDITIONAL at 65-79", () => {
    const result = evaluateIpToCapitalReadiness(validInput({
      dimensionScores: {
        ...fullScore,
        ownershipChainOfTitle: 70,
        protectionEnforceability: 70,
        technicalEvidence: 70,
        marketEvidence: 70,
        monetizationCashflowAttribution: 70,
        valuationRobustness: 70,
        liquidityTransferability: 70,
        businessExecutionCapacity: 70,
        financingRepaymentLogic: 70,
        evidenceGovernance: 70
      }
    }));

    expect(result.score).toBe(70);
    expect(result.decision).toBe("CONDITIONAL");
    expect(result.canPromoteM6).toBe(false);
  });

  test("returns RESTRUCTURE at 45-64 and NO_GO at 0-44", () => {
    const restructure = evaluateIpToCapitalReadiness(validInput({
      dimensionScores: Object.fromEntries(Object.keys(fullScore).map(key => [key, 55]))
    }));
    const noGo = evaluateIpToCapitalReadiness(validInput({
      dimensionScores: Object.fromEntries(Object.keys(fullScore).map(key => [key, 44]))
    }));

    expect(restructure.score).toBe(55);
    expect(restructure.decision).toBe("RESTRUCTURE");
    expect(noGo.score).toBe(44);
    expect(noGo.decision).toBe("NO_GO");
  });

  test("fails closed: disputed ownership prevents READY even with a perfect numeric score", () => {
    const result = evaluateIpToCapitalReadiness(validInput({ chainOfTitleStatus: "DISPUTED" }));

    expect(result.score).toBe(100);
    expect(result.decision).toBe("NO_GO");
    expect(result.canPromoteM6).toBe(false);
    expect(result.blockers).toContain("CHAIN_OF_TITLE_DISPUTED");
  });

  test("fails closed when protection is expired, market proof is absent, or IP cash-flow is not attributable", () => {
    const result = evaluateIpToCapitalReadiness(validInput({
      protectionStatus: "EXPIRED",
      hasMarketEvidence: false,
      ipCashflowAttributable: false
    }));

    expect(result.decision).toBe("NO_GO");
    expect(result.blockers).toContain("PROTECTION_EXPIRED");
    expect(result.blockers).toContain("MARKET_EVIDENCE_ABSENT");
    expect(result.blockers).toContain("IP_CASHFLOW_NOT_ATTRIBUTABLE");
  });

  test("keeps guarantee readiness UNKNOWN when current criteria are not verified and blocks READY", () => {
    const result = evaluateIpToCapitalReadiness(validInput({ guaranteeCriteriaVerified: false }));

    expect(result.guaranteeReadiness).toBe("UNKNOWN");
    expect(result.decision).toBe("CONDITIONAL");
    expect(result.canPromoteM6).toBe(false);
    expect(result.blockers).toContain("GUARANTEE_CRITERIA_NOT_VERIFIED");
  });

  test("computes adjusted IP value only from supplied valuation reference and documented haircut", () => {
    const result = evaluateIpToCapitalReadiness(validInput({
      valuationReference: 2_000_000,
      riskHaircut: 0.35
    }));

    expect(result.adjustedIpValue).toBe(1_300_000);
  });

  test("fails closed on malformed input instead of throwing", () => {
    const result = evaluateIpToCapitalReadiness(null);

    expect(result.decision).toBe("INVALID_INPUT");
    expect(result.score).toBe(0);
    expect(result.canPromoteM6).toBe(false);
    expect(result.blockers).toContain("INVALID_INPUT");
  });
});
