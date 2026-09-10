import { z } from "zod";

export const GENESIS_V4_IP_TO_CAPITAL_ANCHOR = {
  assetId: "GEN-V4-IP-TO-CAPITAL-READINESS-GATE-001",
  decisionId: "V4-DEC-035",
  version: "0.1.0",
  proofMode: "deterministic-fail-closed"
} as const;

export const IP_BANKABILITY_WEIGHTS = {
  ownershipChainOfTitle: 15,
  protectionEnforceability: 10,
  technicalEvidence: 10,
  marketEvidence: 15,
  monetizationCashflowAttribution: 15,
  valuationRobustness: 10,
  liquidityTransferability: 10,
  businessExecutionCapacity: 5,
  financingRepaymentLogic: 5,
  evidenceGovernance: 5
} as const;

const ScoreSchema = z.number().min(0).max(100);

const DimensionScoresSchema = z.object({
  ownershipChainOfTitle: ScoreSchema,
  protectionEnforceability: ScoreSchema,
  technicalEvidence: ScoreSchema,
  marketEvidence: ScoreSchema,
  monetizationCashflowAttribution: ScoreSchema,
  valuationRobustness: ScoreSchema,
  liquidityTransferability: ScoreSchema,
  businessExecutionCapacity: ScoreSchema,
  financingRepaymentLogic: ScoreSchema,
  evidenceGovernance: ScoreSchema
});

const IpToCapitalInputSchema = z.object({
  dimensionScores: DimensionScoresSchema,
  chainOfTitleStatus: z.enum(["VERIFIED", "PARTIAL", "DISPUTED", "UNKNOWN"]),
  protectionStatus: z.enum([
    "VERIFIED_ACTIVE",
    "VERIFIED_PENDING",
    "EXPIRED",
    "NOT_MAINTAINED",
    "NOT_REQUIRED_JUSTIFIED",
    "UNKNOWN"
  ]),
  protectionRequired: z.boolean(),
  criticalFinancialAssumptionsSourced: z.boolean(),
  hasMarketEvidence: z.boolean(),
  ipCashflowAttributable: z.boolean(),
  materialDisputeStatus: z.enum(["NONE", "RESOLVED", "UNRESOLVED", "UNKNOWN"]),
  transferabilityStatus: z.enum(["VERIFIED", "PARTIAL", "RESTRICTED", "NON_TRANSFERABLE", "UNKNOWN"]),
  targetGuaranteeProgram: z.string().min(1).optional(),
  guaranteeCriteriaVerified: z.boolean().optional(),
  valuationReference: z.number().nonnegative().optional(),
  riskHaircut: z.number().min(0).max(1).optional()
});

export type IpToCapitalInput = z.infer<typeof IpToCapitalInputSchema>;
export type IpToCapitalDecision = "READY" | "CONDITIONAL" | "RESTRUCTURE" | "NO_GO" | "INVALID_INPUT";
export type GuaranteeReadiness = "READY" | "CONDITIONAL" | "NOT_READY" | "UNKNOWN";

type ScoreKey = keyof typeof IP_BANKABILITY_WEIGHTS;

type WeightedBreakdown = Record<ScoreKey, number>;

export type IpToCapitalResult = {
  assetId: typeof GENESIS_V4_IP_TO_CAPITAL_ANCHOR.assetId;
  decisionId: typeof GENESIS_V4_IP_TO_CAPITAL_ANCHOR.decisionId;
  version: typeof GENESIS_V4_IP_TO_CAPITAL_ANCHOR.version;
  decision: IpToCapitalDecision;
  score: number;
  canPromoteM6: boolean;
  blockers: string[];
  weightedBreakdown: WeightedBreakdown;
  adjustedIpValue: number | null;
  guaranteeReadiness: GuaranteeReadiness;
};

const DECISION_RANK: Record<Exclude<IpToCapitalDecision, "INVALID_INPUT">, number> = {
  NO_GO: 0,
  RESTRUCTURE: 1,
  CONDITIONAL: 2,
  READY: 3
};

function invalidResult(): IpToCapitalResult {
  return {
    assetId: GENESIS_V4_IP_TO_CAPITAL_ANCHOR.assetId,
    decisionId: GENESIS_V4_IP_TO_CAPITAL_ANCHOR.decisionId,
    version: GENESIS_V4_IP_TO_CAPITAL_ANCHOR.version,
    decision: "INVALID_INPUT",
    score: 0,
    canPromoteM6: false,
    blockers: ["INVALID_INPUT"],
    weightedBreakdown: {
      ownershipChainOfTitle: 0,
      protectionEnforceability: 0,
      technicalEvidence: 0,
      marketEvidence: 0,
      monetizationCashflowAttribution: 0,
      valuationRobustness: 0,
      liquidityTransferability: 0,
      businessExecutionCapacity: 0,
      financingRepaymentLogic: 0,
      evidenceGovernance: 0
    },
    adjustedIpValue: null,
    guaranteeReadiness: "UNKNOWN"
  };
}

function scoreDecision(score: number): Exclude<IpToCapitalDecision, "INVALID_INPUT"> {
  if (score >= 80) return "READY";
  if (score >= 65) return "CONDITIONAL";
  if (score >= 45) return "RESTRUCTURE";
  return "NO_GO";
}

