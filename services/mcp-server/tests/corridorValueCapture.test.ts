import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  assessCorridorValueCapture,
  computeSovereignValueCapture,
  GENESIS_V4_CORRIDOR_VALUE_CAPTURE_ANCHOR,
  type CorridorValueCaptureInput
} from "../src/corridorValueCapture";

const goFixture: CorridorValueCaptureInput = {
  corridorId: "east-africa:tanga-lamu-eacop",
  corridorName: "Tanga–Lamu–EACOP",
  countries: ["UG", "TZ", "KE"],
  assetClass: "energy_hub",
  asOf: "2026-08-24T00:00:00Z",
  evidenceRefs: [
    "evidence:project",
    "evidence:storage",
    "evidence:ownership"
  ],
  economicValue: {
    totalEconomicValue: 1000,
    currency: "USD",
    valueComponents: [
      { name: "public_revenue", grossValue: 150, localShare: 1, evidenceRef: "evidence:project" },
      { name: "local_payroll", grossValue: 100, localShare: 0.8, evidenceRef: "evidence:project" },
      { name: "local_procurement", grossValue: 200, localShare: 0.5, evidenceRef: "evidence:storage" },
      { name: "ownership_income", grossValue: 150, localShare: 0.3, evidenceRef: "evidence:ownership" },
      { name: "technology_services", grossValue: 100, localShare: 0.4, evidenceRef: "evidence:ownership" }
    ]
  },
  scores: {
    corridorControl: 80,
    feedstockSecurity: 85,
    infrastructureReadiness: 75,
    marketReach: 80,
    localIndustrialization: 70,
    governanceRisk: 35,
    buyerAccess: 70,
    procurementReadiness: 65
  }
};

const holdFixture: CorridorValueCaptureInput = {
  ...goFixture,
  corridorId: "east-africa:hold-case",
  corridorName: "Hold case",
  scores: {
    corridorControl: 55,
    feedstockSecurity: 55,
    infrastructureReadiness: 55,
    marketReach: 60,
    localIndustrialization: 50,
    governanceRisk: 50,
    buyerAccess: 50,
    procurementReadiness: 50
  }
};

const noGoFixture: CorridorValueCaptureInput = {
  ...goFixture,
  corridorId: "east-africa:no-go-case",
  corridorName: "No-go case",
  economicValue: {
    totalEconomicValue: 1000,
    currency: "USD",
    valueComponents: [
      { name: "public_revenue", grossValue: 100, localShare: 0.4, evidenceRef: "evidence:project" },
      { name: "local_payroll", grossValue: 100, localShare: 0.3, evidenceRef: "evidence:project" },
      { name: "local_procurement", grossValue: 200, localShare: 0.1, evidenceRef: "evidence:storage" },
      { name: "ownership_income", grossValue: 200, localShare: 0.05, evidenceRef: "evidence:ownership" }
    ]
  },
  scores: {
    corridorControl: 40,
    feedstockSecurity: 50,
    infrastructureReadiness: 55,
    marketReach: 60,
    localIndustrialization: 30,
    governanceRisk: 60,
    buyerAccess: 80,
    procurementReadiness: 80
  }
};

