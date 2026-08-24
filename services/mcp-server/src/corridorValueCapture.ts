export const GENESIS_V4_CORRIDOR_VALUE_CAPTURE_ANCHOR = {
  genome: "GENESIS_V4",
  decisionId: "V4-DEC-017",
  assetId: "GEN-V4-CORRIDOR-VALUE-CAPTURE-001",
  version: "0.1.0",
  canonicalOwner: "AfrIAgenesis®",
  parentCapabilities: [
    "Sovereign Industrialization & Resource Value Capture OS™",
    "Port & Corridor Sovereignty Intelligence™ / ASCISS™",
    "GOIR™",
    "ECES™",
    "Revenue Economics Engine™",
    "R.E.M.E™"
  ],
  proofMode: "deterministic_evidence_first",
  demonstrator: "Tanga–Lamu–EACOP"
} as const;

export type CorridorAssetClass =
  | "pipeline"
  | "port"
  | "refinery"
  | "terminal"
  | "rail"
  | "road"
  | "multimodal"
  | "energy_hub"
  | "industrial_corridor"
  | "other";

export type CorridorDecision = "GO" | "HOLD" | "NO_GO";

export type CorridorOpportunityLane =
  | "ownership_and_value_capture"
  | "corridor_control_and_contracts"
  | "feedstock_and_supply_security"
  | "industrialization_and_local_content"
  | "governance_and_transparency"
  | "market_and_hinterland"
  | "procurement_and_ppp_advisory";

export interface ValueComponentInput {
  name: string;
  grossValue: number;
  localShare: number;
  evidenceRef: string;
}

export interface EconomicValueInput {
  totalEconomicValue: number;
  currency: string;
  valueComponents: ValueComponentInput[];
}

export interface SovereignValueCaptureResult {
  totalEconomicValue: number;
  currency: string;
  classifiedValue: number;
  unclassifiedValue: number;
  localRetainedValue: number;
  valueCoverageRatio: number;
  sovereignValueCaptureRatio: number;
  evidenceRefs: string[];
}

export interface CorridorScoresInput {
  corridorControl: number;
  feedstockSecurity: number;
  infrastructureReadiness: number;
  marketReach: number;
  localIndustrialization: number;
  governanceRisk: number;
  buyerAccess: number;
  procurementReadiness: number;
}

export interface CorridorValueCaptureInput {
  corridorId: string;
  corridorName: string;
  countries: string[];
  assetClass: CorridorAssetClass;
  asOf: string;
  evidenceRefs: string[];
  economicValue: EconomicValueInput;
  scores: CorridorScoresInput;
}

export interface CorridorValueCaptureAssessment {
  anchor: typeof GENESIS_V4_CORRIDOR_VALUE_CAPTURE_ANCHOR;
  corridorId: string;
  corridorName: string;
  countries: string[];
  assetClass: CorridorAssetClass;
  asOf: string;
  currency: string;
  totalEconomicValue: number;
  classifiedValue: number;
  unclassifiedValue: number;
  localRetainedValue: number;
  valueCoverageRatio: number;
  sovereignValueCaptureRatio: number;
  sovereigntyGap: number;
  corridorControl: number;
  feedstockSecurity: number;
  infrastructureReadiness: number;
  marketReach: number;
  localIndustrialization: number;
  governanceRisk: number;
  buyerAccess: number;
  procurementReadiness: number;
  strategicReadinessScore: number;
  afriagenesisOpportunityScore: number;
  decision: CorridorDecision;
  decisionReasons: string[];
  blockers: string[];
  opportunityLanes: CorridorOpportunityLane[];
  evidenceRefs: string[];
  remeEvents: string[];
}

const ASSET_CLASSES = new Set<CorridorAssetClass>([
  "pipeline",
  "port",
  "refinery",
  "terminal",
  "rail",
  "road",
  "multimodal",
  "energy_hub",
  "industrial_corridor",
  "other"
]);

function requiredText(value: unknown, code: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(code);
  }
}

