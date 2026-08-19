export const GENESIS_V4_CHATGPT_CONTROL_PLANE_ANCHOR = Object.freeze({
  assetId: "GENESIS-V4-CHATGPT-NATIVE-CONTROL-PLANE",
  genome: "GENESIS V4 Genome",
  mode: "extension_not_framework",
  authorityOrder: ["genome", "reme", "world_model", "project_context", "chatgpt_memory"] as const
});

type EnterpriseRef = {
  id: string;
  product?: string;
  stage?: string;
};

export type GenesisContextInput = {
  enterprise: EnterpriseRef;
  canonicalSources?: string[];
  worldState?: Record<string, unknown>;
  constraints?: string[];
  permissions?: string[];
  requiredControls?: string[];
  terminalGoal?: string;
  commercialGoal?: string;
};

function required(value: unknown, code: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(code);
  }
  return value.trim();
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(
    values
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map(value => value.trim())
  )];
}

function stableId(prefix: string, parts: string[]): string {
  let hash = 2166136261;
  for (const char of parts.join("|")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function compileGenesisContext(input: GenesisContextInput) {
  if (!input || typeof input !== "object") {
    throw new Error("GENESIS_CONTEXT_INVALID_INPUT");
  }

  const enterpriseId = required(input.enterprise?.id, "GENESIS_CONTEXT_ENTERPRISE_REQUIRED");
  const canonicalSources = uniqueStrings(input.canonicalSources);
  const requiredControls = uniqueStrings(input.requiredControls);
  const constraints = uniqueStrings(input.constraints);
  const permissions = uniqueStrings(input.permissions);
  const contextPacketId = stableId("gctx", [
    enterpriseId,
    ...canonicalSources,
    ...requiredControls,
    input.terminalGoal ?? "",
    input.commercialGoal ?? ""
  ]);

  return {
    contextPacketId,
    enterprise: { ...input.enterprise, id: enterpriseId },
    authority: {
      genome: "canonical",
      reme: "canonical_evidence_memory",
      worldModel: "dynamic_operational_state",
      projectContext: "bounded_working_context",
      chatgptMemory: "non_canonical_cache"
    },
    canonicalSources,
    worldState: input.worldState ?? {},
    constraints,
    permissions,
    requiredControls,
    terminalGoal: input.terminalGoal ?? null,
    commercialGoal: input.commercialGoal ?? null,
    nonRegression: ["no_duplicate_framework", "evidence_before_claims", "human_governance"],
    compiledFrom: ["GENOME", "REME", "WORLD_MODEL"]
  };
}

export type ControlTransitionInput = {
  who: string;
  state: string;
  goal: string;
  why: string;
  contextPacketId: string;
  tools?: string[];
  limits?: string[];
  evidence?: string[];
  gate: string;
};

export function compileControlTransition(input: ControlTransitionInput) {
  if (!input || typeof input !== "object") {
    throw new Error("GENESIS_CONTROL_INVALID_INPUT");
  }

  const missing = [
    ["who", input.who],
    ["state", input.state],
    ["goal", input.goal],
    ["why", input.why],
    ["contextPacketId", input.contextPacketId],
    ["gate", input.gate]
  ]
    .filter(([, value]) => typeof value !== "string" || value.trim().length === 0)
    .map(([key]) => key);

  const tools = uniqueStrings(input.tools);
  const limits = uniqueStrings(input.limits);
  const evidence = uniqueStrings(input.evidence);
  const blockers = missing.map(key => `missing:${key}`);

  if (tools.length === 0) blockers.push("missing:tools");
  if (evidence.length === 0) blockers.push("missing:evidence");

  const status = blockers.length === 0 ? "READY" : "BLOCKED";
  const nextGate = status === "READY" ? "M6" : "CONTEXT_REPAIR";

  return {
    commandId: stableId("gcmd", [
      input.who ?? "",
      input.state ?? "",
      input.goal ?? "",
      input.contextPacketId ?? "",
      input.gate ?? ""
    ]),
    decision: status === "READY" ? "EXECUTE_GOVERNED_TRANSITION" : "REPAIR_INPUT",
    status,
    action: { tools, limits },
    evidence,
    stateChange: {
      from: input.state || null,
      target: status === "READY" ? input.goal : null
    },
    risk: status === "READY"
      ? "bounded_by_permissions_and_gates"
      : "unbounded_due_to_missing_contract_fields",
    cost: "measure_in_metabolism_engine",
    value: "measure_against_goal_and_revenue_state",
    nextGate,
    remeUpdate: status === "READY" ? "candidate_after_outcome_evaluation" : "none",
    blockers
  };
}

export type PromotionTarget = "project_context" | "world_model" | "reme" | "genome";

export type PromotionInput = {
  candidateId: string;
  source: string;
  requestedTarget: PromotionTarget;
  evidenceRefs?: string[];
  confidence: number;
  controls?: {
    m6Passed?: boolean;
    m8Passed?: boolean;
    ceoValidated?: boolean;
    outcomeEvaluated?: boolean;
  };
};

export function evaluateKnowledgePromotion(input: PromotionInput) {
  if (!input || typeof input !== "object") {
    throw new Error("GENESIS_PROMOTION_INVALID_INPUT");
  }

  required(input.candidateId, "GENESIS_PROMOTION_CANDIDATE_REQUIRED");
  required(input.source, "GENESIS_PROMOTION_SOURCE_REQUIRED");

  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    throw new Error("GENESIS_PROMOTION_INVALID_CONFIDENCE");
  }

  const evidenceRefs = uniqueStrings(input.evidenceRefs);
  const controls = input.controls ?? {};
  const reasons: string[] = [];
  let requiredGates: string[] = [];
  let status: "PROMOTABLE" | "REVIEW_REQUIRED" | "REJECTED" = "PROMOTABLE";

  if (input.requestedTarget === "project_context") {
    requiredGates = [];
  } else if (input.requestedTarget === "world_model") {
    requiredGates = ["EVIDENCE"];
    if (evidenceRefs.length === 0 || input.confidence < 0.65) {
      status = "REVIEW_REQUIRED";
      reasons.push("world_model_requires_evidence_and_confidence_gte_0_65");
    }
  } else if (input.requestedTarget === "reme") {
    requiredGates = ["EVIDENCE", "M6", "OUTCOME_EVALUATED"];
    if (evidenceRefs.length === 0 || !controls.m6Passed || !controls.outcomeEvaluated) {
      status = "REVIEW_REQUIRED";
      reasons.push("reme_requires_evidence_m6_and_evaluated_outcome");
    }
  } else if (input.requestedTarget === "genome") {
    requiredGates = ["EVIDENCE", "M8", "CEO_VALIDATION"];
    if (evidenceRefs.length === 0 || !controls.m8Passed || !controls.ceoValidated) {
      status = "REVIEW_REQUIRED";
      reasons.push("genome_requires_evidence_m8_and_explicit_ceo_validation");
    }
  } else {
    status = "REJECTED";
    reasons.push("unknown_target");
  }

  if (input.source === "chatgpt-memory" && input.requestedTarget === "genome") {
    reasons.push("chatgpt_memory_never_bypasses_canonical_gates");
  }

  return {
    candidateId: input.candidateId,
    source: input.source,
    target: input.requestedTarget,
    status,
    evidenceRefs,
    confidence: input.confidence,
    requiredGates,
    reasons,
    authorityRule: "ChatGPT Memory is non-canonical; GENOME and R.E.M.E promotion is evidence-gated."
  };
}