describe("GENESIS V4 Energy Corridor & Resource Value Capture Engine", () => {
  test("anchors the runtime to V4-DEC-017 without creating a product silo", () => {
    expect(GENESIS_V4_CORRIDOR_VALUE_CAPTURE_ANCHOR).toMatchObject({
      genome: "GENESIS_V4",
      decisionId: "V4-DEC-017",
      assetId: "GEN-V4-CORRIDOR-VALUE-CAPTURE-001",
      version: "0.1.0",
      proofMode: "deterministic_evidence_first",
      demonstrator: "Tanga–Lamu–EACOP"
    });
  });

  test("computes Sovereign Value Capture Ratio and coverage deterministically", () => {
    const result = computeSovereignValueCapture(goFixture.economicValue);

    expect(result.localRetainedValue).toBeCloseTo(415, 6);
    expect(result.classifiedValue).toBeCloseTo(700, 6);
    expect(result.unclassifiedValue).toBeCloseTo(300, 6);
    expect(result.valueCoverageRatio).toBeCloseTo(70, 6);
    expect(result.sovereignValueCaptureRatio).toBeCloseTo(41.5, 6);
    expect(result.evidenceRefs).toEqual(expect.arrayContaining([
      "evidence:project",
      "evidence:storage",
      "evidence:ownership"
    ]));
  });

  test("rejects invalid total economic value", () => {
    expect(() => computeSovereignValueCapture({
      ...goFixture.economicValue,
      totalEconomicValue: 0
    })).toThrow(/CORRIDOR_INVALID_TOTAL_ECONOMIC_VALUE/);
  });

  test("rejects local share outside 0..1", () => {
    expect(() => computeSovereignValueCapture({
      ...goFixture.economicValue,
      valueComponents: [
        { ...goFixture.economicValue.valueComponents[0]!, localShare: 1.1 }
      ]
    })).toThrow(/CORRIDOR_INVALID_LOCAL_SHARE/);
  });

  test("rejects classified component value above total economic value", () => {
    expect(() => computeSovereignValueCapture({
      ...goFixture.economicValue,
      totalEconomicValue: 100,
      valueComponents: [
        { name: "oversized", grossValue: 101, localShare: 0.5, evidenceRef: "evidence:project" }
      ]
    })).toThrow(/CORRIDOR_COMPONENT_VALUE_EXCEEDS_TOTAL/);
  });

  test("produces GO when readiness, sovereignty and risk gates all pass", () => {
    const result = assessCorridorValueCapture(goFixture);

    expect(result.decision).toBe("GO");
    expect(result.strategicReadinessScore).toBeCloseTo(72.14, 4);
    expect(result.sovereignValueCaptureRatio).toBeCloseTo(41.5, 4);
    expect(result.decisionReasons).toEqual(expect.arrayContaining([
      expect.stringContaining("Strategic readiness"),
      expect.stringContaining("SVCR")
    ]));
  });

  test("produces HOLD for a valid corridor that does not pass GO and does not trigger NO_GO", () => {
    const result = assessCorridorValueCapture(holdFixture);

    expect(result.decision).toBe("HOLD");
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.decisionReasons).toEqual(expect.arrayContaining([
      expect.stringContaining("HOLD")
    ]));
  });

  test("produces NO_GO when sovereign value capture is below the critical floor", () => {
    const result = assessCorridorValueCapture(noGoFixture);

    expect(result.sovereignValueCaptureRatio).toBeLessThan(20);
    expect(result.decision).toBe("NO_GO");
    expect(result.decisionReasons).toEqual(expect.arrayContaining([
      expect.stringMatching(/SVCR .* < 20/)
    ]));
  });

  test("keeps AfrIAgenesis intervention opportunity distinct from corridor readiness", () => {
    const result = assessCorridorValueCapture(noGoFixture);

    expect(result.afriagenesisOpportunityScore).toBeGreaterThan(result.strategicReadinessScore);
    expect(result.sovereigntyGap).toBeGreaterThan(80);
  });

  test("emits intervention lanes from explicit sovereignty and industrialization gaps", () => {
    const result = assessCorridorValueCapture(noGoFixture);

    expect(result.opportunityLanes).toEqual(expect.arrayContaining([
      "ownership_and_value_capture",
      "corridor_control_and_contracts",
      "feedstock_and_supply_security",
      "industrialization_and_local_content",
      "governance_and_transparency",
      "procurement_and_ppp_advisory"
    ]));
  });

  test("preserves evidence lineage and emits R.E.M.E-ready events", () => {
    const result = assessCorridorValueCapture(goFixture);

    expect(result.evidenceRefs).toEqual(expect.arrayContaining([
      "evidence:project",
      "evidence:storage",
      "evidence:ownership"
    ]));
    expect(result.remeEvents).toEqual(expect.arrayContaining([
      "corridor_assessed:east-africa:tanga-lamu-eacop",
      "decision:GO",
      "svcr:41.5"
    ]));
  });

  test("fails closed instead of imputing a missing strategic metric", () => {
    const invalid = {
      ...goFixture,
      scores: {
        ...goFixture.scores,
        marketReach: undefined
      }
    } as unknown as CorridorValueCaptureInput;

    expect(() => assessCorridorValueCapture(invalid)).toThrow(/CORRIDOR_INVALID_MARKET_REACH/);
  });

  test("requires governed MCP registration and health metadata for the corridor engine", () => {
    const indexSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

    expect(indexSource).toContain('register("corridor.value_capture.assess"');
    expect(indexSource).toContain('"corridor:assess"');
    expect(indexSource).toContain('from "./corridorValueCapture.js"');
    expect(indexSource).toContain("corridorValueCapture: GENESIS_V4_CORRIDOR_VALUE_CAPTURE_ANCHOR.assetId");
    expect(indexSource).toContain("corridorValueCaptureVersion: GENESIS_V4_CORRIDOR_VALUE_CAPTURE_ANCHOR.version");
  });
});
