import type { TruthClass } from "./simandou-value-capture.js";

export type IndustrialScenarioKind =
  | "EXPORT_FINES"
  | "BENEFICIATION"
  | "PELLETS_DR"
  | "DRI_HBI"
  | "PRIMARY_STEEL"
  | "RAILS_STRUCTURES"
  | "INDUSTRIAL_ENERGY"
  | "LOGISTICS_HUB";

export type IndustrialScenarioInput = Readonly<{
  id: string;
  kind: IndustrialScenarioKind;
  currency: string;
  truthClass: TruthClass;
  capex: number;
  annualRevenue: number;
  annualOpex: number;
  annualDebtService: number;
  discountRatePercent: number;
  projectYears: number;
  sovereignPublicCost: number;
  sovereignCapturedValue: number;
  energyMwhPerYear: number;
  waterM3PerYear: number;
  jobs: number;
  localContentPercent: number;
}>;

export type IndustrialScenarioResult = Readonly<{
  scenarioId: string;
  kind: IndustrialScenarioKind;
  currency: string;
  assumptions: IndustrialScenarioInput;
  ebitda: number;
  npv: number;
  irrPercent: number | null;
  dscr: number | null;
  sovereignRoiPercent: number | null;
}>;

export type IndustrialStressCase = Readonly<{
  name: "PRICE_MINUS_20" | "PRICE_PLUS_20" | "CAPEX_PLUS_20" | "OPEX_PLUS_20";
  result: IndustrialScenarioResult;
}>;

export function evaluateIndustrialScenario(input: IndustrialScenarioInput): IndustrialScenarioResult {
  validateScenario(input);
  const normalized: IndustrialScenarioInput = Object.freeze({ ...input });
  const ebitda = roundMoney(input.annualRevenue - input.annualOpex);
  const discountRate = input.discountRatePercent / 100;
  const cashflows = [-input.capex, ...Array.from({ length: input.projectYears }, () => ebitda)];
  const npv = roundMoney(netPresentValue(cashflows, discountRate));
  const irr = internalRateOfReturn(cashflows);
  const dscr = input.annualDebtService === 0
    ? null
    : roundRatio(ebitda / input.annualDebtService);
  const sovereignRoiPercent = input.sovereignPublicCost === 0
    ? null
    : roundPercent(((input.sovereignCapturedValue - input.sovereignPublicCost) / input.sovereignPublicCost) * 100);

  return Object.freeze({
    scenarioId: input.id,
    kind: input.kind,
    currency: input.currency,
    assumptions: normalized,
    ebitda,
    npv,
    irrPercent: irr === null ? null : roundPercent(irr * 100),
    dscr,
    sovereignRoiPercent,
  });
}

export function stressIndustrialScenario(input: IndustrialScenarioInput): readonly IndustrialStressCase[] {
  validateScenario(input);
  const forceSimulation = (overrides: Partial<IndustrialScenarioInput>): IndustrialScenarioInput => Object.freeze({
    ...input,
    ...overrides,
    truthClass: "SIMULATION" as const,
  });

  return Object.freeze([
    Object.freeze({
      name: "PRICE_MINUS_20" as const,
      result: evaluateIndustrialScenario(forceSimulation({ annualRevenue: roundMoney(input.annualRevenue * 0.8) })),
    }),
    Object.freeze({
      name: "PRICE_PLUS_20" as const,
      result: evaluateIndustrialScenario(forceSimulation({ annualRevenue: roundMoney(input.annualRevenue * 1.2) })),
    }),
    Object.freeze({
      name: "CAPEX_PLUS_20" as const,
      result: evaluateIndustrialScenario(forceSimulation({ capex: roundMoney(input.capex * 1.2) })),
    }),
    Object.freeze({
      name: "OPEX_PLUS_20" as const,
      result: evaluateIndustrialScenario(forceSimulation({ annualOpex: roundMoney(input.annualOpex * 1.2) })),
    }),
  ]);
}

function validateScenario(input: IndustrialScenarioInput): void {
  if (!input.id.trim()) throw new Error("Scenario id is required");
  if (!/^[A-Z]{3}$/.test(input.currency)) throw new Error("Scenario currency must be a three-letter uppercase code");
  if (!isScenarioKind(input.kind)) throw new Error("Scenario kind is invalid");
  if (input.truthClass !== "HYPOTHESIS" && input.truthClass !== "SIMULATION" && input.truthClass !== "FACT") {
    throw new Error("Scenario truth class is invalid");
  }
  assertNonNegative(input.capex, "CAPEX");
  assertNonNegative(input.annualRevenue, "Annual revenue");
  assertNonNegative(input.annualOpex, "Annual OPEX");
  assertNonNegative(input.annualDebtService, "Annual debt service");
  assertNonNegative(input.sovereignPublicCost, "Sovereign public cost");
  assertNonNegative(input.sovereignCapturedValue, "Sovereign captured value");
  assertNonNegative(input.energyMwhPerYear, "Energy requirement");
  assertNonNegative(input.waterM3PerYear, "Water requirement");
  assertNonNegative(input.jobs, "Jobs");
  if (!Number.isInteger(input.projectYears) || input.projectYears < 1 || input.projectYears > 100) {
    throw new Error("Project years must be an integer between 1 and 100");
  }
  if (!Number.isFinite(input.discountRatePercent) || input.discountRatePercent < 0 || input.discountRatePercent > 100) {
    throw new Error("Discount rate must be between 0 and 100 percent");
  }
  if (!Number.isFinite(input.localContentPercent) || input.localContentPercent < 0 || input.localContentPercent > 100) {
    throw new Error("Local content percent must be between 0 and 100");
  }
}

function netPresentValue(cashflows: readonly number[], rate: number): number {
  return cashflows.reduce((sum, cashflow, index) => sum + cashflow / ((1 + rate) ** index), 0);
}

function internalRateOfReturn(cashflows: readonly number[]): number | null {
  const hasPositive = cashflows.some((cashflow) => cashflow > 0);
  const hasNegative = cashflows.some((cashflow) => cashflow < 0);
  if (!hasPositive || !hasNegative) return null;

  let low = -0.9999;
  let high = 10;
  let lowValue = netPresentValue(cashflows, low);
  let highValue = netPresentValue(cashflows, high);

  if (!Number.isFinite(lowValue) || !Number.isFinite(highValue)) return null;
  if (lowValue === 0) return low;
  if (highValue === 0) return high;
  if (Math.sign(lowValue) === Math.sign(highValue)) return null;

  for (let iteration = 0; iteration < 200; iteration += 1) {
    const mid = (low + high) / 2;
    const value = netPresentValue(cashflows, mid);
    if (!Number.isFinite(value)) return null;
    if (Math.abs(value) < 1e-9) return mid;
    if (Math.sign(value) === Math.sign(lowValue)) {
      low = mid;
      lowValue = value;
    } else {
      high = mid;
      highValue = value;
    }
  }
  return (low + high) / 2;
}

function isScenarioKind(value: string): value is IndustrialScenarioKind {
  return [
    "EXPORT_FINES",
    "BENEFICIATION",
    "PELLETS_DR",
    "DRI_HBI",
    "PRIMARY_STEEL",
    "RAILS_STRUCTURES",
    "INDUSTRIAL_ENERGY",
    "LOGISTICS_HUB",
  ].includes(value);
}

function assertNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a non-negative finite number`);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundRatio(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

function roundPercent(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
