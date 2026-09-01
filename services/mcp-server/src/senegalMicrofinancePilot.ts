import { z } from "zod";

export const GENESIS_V4_SENEGAL_MICROFINANCE_ANCHOR = {
  signalId: "SIG-SN-MICROFINANCE-20260901",
  parentAssetId: "PRD-AFRIAPAY-001",
  moduleAssetId: "MOD-PAY-SOCIAL-SELLER-001",
  name: "Senegal Microfinance Country Use-Case",
  country: "SN",
  regulatoryZone: "UEMOA/BCEAO",
  commercialProduct: false,
  governance: "EXTEND_EXISTING",
  version: "0.1.0"
} as const;

export type SenegalMicrofinancePilotStatus = "HOLD" | "GO_DESIGN" | "READY_FOR_PILOT";

export type SenegalMicrofinancePilotInput = {
  pilotId: string;
  officialEvidenceRefs: string[];
  partnerEvidenceRefs: string[];
  regulatoryReviewStatus: "NOT_STARTED" | "IN_REVIEW" | "CLEARED";
  consentAndDataGovernanceReady: boolean;
  imfIntegrationReady: boolean;
  mobileMoneyIntegrationReady: boolean;
  financialPassportReady: boolean;
  impactMeasurementReady: boolean;
};

export type SenegalMicrofinancePilotDecision = {
  pilotId: string;
  status: SenegalMicrofinancePilotStatus;
  blockers: string[];
  guardrails: string[];
  anchor: typeof GENESIS_V4_SENEGAL_MICROFINANCE_ANCHOR;
};

const PilotInputSchema = z.object({
  pilotId: z.string().min(1),
  officialEvidenceRefs: z.array(z.string().min(1)).default([]),
  partnerEvidenceRefs: z.array(z.string().min(1)).default([]),
  regulatoryReviewStatus: z.enum(["NOT_STARTED", "IN_REVIEW", "CLEARED"]),
  consentAndDataGovernanceReady: z.boolean(),
  imfIntegrationReady: z.boolean(),
  mobileMoneyIntegrationReady: z.boolean(),
  financialPassportReady: z.boolean(),
  impactMeasurementReady: z.boolean()
});

const GUARDRAILS = [
  "NO_AUTOMATED_CREDIT_DECISION",
  "PARTNER_AUTHORITY_REQUIRED_FOR_CREDIT_DECISION",
  "EXPLICIT_CONSENT_REQUIRED_FOR_DATA_SHARING",
  "OFFICIAL_EVIDENCE_REQUIRED_FOR_POLICY_CLAIMS",
  "PARTNER_EVIDENCE_REQUIRED_FOR_INTEGRATION_CLAIMS"
] as const;

function invalidDecision(input: unknown): SenegalMicrofinancePilotDecision {
  const pilotId =
    typeof input === "object" && input !== null && "pilotId" in input && typeof (input as any).pilotId === "string"
      ? (input as any).pilotId
      : "unknown";

  return {
    pilotId,
    status: "HOLD",
    blockers: ["INVALID_INPUT"],
    guardrails: [...GUARDRAILS],
    anchor: GENESIS_V4_SENEGAL_MICROFINANCE_ANCHOR
  };
}

function readinessBlockers(input: SenegalMicrofinancePilotInput): string[] {
  const blockers: string[] = [];

  if (input.officialEvidenceRefs.length === 0) blockers.push("UNVERIFIED_PUBLIC_SIGNAL");
  if (input.partnerEvidenceRefs.length === 0) blockers.push("UNVERIFIED_PARTNER_ACCESS");
  if (input.regulatoryReviewStatus !== "CLEARED") blockers.push("REGULATORY_CLEARANCE_PENDING");
  if (!input.consentAndDataGovernanceReady) blockers.push("DATA_GOVERNANCE_NOT_READY");
  if (!input.imfIntegrationReady) blockers.push("IMF_INTEGRATION_NOT_READY");
  if (!input.mobileMoneyIntegrationReady) blockers.push("MOBILE_MONEY_INTEGRATION_NOT_READY");
  if (!input.financialPassportReady) blockers.push("FINANCIAL_PASSPORT_NOT_READY");
  if (!input.impactMeasurementReady) blockers.push("IMPACT_MEASUREMENT_NOT_READY");

  return blockers;
}

export function evaluateSenegalMicrofinancePilot(input: unknown): SenegalMicrofinancePilotDecision {
  const parsed = PilotInputSchema.safeParse(input);
  if (!parsed.success) return invalidDecision(input);

  const data: SenegalMicrofinancePilotInput = parsed.data;
  const blockers = readinessBlockers(data);

  if (blockers.includes("UNVERIFIED_PUBLIC_SIGNAL")) {
    return {
      pilotId: data.pilotId,
      status: "HOLD",
      blockers,
      guardrails: [...GUARDRAILS],
      anchor: GENESIS_V4_SENEGAL_MICROFINANCE_ANCHOR
    };
  }

  return {
    pilotId: data.pilotId,
    status: blockers.length === 0 ? "READY_FOR_PILOT" : "GO_DESIGN",
    blockers,
    guardrails: [...GUARDRAILS],
    anchor: GENESIS_V4_SENEGAL_MICROFINANCE_ANCHOR
  };
}
