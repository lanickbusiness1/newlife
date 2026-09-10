import { z } from "zod";

export const GENESIS_V4_DELIVERY_TO_BANKABILITY_ANCHOR = {
  assetId: "GEN-V4-DELIVERY-TO-BANKABILITY-GATE-001",
  decisionId: "V4-DEC-036",
  version: "0.1.0",
  proofMode: "deterministic-fail-closed"
} as const;

export const DELIVERY_TO_BANKABILITY_WEIGHTS = {
  deliveryCostSchedule: 20,
  commissioning: 15,
  operationalPerformance: 20,
  continuityAvailability: 10,
  governanceControl: 10,
  financialDiscipline: 10,
  compliance: 5,
  evidenceQuality: 10
} as const;

const ScoreSchema = z.number().min(0).max(100);

const DimensionScoresSchema = z.object({
  deliveryCostSchedule: ScoreSchema,
  commissioning: ScoreSchema,
  operationalPerformance: ScoreSchema,
  continuityAvailability: ScoreSchema,
  governanceControl: ScoreSchema,
  financialDiscipline: ScoreSchema,
  compliance: ScoreSchema,
  evidenceQuality: ScoreSchema
});

const DeliveryToBankabilityInputSchema = z.object({
  dimensionScores: DimensionScoresSchema,
  deliveryStage: z.enum([
    "ANNOUNCED",
    "CONTRACTED",
    "FINANCED",
    "BUILT",
    "COMMISSIONED",
    "OPERATIONAL",
    "PERFORMING",
    "OUTCOME_VERIFIED"
  ]),
  commissioningStatus: z.enum(["VERIFIED", "PARTIAL", "FAILED", "UNKNOWN"]),
  operationalStatus: z.enum(["VERIFIED", "PARTIAL", "FAILED", "UNKNOWN"]),
  performanceEvidenceStatus: z.enum(["VERIFIED", "PARTIAL", "ABSENT", "DISPUTED"]),
  materialDisputeStatus: z.enum(["NONE", "RESOLVED", "UNRESOLVED", "UNKNOWN"]),
  evidenceRefs: z.array(z.string().min(1)),
  criticalDependencyReadiness: z.enum([
    "VERIFIED",
    "CONDITIONAL",
    "BLOCKED",
    "UNKNOWN",
    "NOT_APPLICABLE"
  ])
});

export type DeliveryToBankabilityInput = z.infer<typeof DeliveryToBankabilityInputSchema>;
export type DeliveryToBankabilityDecision =
  | "PROVEN_OPERATOR"
  | "CONDITIONALLY_PROVEN"
  | "LIMITED_TRACK_RECORD"
  | "UNPROVEN"
  | "DISPUTED"
  | "INVALID_INPUT";

type ScoreKey = keyof typeof DELIVERY_TO_BANKABILITY_WEIGHTS;
type WeightedBreakdown = Record<ScoreKey, number>;

export type DeliveryToBankabilityResult = {
  assetId: typeof GENESIS_V4_DELIVERY_TO_BANKABILITY_ANCHOR.assetId;
  decisionId: typeof GENESIS_V4_DELIVERY_TO_BANKABILITY_ANCHOR.decisionId;
  version: typeof GENESIS_V4_DELIVERY_TO_BANKABILITY_ANCHOR.version;
  decision: DeliveryToBankabilityDecision;
  score: number;
  canClaimDelivered: boolean;
  canUpdateBankability: boolean;
  blockers: string[];
  weightedBreakdown: WeightedBreakdown;
};

type ScoredDecision = Exclude<DeliveryToBankabilityDecision, "DISPUTED" | "INVALID_INPUT">;

const DECISION_RANK: Record<ScoredDecision, number> = {
  UNPROVEN: 0,
  LIMITED_TRACK_RECORD: 1,
  CONDITIONALLY_PROVEN: 2,
  PROVEN_OPERATOR: 3
};

function emptyBreakdown(): WeightedBreakdown {
  return {
    deliveryCostSchedule: 0,
    commissioning: 0,
    operationalPerformance: 0,
    continuityAvailability: 0,
    governanceControl: 0,
    financialDiscipline: 0,
    compliance: 0,
    evidenceQuality: 0
  };
}

function invalidResult(): DeliveryToBankabilityResult {
  return {
    assetId: GENESIS_V4_DELIVERY_TO_BANKABILITY_ANCHOR.assetId,
    decisionId: GENESIS_V4_DELIVERY_TO_BANKABILITY_ANCHOR.decisionId,
    version: GENESIS_V4_DELIVERY_TO_BANKABILITY_ANCHOR.version,
    decision: "INVALID_INPUT",
    score: 0,
    canClaimDelivered: false,
    canUpdateBankability: false,
    blockers: ["INVALID_INPUT"],
    weightedBreakdown: emptyBreakdown()
  };
}

