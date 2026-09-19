export type MarketCaptureCellStatus =
  | "DRAFT"
  | "VALIDATING"
  | "ACTIVE"
  | "HOLD"
  | "KILLED"
  | "SCALE_READY";

export interface MarketCaptureClaims {
  realLocation: boolean;
  realProviderCoverage: boolean;
  uniqueUtility: boolean;
}

export interface MarketCaptureCell {
  cellId: string;
  countryCode: string;
  territoryCode: string;
  territoryName: string;
  sector: string;
  intentCode: string;
  intentLabel: string;
  status: MarketCaptureCellStatus;
  channels: {
    web: boolean;
    phone: boolean;
    whatsapp: boolean;
  };
  claims: MarketCaptureClaims;
}

export type LeadUrgency = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface LeadQualificationInput {
  cellId: string;
  leadId: string;
  contactPresent: boolean;
  territoryConfirmed: boolean;
  intentConfirmed: boolean;
  urgency: LeadUrgency;
  providerCoverageConfirmed: boolean;
  budgetAmount?: number;
  availabilityWindow?: string;
  problemDescription?: string;
}

export interface LeadQualificationResult {
  qualified: boolean;
  score: number;
  reasons: string[];
  routeEligible: boolean;
}

export interface CellEconomicsInput {
  cellId: string;
  attributedRevenue: number;
  cellCost: number;
  qualifiedLeads: number;
  calls: number;
  closedSales: number;
}

export interface CellEconomicsResult extends CellEconomicsInput {
  rmcc: number | null;
  revenuePerLead: number | null;
  revenuePerCall: number | null;
  providerCloseRate: number | null;
}

export interface CellScaleDecisionInput {
  claims: MarketCaptureClaims;
  economics: CellEconomicsInput;
  minimumQualifiedLeads?: number;
}

export interface CellScaleDecision {
  decision: "KILL" | "HOLD" | "SCALE";
  reasons: string[];
  rmcc: number | null;
  minimumQualifiedLeads: number;
}

export const MARKET_CAPTURE_TOOL_SCOPES = {
  "genesis.market_capture.compile_cell": "market-capture:compile",
  "genesis.market_capture.qualify_lead": "market-capture:qualify",
  "genesis.market_capture.evaluate_economics": "market-capture:economics",
  "genesis.market_capture.decide_scale": "market-capture:decide"
} as const;

const CELL_STATUSES = new Set<MarketCaptureCellStatus>([
  "DRAFT",
  "VALIDATING",
  "ACTIVE",
  "HOLD",
  "KILLED",
  "SCALE_READY"
]);

const URGENCIES = new Set<LeadUrgency>(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`MARKET_CAPTURE_INVALID: ${name} is required`);
  }
  return value.trim();
}

function requiredBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`MARKET_CAPTURE_INVALID: ${name} must be boolean`);
  }
  return value;
}

function nonNegativeFinite(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`MARKET_CAPTURE_INVALID: ${name} must be a finite number >= 0`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, name: string): number {
  const numeric = nonNegativeFinite(value, name);
  if (!Number.isInteger(numeric)) {
    throw new Error(`MARKET_CAPTURE_INVALID: ${name} must be an integer >= 0`);
  }
  return numeric;
}

function round(value: number, decimals = 6): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function validateClaims(claims: MarketCaptureClaims): MarketCaptureClaims {
  if (!claims || typeof claims !== "object") {
    throw new Error("MARKET_CAPTURE_INVALID: claims are required");
  }
  return {
    realLocation: requiredBoolean(claims.realLocation, "claims.realLocation"),
    realProviderCoverage: requiredBoolean(claims.realProviderCoverage, "claims.realProviderCoverage"),
    uniqueUtility: requiredBoolean(claims.uniqueUtility, "claims.uniqueUtility")
  };
}

function validateCellId(cell: Pick<MarketCaptureCell, "cellId" | "countryCode" | "territoryCode" | "intentCode">): void {
  const expected = `${cell.countryCode}-${cell.territoryCode}-${cell.intentCode}`.toUpperCase();
  if (cell.cellId.toUpperCase() !== expected) {
    throw new Error(`MARKET_CAPTURE_INVALID: cellId must equal ${expected}`);
  }
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(cell.cellId)) {
    throw new Error("MARKET_CAPTURE_INVALID: cellId format is invalid");
  }
}

