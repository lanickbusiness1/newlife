import { createHash } from "node:crypto";
import type { CapitalizationPlan, CapitalizationProof, CapitalizationTarget } from "./livingIntellectualCapitalization.js";

function required(value: unknown, code: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(code);
  }
  return value.trim();
}

function digest(prefix: string, parts: unknown[]): string {
  return `${prefix}-${createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32)}`;
}

export function compileRemePromotion(
  plan: CapitalizationPlan,
  proof: CapitalizationProof,
  destinationRef: string
): CapitalizationTarget {
  if (!plan || !proof || proof.planId !== plan.planId || proof.tenantId !== plan.tenantId) {
    throw new Error("REME_PROMOTION_PLAN_PROOF_MISMATCH");
  }
  if (proof.status !== "COMPLETE" || proof.nextGate !== "REME_CANDIDATE") {
    throw new Error("REME_PROMOTION_REQUIRES_COMPLETE_PROOF");
  }

  const destination = required(destinationRef, "REME_PROMOTION_DESTINATION_REQUIRED");

  return {
    tenantId: plan.tenantId,
    targetId: digest("target", [plan.tenantId, plan.signalId, "reme", destination]),
    type: "reme",
    destinationRef: destination,
    action: "promote_candidate",
    requiredEvidenceType: "connector_receipt",
    idempotencyKey: digest("idem", [plan.tenantId, plan.fingerprint, "reme", destination]),
    executionNonce: digest("nonce", [plan.tenantId, plan.planId, "reme", destination]),
    allowedConnectorIds: ["notion"],
    status: "PLANNED"
  };
}
