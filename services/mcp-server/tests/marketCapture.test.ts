import { describe, expect, test } from "vitest";
import {
  BENIN_CLIMATE_COLD_PILOT_CELLS,
  MARKET_CAPTURE_TOOL_SCOPES,
  calculateRMCC,
  compileMarketCaptureCell,
  decideCellScale,
  qualifyLead
} from "../src/marketCapture";

const safeClaims = {
  realLocation: true,
  realProviderCoverage: true,
  uniqueUtility: true
};

const activeCell = {
  cellId: "BJ-COT-AC-REPAIR",
  countryCode: "BJ",
  territoryCode: "COT",
  territoryName: "Cotonou",
  sector: "climatisation-froid",
  intentCode: "AC-REPAIR",
  intentLabel: "dépannage climatisation",
  status: "ACTIVE" as const,
  channels: { web: true, phone: false, whatsapp: false },
  claims: safeClaims
};

describe("Distributed Market Capture Layer", () => {
  test("defines exactly the ten approved Benin pilot cells with stable IDs", () => {
    expect(BENIN_CLIMATE_COLD_PILOT_CELLS.map(cell => cell.cellId)).toEqual([
      "BJ-COT-AC-REPAIR",
      "BJ-COT-AC-INSTALL",
      "BJ-COT-AC-MAINT",
      "BJ-COT-COLD-REPAIR",
      "BJ-COT-AC-URGENT",
      "BJ-CAL-AC-REPAIR",
      "BJ-CAL-AC-INSTALL",
      "BJ-CAL-AC-MAINT",
      "BJ-CAL-COLD-REPAIR",
      "BJ-CAL-AC-URGENT"
    ]);
  });

  test("fails closed when an ACTIVE cell claims a location that is not real", () => {
    expect(() => compileMarketCaptureCell({
      ...activeCell,
      claims: { ...safeClaims, realLocation: false }
    })).toThrow(/location|claim|active/i);
  });

  test("fails closed when an ACTIVE cell lacks real provider coverage", () => {
    expect(() => compileMarketCaptureCell({
      ...activeCell,
      claims: { ...safeClaims, realProviderCoverage: false }
    })).toThrow(/provider|coverage|claim|active/i);
  });

  test("permits an unactivated DRAFT cell to preserve unknown or unproven claims", () => {
    const draft = compileMarketCaptureCell({
      ...activeCell,
      status: "DRAFT",
      claims: { realLocation: false, realProviderCoverage: false, uniqueUtility: false }
    });
    expect(draft.status).toBe("DRAFT");
  });

  test("qualifies a lead only from explicit hard observations", () => {
    const result = qualifyLead({
      cellId: activeCell.cellId,
      leadId: "LEAD-001",
      contactPresent: true,
      territoryConfirmed: true,
      intentConfirmed: true,
      urgency: "HIGH",
      providerCoverageConfirmed: true,
      problemDescription: "Climatiseur ne refroidit plus"
    });

    expect(result.qualified).toBe(true);
    expect(result.routeEligible).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.reasons).toContain("HARD_REQUIREMENTS_CONFIRMED");
  });

  test("CRITICAL urgency cannot bypass a missing contact or provider coverage", () => {
    const result = qualifyLead({
      cellId: activeCell.cellId,
      leadId: "LEAD-002",
      contactPresent: false,
      territoryConfirmed: true,
      intentConfirmed: true,
      urgency: "CRITICAL",
      providerCoverageConfirmed: false
    });

    expect(result.qualified).toBe(false);
    expect(result.routeEligible).toBe(false);
    expect(result.reasons).toContain("CONTACT_MISSING");
    expect(result.reasons).toContain("PROVIDER_COVERAGE_UNCONFIRMED");
  });

  test("calculates RMCC and secondary ratios only from observed inputs", () => {
    const economics = calculateRMCC({
      cellId: activeCell.cellId,
      attributedRevenue: 300000,
      cellCost: 100000,
      qualifiedLeads: 10,
      calls: 20,
      closedSales: 4
    });

    expect(economics.rmcc).toBe(3);
    expect(economics.revenuePerLead).toBe(30000);
    expect(economics.revenuePerCall).toBe(15000);
    expect(economics.providerCloseRate).toBe(0.4);
  });

  test("returns null instead of fabricated zero metrics when division is impossible", () => {
    const economics = calculateRMCC({
      cellId: activeCell.cellId,
      attributedRevenue: 0,
      cellCost: 0,
      qualifiedLeads: 0,
      calls: 0,
      closedSales: 0
    });

    expect(economics.rmcc).toBeNull();
    expect(economics.revenuePerLead).toBeNull();
    expect(economics.revenuePerCall).toBeNull();
    expect(economics.providerCloseRate).toBeNull();
  });

  test("KILLs a cell with a false location claim", () => {
    const decision = decideCellScale({
      claims: { ...safeClaims, realLocation: false },
      economics: {
        cellId: activeCell.cellId,
        attributedRevenue: 300000,
        cellCost: 100000,
        qualifiedLeads: 10,
        calls: 20,
        closedSales: 4
      }
    });
    expect(decision.decision).toBe("KILL");
    expect(decision.reasons).toContain("FALSE_LOCATION_CLAIM");
  });

  test("HOLDs a safe cell when evidence or economics are below the scale threshold", () => {
    const decision = decideCellScale({
      claims: safeClaims,
      economics: {
        cellId: activeCell.cellId,
        attributedRevenue: 150000,
        cellCost: 100000,
        qualifiedLeads: 4,
        calls: 8,
        closedSales: 2
      }
    });
    expect(decision.decision).toBe("HOLD");
    expect(decision.reasons).toContain("INSUFFICIENT_QUALIFIED_LEAD_EVIDENCE");
  });

  test("SCALEs only when all safeguards and the approved economic threshold pass", () => {
    const decision = decideCellScale({
      claims: safeClaims,
      economics: {
        cellId: activeCell.cellId,
        attributedRevenue: 250000,
        cellCost: 100000,
        qualifiedLeads: 5,
        calls: 10,
        closedSales: 2
      }
    });
    expect(decision.decision).toBe("SCALE");
    expect(decision.rmcc).toBe(2.5);
  });

  test("declares the exact governed MCP tool scopes approved by the design", () => {
    expect(MARKET_CAPTURE_TOOL_SCOPES).toEqual({
      "genesis.market_capture.compile_cell": "market-capture:compile",
      "genesis.market_capture.qualify_lead": "market-capture:qualify",
      "genesis.market_capture.evaluate_economics": "market-capture:economics",
      "genesis.market_capture.decide_scale": "market-capture:decide"
    });
  });
});