export function compileMarketCaptureCell(input: MarketCaptureCell): MarketCaptureCell {
  if (!input || typeof input !== "object") {
    throw new Error("MARKET_CAPTURE_INVALID: cell input is required");
  }

  const cell: MarketCaptureCell = {
    cellId: requiredString(input.cellId, "cellId").toUpperCase(),
    countryCode: requiredString(input.countryCode, "countryCode").toUpperCase(),
    territoryCode: requiredString(input.territoryCode, "territoryCode").toUpperCase(),
    territoryName: requiredString(input.territoryName, "territoryName"),
    sector: requiredString(input.sector, "sector"),
    intentCode: requiredString(input.intentCode, "intentCode").toUpperCase(),
    intentLabel: requiredString(input.intentLabel, "intentLabel"),
    status: input.status,
    channels: {
      web: requiredBoolean(input.channels?.web, "channels.web"),
      phone: requiredBoolean(input.channels?.phone, "channels.phone"),
      whatsapp: requiredBoolean(input.channels?.whatsapp, "channels.whatsapp")
    },
    claims: validateClaims(input.claims)
  };

  if (!CELL_STATUSES.has(cell.status)) {
    throw new Error("MARKET_CAPTURE_INVALID: unsupported cell status");
  }
  if (!/^[A-Z]{2}$/.test(cell.countryCode)) {
    throw new Error("MARKET_CAPTURE_INVALID: countryCode must be ISO-like alpha-2");
  }
  validateCellId(cell);

  if (cell.status === "ACTIVE" || cell.status === "SCALE_READY") {
    if (!cell.claims.realLocation) {
      throw new Error("MARKET_CAPTURE_FAIL_CLOSED: ACTIVE/SCALE_READY cell requires a real location claim");
    }
    if (!cell.claims.realProviderCoverage) {
      throw new Error("MARKET_CAPTURE_FAIL_CLOSED: ACTIVE/SCALE_READY cell requires real provider coverage");
    }
    if (!cell.claims.uniqueUtility) {
      throw new Error("MARKET_CAPTURE_FAIL_CLOSED: ACTIVE/SCALE_READY cell requires unique utility");
    }
  }

  return cell;
}

function urgencyPoints(urgency: LeadUrgency): number {
  switch (urgency) {
    case "LOW": return 0;
    case "MEDIUM": return 5;
    case "HIGH": return 10;
    case "CRITICAL": return 15;
    default:
      throw new Error("MARKET_CAPTURE_INVALID: unsupported urgency");
  }
}

export function qualifyLead(input: LeadQualificationInput): LeadQualificationResult {
  requiredString(input?.cellId, "cellId");
  requiredString(input?.leadId, "leadId");
  requiredBoolean(input?.contactPresent, "contactPresent");
  requiredBoolean(input?.territoryConfirmed, "territoryConfirmed");
  requiredBoolean(input?.intentConfirmed, "intentConfirmed");
  requiredBoolean(input?.providerCoverageConfirmed, "providerCoverageConfirmed");
  if (!URGENCIES.has(input?.urgency)) {
    throw new Error("MARKET_CAPTURE_INVALID: urgency must be LOW, MEDIUM, HIGH or CRITICAL");
  }
  if (input.budgetAmount !== undefined) nonNegativeFinite(input.budgetAmount, "budgetAmount");
  if (input.availabilityWindow !== undefined) requiredString(input.availabilityWindow, "availabilityWindow");
  if (input.problemDescription !== undefined) requiredString(input.problemDescription, "problemDescription");

  const reasons: string[] = [];
  let score = 0;
  if (input.contactPresent) score += 20;
  else reasons.push("CONTACT_MISSING");
  if (input.territoryConfirmed) score += 20;
  else reasons.push("TERRITORY_UNCONFIRMED");
  if (input.intentConfirmed) score += 20;
  else reasons.push("INTENT_UNCONFIRMED");
  if (input.providerCoverageConfirmed) score += 20;
  else reasons.push("PROVIDER_COVERAGE_UNCONFIRMED");

  const hardRequirementsConfirmed =
    input.contactPresent
    && input.territoryConfirmed
    && input.intentConfirmed
    && input.providerCoverageConfirmed;

  if (hardRequirementsConfirmed) reasons.push("HARD_REQUIREMENTS_CONFIRMED");
  score = Math.min(100, score + urgencyPoints(input.urgency));

  return {
    qualified: hardRequirementsConfirmed,
    score,
    reasons,
    routeEligible: hardRequirementsConfirmed
  };
}

