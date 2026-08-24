import type { CapitalizationPlan, CapitalizationProof } from "./livingIntellectualCapitalization.js";

export type RemePromotionTarget = {
  targetId: string;
  type: "reme";
  destinationRef: string;
  action: "promote_candidate";
  requiredEvidenceType: "connector_receipt";
  idempotencyKey: string;
  status: "PLANNED";
};

function required(value: unknown, code: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(code);
  }
  return value.trim();
}

function stableId(prefix: string, parts: string[]): string {
  let hash = 2166136261;
  for (const char of parts.join("|")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function compileRemePromotion(
  plan: CapitalizationPlan,
  proof: CapitalizationProof,
  destinationRef: string
): RemePromotionTarget {
  if (!plan || !proof || proof.planId !== plan.planId) {
    throw new Error("REME_PROMOTION_PLAN_PROOF_MISMATCH");
  }
  if (proof.status !== "COMPLETE" || proof.nextGate !== "REME_CANDIDATE") {
    throw new Error("REME_PROMOTION_REQUIRES_COMPLETE_PROOF");
  }

  const destination = required(destinationRef, "REME_PROMOTION_DESTINATION_REQUIRED");

  return {
    targetId: stableId("target", [plan.signalId, "reme", destination]),
    type: "reme",
    destinationRef: destination,
    action: "promote_candidate",
    requiredEvidenceType: "connector_receipt",
    idempotencyKey: stableId("idem", [plan.fingerprint, "reme", destination]),
    status: "PLANNED"
  };
}