function assertFiniteRange(
  value: unknown,
  min: number,
  max: number,
  code: string
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(code);
  }
}

function assertEvidenceRefs(value: unknown, code: string): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some(item => typeof item !== "string" || !item.trim())) {
    throw new Error(code);
  }
}

function round(value: number, precision = 6): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function formatted(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : String(round(value, 4));
}

export function computeSovereignValueCapture(input: EconomicValueInput): SovereignValueCaptureResult {
  if (!input || typeof input !== "object") {
    throw new Error("CORRIDOR_INVALID_ECONOMIC_VALUE");
  }

  assertFiniteRange(input.totalEconomicValue, Number.MIN_VALUE, Number.MAX_VALUE, "CORRIDOR_INVALID_TOTAL_ECONOMIC_VALUE");
  requiredText(input.currency, "CORRIDOR_INVALID_CURRENCY");

  if (!Array.isArray(input.valueComponents) || input.valueComponents.length === 0) {
    throw new Error("CORRIDOR_VALUE_COMPONENTS_REQUIRED");
  }

  let classifiedValue = 0;
  let localRetainedValue = 0;
  const evidenceRefs: string[] = [];

  for (const component of input.valueComponents) {
    if (!component || typeof component !== "object") {
      throw new Error("CORRIDOR_INVALID_VALUE_COMPONENT");
    }

    requiredText(component.name, "CORRIDOR_INVALID_COMPONENT_NAME");
    assertFiniteRange(component.grossValue, 0, Number.MAX_VALUE, "CORRIDOR_INVALID_GROSS_VALUE");
    assertFiniteRange(component.localShare, 0, 1, "CORRIDOR_INVALID_LOCAL_SHARE");
    requiredText(component.evidenceRef, "CORRIDOR_COMPONENT_EVIDENCE_REQUIRED");

    classifiedValue += component.grossValue;
    localRetainedValue += component.grossValue * component.localShare;
    evidenceRefs.push(component.evidenceRef);
  }

  if (classifiedValue > input.totalEconomicValue + 1e-9) {
    throw new Error("CORRIDOR_COMPONENT_VALUE_EXCEEDS_TOTAL");
  }

  const unclassifiedValue = input.totalEconomicValue - classifiedValue;
  const valueCoverageRatio = classifiedValue / input.totalEconomicValue * 100;
  const sovereignValueCaptureRatio = localRetainedValue / input.totalEconomicValue * 100;

  return {
    totalEconomicValue: round(input.totalEconomicValue),
    currency: input.currency.trim(),
    classifiedValue: round(classifiedValue),
    unclassifiedValue: round(unclassifiedValue),
    localRetainedValue: round(localRetainedValue),
    valueCoverageRatio: round(valueCoverageRatio),
    sovereignValueCaptureRatio: round(sovereignValueCaptureRatio),
    evidenceRefs: unique(evidenceRefs)
  };
}