export function calculateRMCC(input: CellEconomicsInput): CellEconomicsResult {
  const cellId = requiredString(input?.cellId, "cellId");
  const attributedRevenue = nonNegativeFinite(input?.attributedRevenue, "attributedRevenue");
  const cellCost = nonNegativeFinite(input?.cellCost, "cellCost");
  const qualifiedLeads = nonNegativeInteger(input?.qualifiedLeads, "qualifiedLeads");
  const calls = nonNegativeInteger(input?.calls, "calls");
  const closedSales = nonNegativeInteger(input?.closedSales, "closedSales");

  if (closedSales > qualifiedLeads) {
    throw new Error("MARKET_CAPTURE_INVALID: closedSales cannot exceed qualifiedLeads");
  }

  return {
    cellId,
    attributedRevenue,
    cellCost,
    qualifiedLeads,
    calls,
    closedSales,
    rmcc: cellCost > 0 ? round(attributedRevenue / cellCost) : null,
    revenuePerLead: qualifiedLeads > 0 ? round(attributedRevenue / qualifiedLeads) : null,
    revenuePerCall: calls > 0 ? round(attributedRevenue / calls) : null,
    providerCloseRate: qualifiedLeads > 0 ? round(closedSales / qualifiedLeads) : null
  };
}

export function decideCellScale(input: CellScaleDecisionInput): CellScaleDecision {
  const claims = validateClaims(input?.claims);
  const economics = calculateRMCC(input?.economics);
  const minimumQualifiedLeads = input.minimumQualifiedLeads === undefined
    ? 5
    : nonNegativeInteger(input.minimumQualifiedLeads, "minimumQualifiedLeads");

  if (minimumQualifiedLeads < 1) {
    throw new Error("MARKET_CAPTURE_INVALID: minimumQualifiedLeads must be >= 1");
  }

  const killReasons: string[] = [];
  if (!claims.realLocation) killReasons.push("FALSE_LOCATION_CLAIM");
  if (!claims.realProviderCoverage) killReasons.push("NO_REAL_PROVIDER_COVERAGE");

  if (killReasons.length > 0) {
    return {
      decision: "KILL",
      reasons: killReasons,
      rmcc: economics.rmcc,
      minimumQualifiedLeads
    };
  }

  const holdReasons: string[] = [];
  if (!claims.uniqueUtility) holdReasons.push("UNIQUE_UTILITY_UNPROVEN");
  if (economics.qualifiedLeads < minimumQualifiedLeads) {
    holdReasons.push("INSUFFICIENT_QUALIFIED_LEAD_EVIDENCE");
  }
  if (economics.attributedRevenue <= 0) {
    holdReasons.push("NO_OBSERVED_ATTRIBUTED_REVENUE");
  }
  if (economics.rmcc === null || economics.rmcc < 2) {
    holdReasons.push("RMCC_BELOW_SCALE_THRESHOLD");
  }

  if (holdReasons.length > 0) {
    return {
      decision: "HOLD",
      reasons: holdReasons,
      rmcc: economics.rmcc,
      minimumQualifiedLeads
    };
  }

  return {
    decision: "SCALE",
    reasons: ["SAFETY_AND_ECONOMIC_THRESHOLDS_CONFIRMED"],
    rmcc: economics.rmcc,
    minimumQualifiedLeads
  };
}

function pilotCell(
  territoryCode: "COT" | "CAL",
  territoryName: "Cotonou" | "Abomey-Calavi",
  intentCode: string,
  intentLabel: string
): MarketCaptureCell {
  return compileMarketCaptureCell({
    cellId: `BJ-${territoryCode}-${intentCode}`,
    countryCode: "BJ",
    territoryCode,
    territoryName,
    sector: "climatisation-froid",
    intentCode,
    intentLabel,
    status: "DRAFT",
    channels: { web: true, phone: false, whatsapp: false },
    claims: {
      realLocation: true,
      realProviderCoverage: false,
      uniqueUtility: false
    }
  });
}

export const BENIN_CLIMATE_COLD_PILOT_CELLS: readonly MarketCaptureCell[] = Object.freeze([
  pilotCell("COT", "Cotonou", "AC-REPAIR", "dépannage climatisation"),
  pilotCell("COT", "Cotonou", "AC-INSTALL", "installation climatiseur"),
  pilotCell("COT", "Cotonou", "AC-MAINT", "entretien climatisation"),
  pilotCell("COT", "Cotonou", "COLD-REPAIR", "dépannage froid commercial"),
  pilotCell("COT", "Cotonou", "AC-URGENT", "intervention urgente climatisation"),
  pilotCell("CAL", "Abomey-Calavi", "AC-REPAIR", "dépannage climatisation"),
  pilotCell("CAL", "Abomey-Calavi", "AC-INSTALL", "installation climatiseur"),
  pilotCell("CAL", "Abomey-Calavi", "AC-MAINT", "entretien climatisation"),
  pilotCell("CAL", "Abomey-Calavi", "COLD-REPAIR", "dépannage froid commercial"),
  pilotCell("CAL", "Abomey-Calavi", "AC-URGENT", "intervention urgente climatisation")
]);