function capDecision(
  current: Exclude<IpToCapitalDecision, "INVALID_INPUT">,
  cap: Exclude<IpToCapitalDecision, "INVALID_INPUT">
): Exclude<IpToCapitalDecision, "INVALID_INPUT"> {
  return DECISION_RANK[current] <= DECISION_RANK[cap] ? current : cap;
}

function computeWeightedScore(scores: z.infer<typeof DimensionScoresSchema>) {
  const weightedBreakdown = {} as WeightedBreakdown;
  let total = 0;

  for (const key of Object.keys(IP_BANKABILITY_WEIGHTS) as ScoreKey[]) {
    const contribution = (scores[key] * IP_BANKABILITY_WEIGHTS[key]) / 100;
    weightedBreakdown[key] = contribution;
    total += contribution;
  }

  return {
    score: Math.round(total * 100) / 100,
    weightedBreakdown
  };
}

export function evaluateIpToCapitalReadiness(input: unknown): IpToCapitalResult {
  const parsed = IpToCapitalInputSchema.safeParse(input);
  if (!parsed.success) return invalidResult();

  const data = parsed.data;
  const { score, weightedBreakdown } = computeWeightedScore(data.dimensionScores);
  const blockers: string[] = [];
  let decision = scoreDecision(score);

  if (data.chainOfTitleStatus === "DISPUTED") {
    blockers.push("CHAIN_OF_TITLE_DISPUTED");
    decision = "NO_GO";
  } else if (data.chainOfTitleStatus !== "VERIFIED") {
    blockers.push("CHAIN_OF_TITLE_NOT_VERIFIED");
    decision = capDecision(decision, "CONDITIONAL");
  }

  if (data.protectionRequired) {
    if (data.protectionStatus === "EXPIRED") {
      blockers.push("PROTECTION_EXPIRED");
      decision = "NO_GO";
    } else if (data.protectionStatus === "NOT_MAINTAINED") {
      blockers.push("PROTECTION_NOT_MAINTAINED");
      decision = "NO_GO";
    } else if (data.protectionStatus !== "VERIFIED_ACTIVE") {
      blockers.push("PROTECTION_NOT_FULLY_VERIFIED");
      decision = capDecision(decision, "CONDITIONAL");
    }
  }

  if (!data.criticalFinancialAssumptionsSourced) {
    blockers.push("CRITICAL_FINANCIAL_ASSUMPTIONS_UNSOURCED");
    decision = capDecision(decision, "CONDITIONAL");
  }

  if (!data.hasMarketEvidence) {
    blockers.push("MARKET_EVIDENCE_ABSENT");
    decision = "NO_GO";
  }

  if (!data.ipCashflowAttributable) {
    blockers.push("IP_CASHFLOW_NOT_ATTRIBUTABLE");
    decision = "NO_GO";
  }

  if (data.materialDisputeStatus === "UNRESOLVED") {
    blockers.push("MATERIAL_DISPUTE_UNRESOLVED");
    decision = "NO_GO";
  } else if (data.materialDisputeStatus === "UNKNOWN") {
    blockers.push("MATERIAL_DISPUTE_STATUS_UNKNOWN");
    decision = capDecision(decision, "CONDITIONAL");
  }

  if (data.transferabilityStatus === "NON_TRANSFERABLE") {
    blockers.push("IP_NON_TRANSFERABLE");
    decision = capDecision(decision, "RESTRUCTURE");
  } else if (data.transferabilityStatus !== "VERIFIED") {
    blockers.push("TRANSFERABILITY_NOT_VERIFIED");
    decision = capDecision(decision, "CONDITIONAL");
  }

  const guaranteeCriteriaRequired = Boolean(data.targetGuaranteeProgram);
  if (guaranteeCriteriaRequired && data.guaranteeCriteriaVerified !== true) {
    blockers.push("GUARANTEE_CRITERIA_NOT_VERIFIED");
    decision = capDecision(decision, "CONDITIONAL");
  }

  const adjustedIpValue =
    data.valuationReference !== undefined && data.riskHaircut !== undefined
      ? Math.round(data.valuationReference * (1 - data.riskHaircut) * 100) / 100
      : null;

  let guaranteeReadiness: GuaranteeReadiness = "UNKNOWN";
  if (guaranteeCriteriaRequired && data.guaranteeCriteriaVerified === true) {
    guaranteeReadiness = decision === "READY"
      ? "READY"
      : decision === "NO_GO"
        ? "NOT_READY"
        : "CONDITIONAL";
  }

  return {
    assetId: GENESIS_V4_IP_TO_CAPITAL_ANCHOR.assetId,
    decisionId: GENESIS_V4_IP_TO_CAPITAL_ANCHOR.decisionId,
    version: GENESIS_V4_IP_TO_CAPITAL_ANCHOR.version,
    decision,
    score,
    canPromoteM6: decision === "READY" && blockers.length === 0,
    blockers,
    weightedBreakdown,
    adjustedIpValue,
    guaranteeReadiness
  };
}