function validateAssessmentInput(input: CorridorValueCaptureInput): void {
  if (!input || typeof input !== "object") {
    throw new Error("CORRIDOR_INVALID_ASSESSMENT");
  }

  requiredText(input.corridorId, "CORRIDOR_INVALID_CORRIDOR_ID");
  requiredText(input.corridorName, "CORRIDOR_INVALID_CORRIDOR_NAME");
  requiredText(input.asOf, "CORRIDOR_INVALID_AS_OF");

  if (Number.isNaN(Date.parse(input.asOf))) {
    throw new Error("CORRIDOR_INVALID_AS_OF");
  }

  if (!Array.isArray(input.countries) || input.countries.length === 0 || input.countries.some(country => typeof country !== "string" || !country.trim())) {
    throw new Error("CORRIDOR_COUNTRIES_REQUIRED");
  }

  if (!ASSET_CLASSES.has(input.assetClass)) {
    throw new Error("CORRIDOR_INVALID_ASSET_CLASS");
  }

  assertEvidenceRefs(input.evidenceRefs, "CORRIDOR_EVIDENCE_REQUIRED");

  if (!input.scores || typeof input.scores !== "object") {
    throw new Error("CORRIDOR_SCORES_REQUIRED");
  }

  assertFiniteRange(input.scores.corridorControl, 0, 100, "CORRIDOR_INVALID_CORRIDOR_CONTROL");
  assertFiniteRange(input.scores.feedstockSecurity, 0, 100, "CORRIDOR_INVALID_FEEDSTOCK_SECURITY");
  assertFiniteRange(input.scores.infrastructureReadiness, 0, 100, "CORRIDOR_INVALID_INFRASTRUCTURE_READINESS");
  assertFiniteRange(input.scores.marketReach, 0, 100, "CORRIDOR_INVALID_MARKET_REACH");
  assertFiniteRange(input.scores.localIndustrialization, 0, 100, "CORRIDOR_INVALID_LOCAL_INDUSTRIALIZATION");
  assertFiniteRange(input.scores.governanceRisk, 0, 100, "CORRIDOR_INVALID_GOVERNANCE_RISK");
  assertFiniteRange(input.scores.buyerAccess, 0, 100, "CORRIDOR_INVALID_BUYER_ACCESS");
  assertFiniteRange(input.scores.procurementReadiness, 0, 100, "CORRIDOR_INVALID_PROCUREMENT_READINESS");
}

function deriveOpportunityLanes(
  svcr: number,
  scores: CorridorScoresInput
): CorridorOpportunityLane[] {
  const lanes: CorridorOpportunityLane[] = [];

  if (svcr < 50) lanes.push("ownership_and_value_capture");
  if (scores.corridorControl < 60) lanes.push("corridor_control_and_contracts");
  if (scores.feedstockSecurity < 60) lanes.push("feedstock_and_supply_security");
  if (scores.localIndustrialization < 60) lanes.push("industrialization_and_local_content");
  if (scores.governanceRisk > 45) lanes.push("governance_and_transparency");
  if (scores.marketReach < 60) lanes.push("market_and_hinterland");
  if (scores.procurementReadiness >= 50 && scores.buyerAccess >= 50) {
    lanes.push("procurement_and_ppp_advisory");
  }

  return lanes;
}

function deriveDecision(
  strategicReadinessScore: number,
  sovereignValueCaptureRatio: number,
  scores: CorridorScoresInput
): { decision: CorridorDecision; decisionReasons: string[]; blockers: string[] } {
  const noGoReasons: string[] = [];

  if (sovereignValueCaptureRatio < 20) {
    noGoReasons.push(`SVCR ${formatted(sovereignValueCaptureRatio)} < 20`);
  }
  if (scores.corridorControl < 30) {
    noGoReasons.push(`Corridor control ${formatted(scores.corridorControl)} < 30`);
  }
  if (scores.feedstockSecurity < 30) {
    noGoReasons.push(`Feedstock security ${formatted(scores.feedstockSecurity)} < 30`);
  }
  if (scores.governanceRisk >= 75) {
    noGoReasons.push(`Governance risk ${formatted(scores.governanceRisk)} >= 75`);
  }

  if (noGoReasons.length > 0) {
    return {
      decision: "NO_GO",
      decisionReasons: noGoReasons,
      blockers: [...noGoReasons]
    };
  }

  const goChecks = [
    strategicReadinessScore >= 70,
    sovereignValueCaptureRatio >= 40,
    scores.corridorControl >= 50,
    scores.feedstockSecurity >= 50,
    scores.governanceRisk <= 45
  ];

  if (goChecks.every(Boolean)) {
    return {
      decision: "GO",
      decisionReasons: [
        `Strategic readiness ${formatted(strategicReadinessScore)} >= 70`,
        `SVCR ${formatted(sovereignValueCaptureRatio)} >= 40`,
        `Corridor control ${formatted(scores.corridorControl)} >= 50`,
        `Feedstock security ${formatted(scores.feedstockSecurity)} >= 50`,
        `Governance risk ${formatted(scores.governanceRisk)} <= 45`
      ],
      blockers: []
    };
  }

  const blockers: string[] = [];
  if (strategicReadinessScore < 70) blockers.push(`Strategic readiness ${formatted(strategicReadinessScore)} < 70`);
  if (sovereignValueCaptureRatio < 40) blockers.push(`SVCR ${formatted(sovereignValueCaptureRatio)} < 40`);
  if (scores.corridorControl < 50) blockers.push(`Corridor control ${formatted(scores.corridorControl)} < 50`);
  if (scores.feedstockSecurity < 50) blockers.push(`Feedstock security ${formatted(scores.feedstockSecurity)} < 50`);
  if (scores.governanceRisk > 45) blockers.push(`Governance risk ${formatted(scores.governanceRisk)} > 45`);

  return {
    decision: "HOLD",
    decisionReasons: [
      `HOLD: corridor is valid but ${blockers.length} GO condition${blockers.length === 1 ? "" : "s"} remain unmet.`
    ],
    blockers
  };
}

