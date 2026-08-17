import assert from "node:assert/strict";
import test from "node:test";
import { FiscalRule, ValueCaptureComponent, type EvidenceLink, type FiscalFormula } from "../src/simandou-value-capture.js";
import { ValueCaptureMethodology } from "../src/simandou-value-capture-service.js";
import { evaluateIndustrialScenario, type IndustrialScenarioInput } from "../src/simandou-bankability.js";

const fact: EvidenceLink = {
  evidenceId: "fact",
  source: "synthetic://fact",
  sha256: "1".repeat(64),
  observedAt: "2026-08-17T00:00:00.000Z",
  truthClass: "FACT",
};
const simulation: EvidenceLink = { ...fact, evidenceId: "sim", source: "synthetic://simulation", sha256: "2".repeat(64), truthClass: "SIMULATION" };
const formula: FiscalFormula = { kind: "AD_VALOREM_PERCENT", ratePercent: 5, base: "GROSS_SALE_VALUE" };

test("cannot construct a VALIDATED fiscal rule without a recorded human approver", () => {
  assert.throws(
    () => new FiscalRule("r1", "t1", "p1", "source", "v1", "GN", "2026-01-01", null, formula, "VALIDATED", [fact]),
    /validated fiscal rule.*approver/i,
  );
});

test("fiscal source evidence must be factual rather than hypothesis or simulation", () => {
  assert.throws(
    () => new FiscalRule("r1", "t1", "p1", "source", "v1", "GN", "2026-01-01", null, formula, "DRAFT", [simulation]),
    /fiscal rule source evidence.*FACT/i,
  );
});

test("cannot construct a VALIDATED value-capture methodology without a recorded human approver", () => {
  assert.throws(
    () => new ValueCaptureMethodology("m1", "t1", "p1", "v1", ["PUBLIC_REVENUE"], "VALIDATED", [fact]),
    /validated.*methodology.*approver/i,
  );
});

test("a FACT value component requires factual evidence", () => {
  assert.throws(
    () => new ValueCaptureComponent("v1", "t1", "p1", "PUBLIC_REVENUE", 10, "USD", "receipt-1", [simulation], "FACT"),
    /FACT value capture.*FACT evidence/i,
  );
});

test("Scenario Lab never presents forecast output as FACT", () => {
  const base: IndustrialScenarioInput = {
    id: "s1",
    kind: "PELLETS_DR",
    currency: "USD",
    truthClass: "HYPOTHESIS",
    capex: 1000,
    annualRevenue: 500,
    annualOpex: 200,
    annualDebtService: 100,
    discountRatePercent: 10,
    projectYears: 5,
    sovereignPublicCost: 100,
    sovereignCapturedValue: 250,
    energyMwhPerYear: 1000,
    waterM3PerYear: 2000,
    jobs: 100,
    localContentPercent: 40,
  };
  const result = evaluateIndustrialScenario(base);
  assert.equal(result.truthClass, "SIMULATION");
  assert.throws(() => evaluateIndustrialScenario({ ...base, truthClass: "FACT" }), /Scenario assumptions cannot be FACT/i);
});
