import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateIndustrialScenario,
  stressIndustrialScenario,
  type IndustrialScenarioInput,
} from "../src/simandou-bankability.js";

function baseScenario(overrides: Partial<IndustrialScenarioInput> = {}): IndustrialScenarioInput {
  return {
    id: "scenario-1",
    kind: "PELLETS_DR",
    currency: "USD",
    truthClass: "SIMULATION",
    capex: 1_000,
    annualRevenue: 500,
    annualOpex: 200,
    annualDebtService: 100,
    discountRatePercent: 10,
    projectYears: 5,
    sovereignPublicCost: 100,
    sovereignCapturedValue: 250,
    energyMwhPerYear: 10_000,
    waterM3PerYear: 20_000,
    jobs: 500,
    localContentPercent: 40,
    ...overrides,
  };
}

test("produces deterministic NPV, IRR, DSCR and sovereign ROI from explicit assumptions", () => {
  const first = evaluateIndustrialScenario(baseScenario());
  const second = evaluateIndustrialScenario(baseScenario());
  assert.deepEqual(first, second);
  assert.equal(first.ebitda, 300);
  assert.equal(first.dscr, 3);
  assert.equal(first.sovereignRoiPercent, 150);
  assert.equal(first.assumptions.truthClass, "SIMULATION");
  assert.equal(Number.isFinite(first.npv), true);
  assert.equal(Number.isFinite(first.irrPercent ?? NaN), true);
});

test("does not invent debt metrics when no debt service exists", () => {
  const result = evaluateIndustrialScenario(baseScenario({ annualDebtService: 0 }));
  assert.equal(result.dscr, null);
});

test("does not invent sovereign ROI when no public cost exists", () => {
  const result = evaluateIndustrialScenario(baseScenario({ sovereignPublicCost: 0 }));
  assert.equal(result.sovereignRoiPercent, null);
});

test("rejects negative financial assumptions and invalid percentages", () => {
  assert.throws(() => evaluateIndustrialScenario(baseScenario({ capex: -1 })), /capex/i);
  assert.throws(() => evaluateIndustrialScenario(baseScenario({ discountRatePercent: -1 })), /discount rate/i);
  assert.throws(() => evaluateIndustrialScenario(baseScenario({ localContentPercent: 101 })), /local content/i);
  assert.throws(() => evaluateIndustrialScenario(baseScenario({ projectYears: 0 })), /project years/i);
});

test("returns null IRR when cashflows have no sign change", () => {
  const result = evaluateIndustrialScenario(baseScenario({ capex: 0, annualRevenue: 500, annualOpex: 200 }));
  assert.equal(result.irrPercent, null);
});

test("runs explicit price, CAPEX and OPEX stress cases and labels them SIMULATION", () => {
  const stressed = stressIndustrialScenario(baseScenario());
  assert.deepEqual(stressed.map((item) => item.name), ["PRICE_MINUS_20", "PRICE_PLUS_20", "CAPEX_PLUS_20", "OPEX_PLUS_20"]);
  assert.equal(stressed.every((item) => item.result.assumptions.truthClass === "SIMULATION"), true);
  assert.equal(stressed.find((item) => item.name === "PRICE_MINUS_20")?.result.assumptions.annualRevenue, 400);
  assert.equal(stressed.find((item) => item.name === "CAPEX_PLUS_20")?.result.assumptions.capex, 1_200);
  assert.equal(stressed.find((item) => item.name === "OPEX_PLUS_20")?.result.assumptions.annualOpex, 240);
});
