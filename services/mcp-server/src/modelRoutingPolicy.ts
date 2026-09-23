export const GENESIS_V4_MODEL_ROUTING_ANCHOR = {
  decisionId: "ADR-V4-AI-ROUTING-002",
  policyVersion: "2026-09-23.1",
  truthState: "CODED_NOT_PRODUCTION_PROVEN",
  sources: [
    "https://help.openai.com/en/articles/6825453-chatgpt-release-notes",
    "https://deploymentsafety.openai.com/gpt-6-astra/protocolqa-open-ended"
  ]
} as const;

export type ModelRoutingComplexity = "simple" | "standard" | "advanced" | "frontier";
export type ModelRoutingRisk = "low" | "medium" | "high" | "critical";
export type ModelRoutingDataClassification = "public" | "internal" | "confidential" | "restricted";
export type ModelRoutingPriority = "cost" | "balanced" | "capability";
export type OpenAIModelRoute = "gpt-6-luna" | "gpt-6-sol" | "gpt-6-astra";

export interface ModelRoutingRequest {
  workloadId: string;
  complexity: ModelRoutingComplexity;
  risk: ModelRoutingRisk;
  dataClassification: ModelRoutingDataClassification;
  priority: ModelRoutingPriority;
  providerApprovedForClassification?: boolean;
  approvalContext?: string;
  requiresIndependentVerification?: boolean;
}

export interface ModelRoutingDecision {
  policyVersion: string;
  primaryModel: OpenAIModelRoute;
  fallbackModel: OpenAIModelRoute | null;
  executionSubstrate: "CLOUD" | "CONTROLLED_PROVIDER";
  verificationPolicy: "STANDARD" | "INDEPENDENT_REVIEW" | "HUMAN_APPROVAL_AND_INDEPENDENT_REVIEW";
  reasons: string[];
  evidenceRefs: string[];
  priceSignal: "GPT6_SOL_LUNA_50_PERCENT_BELOW_GPT56_PROMOTIONAL" | "CAPABILITY_FIRST";
  truthState: "ROUTING_DECISION_ONLY";
}

function assertRequest(request: ModelRoutingRequest) {
  if (!request || typeof request !== "object") throw new Error("MODEL_ROUTING_INVALID_REQUEST");
  if (!request.workloadId?.trim()) throw new Error("MODEL_ROUTING_WORKLOAD_ID_REQUIRED");

  if (request.dataClassification === "confidential" && !request.providerApprovedForClassification) {
    throw new Error("MODEL_ROUTING_CONTROLLED_PROVIDER_REQUIRED");
  }

  if (request.dataClassification === "restricted") {
    if (!request.providerApprovedForClassification) {
      throw new Error("MODEL_ROUTING_CONTROLLED_PROVIDER_REQUIRED");
    }
    if (!request.approvalContext?.trim()) {
      throw new Error("MODEL_ROUTING_APPROVAL_CONTEXT_REQUIRED");
    }
  }
}

export function routeOpenAIWorkload(request: ModelRoutingRequest): ModelRoutingDecision {
  assertRequest(request);

  const reasons: string[] = [];
  let primaryModel: OpenAIModelRoute;

  const capabilityFirst = request.priority === "capability"
    || request.complexity === "frontier"
    || request.risk === "critical";

  if (capabilityFirst) {
    primaryModel = "gpt-6-astra";
    reasons.push("CAPABILITY_FIRST_ROUTE");
  } else if (
    request.complexity === "simple"
    && request.risk === "low"
    && request.priority !== "capability"
  ) {
    primaryModel = "gpt-6-luna";
    reasons.push("LOW_RISK_COST_EFFICIENT_ROUTE");
  } else {
    primaryModel = "gpt-6-sol";
    reasons.push("BALANCED_CAPABILITY_COST_ROUTE");
  }

  const controlled = request.dataClassification === "confidential"
    || request.dataClassification === "restricted";
  if (controlled) reasons.push("CONTROLLED_PROVIDER_REQUIRED");

  const highAssurance = request.risk === "high"
    || request.risk === "critical"
    || request.requiresIndependentVerification === true;
  if (highAssurance) reasons.push("INDEPENDENT_VERIFICATION_REQUIRED");

  const restricted = request.dataClassification === "restricted";
  if (restricted) reasons.push("HUMAN_APPROVAL_CONTEXT_VERIFIED");

  const fallbackModel: OpenAIModelRoute | null = primaryModel === "gpt-6-astra"
    ? "gpt-6-sol"
    : primaryModel === "gpt-6-sol"
      ? "gpt-6-luna"
      : null;

  return {
    policyVersion: GENESIS_V4_MODEL_ROUTING_ANCHOR.policyVersion,
    primaryModel,
    fallbackModel,
    executionSubstrate: controlled ? "CONTROLLED_PROVIDER" : "CLOUD",
    verificationPolicy: restricted
      ? "HUMAN_APPROVAL_AND_INDEPENDENT_REVIEW"
      : highAssurance
        ? "INDEPENDENT_REVIEW"
        : "STANDARD",
    reasons,
    evidenceRefs: [...GENESIS_V4_MODEL_ROUTING_ANCHOR.sources],
    priceSignal: primaryModel === "gpt-6-astra"
      ? "CAPABILITY_FIRST"
      : "GPT6_SOL_LUNA_50_PERCENT_BELOW_GPT56_PROMOTIONAL",
    truthState: "ROUTING_DECISION_ONLY"
  };
}