function scoreDecision(score: number): ScoredDecision {
  if (score >= 80) return "PROVEN_OPERATOR";
  if (score >= 65) return "CONDITIONALLY_PROVEN";
  if (score >= 45) return "LIMITED_TRACK_RECORD";
  return "UNPROVEN";
}

function capDecision(current: ScoredDecision, cap: ScoredDecision): ScoredDecision {
  return DECISION_RANK[current] <= DECISION_RANK[cap] ? current : cap;
}

function computeWeightedScore(scores: z.infer<typeof DimensionScoresSchema>) {
  const weightedBreakdown = {} as WeightedBreakdown;
  let total = 0;

  for (const key of Object.keys(DELIVERY_TO_BANKABILITY_WEIGHTS) as ScoreKey[]) {
    const contribution = (scores[key] * DELIVERY_TO_BANKABILITY_WEIGHTS[key]) / 100;
    weightedBreakdown[key] = contribution;
    total += contribution;
  }

  return {
    score: Math.round(total * 100) / 100,
    weightedBreakdown
  };
}

export function evaluateDeliveryToBankability(input: unknown): DeliveryToBankabilityResult {
  const parsed = DeliveryToBankabilityInputSchema.safeParse(input);
  if (!parsed.success) return invalidResult();

  const data = parsed.data;
  const { score, weightedBreakdown } = computeWeightedScore(data.dimensionScores);
  const blockers: string[] = [];
  let decision: ScoredDecision = scoreDecision(score);
  let disputed = false;

  if (data.deliveryStage !== "OUTCOME_VERIFIED") {
    blockers.push("OUTCOME_NOT_VERIFIED");
    decision = "UNPROVEN";
  }

  if (data.commissioningStatus === "FAILED") {
    blockers.push("COMMISSIONING_FAILED");
    decision = "UNPROVEN";
  } else if (data.commissioningStatus !== "VERIFIED") {
    blockers.push("COMMISSIONING_NOT_VERIFIED");
    decision = "UNPROVEN";
  }

  if (data.operationalStatus === "FAILED") {
    blockers.push("OPERATIONAL_STATUS_FAILED");
    decision = "UNPROVEN";
  } else if (data.operationalStatus !== "VERIFIED") {
    blockers.push("OPERATIONAL_STATUS_NOT_VERIFIED");
    decision = "UNPROVEN";
  }

  if (data.performanceEvidenceStatus === "DISPUTED") {
    blockers.push("PERFORMANCE_EVIDENCE_DISPUTED");
    disputed = true;
  } else if (data.performanceEvidenceStatus === "ABSENT") {
    blockers.push("PERFORMANCE_EVIDENCE_ABSENT");
    decision = "UNPROVEN";
  } else if (data.performanceEvidenceStatus === "PARTIAL") {
    blockers.push("PERFORMANCE_EVIDENCE_PARTIAL");
    decision = capDecision(decision, "CONDITIONALLY_PROVEN");
  }

  if (data.materialDisputeStatus === "UNRESOLVED") {
    blockers.push("MATERIAL_EXECUTION_DISPUTE_UNRESOLVED");
    disputed = true;
  } else if (data.materialDisputeStatus === "UNKNOWN") {
    blockers.push("MATERIAL_EXECUTION_DISPUTE_UNKNOWN");
    decision = capDecision(decision, "CONDITIONALLY_PROVEN");
  }

  if (data.evidenceRefs.length === 0) {
    blockers.push("DELIVERY_EVIDENCE_MISSING");
    decision = "UNPROVEN";
  }

  if (data.criticalDependencyReadiness === "BLOCKED") {
    blockers.push("CRITICAL_DEPENDENCY_BLOCKED");
    decision = "UNPROVEN";
  } else if (
    data.criticalDependencyReadiness === "UNKNOWN" ||
    data.criticalDependencyReadiness === "CONDITIONAL"
  ) {
    blockers.push("CRITICAL_DEPENDENCY_NOT_VERIFIED");
    decision = capDecision(decision, "CONDITIONALLY_PROVEN");
  }

  const finalDecision: DeliveryToBankabilityDecision = disputed ? "DISPUTED" : decision;
  const canClaimDelivered = finalDecision === "PROVEN_OPERATOR" && blockers.length === 0;
  const canUpdateBankability =
    finalDecision === "PROVEN_OPERATOR" ||
    finalDecision === "CONDITIONALLY_PROVEN" ||
    finalDecision === "LIMITED_TRACK_RECORD";

  return {
    assetId: GENESIS_V4_DELIVERY_TO_BANKABILITY_ANCHOR.assetId,
    decisionId: GENESIS_V4_DELIVERY_TO_BANKABILITY_ANCHOR.decisionId,
    version: GENESIS_V4_DELIVERY_TO_BANKABILITY_ANCHOR.version,
    decision: finalDecision,
    score,
    canClaimDelivered,
    canUpdateBankability,
    blockers,
    weightedBreakdown
  };
}