export function assessCorridorValueCapture(input: CorridorValueCaptureInput): CorridorValueCaptureAssessment {
  validateAssessmentInput(input);
  const value = computeSovereignValueCapture(input.economicValue);
  const scores = input.scores;

  const strategicReadinessScore = round(
    0.18 * scores.corridorControl +
    0.18 * scores.feedstockSecurity +
    0.16 * scores.infrastructureReadiness +
    0.14 * scores.marketReach +
    0.18 * scores.localIndustrialization +
    0.16 * value.sovereignValueCaptureRatio
  );

  const sovereigntyGap = round(100 - value.sovereignValueCaptureRatio);

  const afriagenesisOpportunityScore = round(
    0.35 * sovereigntyGap +
    0.20 * (100 - scores.corridorControl) +
    0.15 * (100 - scores.localIndustrialization) +
    0.10 * scores.governanceRisk +
    0.10 * scores.buyerAccess +
    0.10 * scores.procurementReadiness
  );

  const decision = deriveDecision(
    strategicReadinessScore,
    value.sovereignValueCaptureRatio,
    scores
  );

  const opportunityLanes = deriveOpportunityLanes(value.sovereignValueCaptureRatio, scores);
  const evidenceRefs = unique([...input.evidenceRefs, ...value.evidenceRefs]);

  return {
    anchor: GENESIS_V4_CORRIDOR_VALUE_CAPTURE_ANCHOR,
    corridorId: input.corridorId.trim(),
    corridorName: input.corridorName.trim(),
    countries: input.countries.map(country => country.trim()),
    assetClass: input.assetClass,
    asOf: new Date(input.asOf).toISOString(),
    currency: value.currency,
    totalEconomicValue: value.totalEconomicValue,
    classifiedValue: value.classifiedValue,
    unclassifiedValue: value.unclassifiedValue,
    localRetainedValue: value.localRetainedValue,
    valueCoverageRatio: value.valueCoverageRatio,
    sovereignValueCaptureRatio: value.sovereignValueCaptureRatio,
    sovereigntyGap,
    corridorControl: scores.corridorControl,
    feedstockSecurity: scores.feedstockSecurity,
    infrastructureReadiness: scores.infrastructureReadiness,
    marketReach: scores.marketReach,
    localIndustrialization: scores.localIndustrialization,
    governanceRisk: scores.governanceRisk,
    buyerAccess: scores.buyerAccess,
    procurementReadiness: scores.procurementReadiness,
    strategicReadinessScore,
    afriagenesisOpportunityScore,
    decision: decision.decision,
    decisionReasons: decision.decisionReasons,
    blockers: decision.blockers,
    opportunityLanes,
    evidenceRefs,
    remeEvents: [
      `corridor_assessed:${input.corridorId.trim()}`,
      `decision:${decision.decision}`,
      `svcr:${value.sovereignValueCaptureRatio}`,
      `opportunity_score:${afriagenesisOpportunityScore}`
    ]
  };
}
