import { z } from "zod";
import {
  evaluateDeliveryToBankability,
  type DeliveryToBankabilityInput,
  type DeliveryToBankabilityDecision
} from "./deliveryToBankabilityGate.js";

export const GENESIS_V4_DFRE_EXECUTION_ADAPTER_ANCHOR = {
  assetId: "GEN-V4-DFRE-EXECUTION-ADAPTER-001",
  decisionId: "V4-DEC-036",
  version: "0.1.0",
  parent: "DFRE / Bankability Engine Africa",
  proofMode: "deterministic-fail-closed"
} as const;

const DfreExecutionInputSchema = z.object({
  projectBankabilityScore: z.number().min(0).max(100),
  sponsorExecutionInput: z.unknown(),
  criticalDependencyReadiness: z.enum(["VERIFIED", "PARTIAL", "BLOCKED", "UNKNOWN"])
});

export type CriticalDependencyReadiness = "VERIFIED" | "PARTIAL" | "BLOCKED" | "UNKNOWN";
export type DfreExecutionDecision = "READY_FOR_DUE_DILIGENCE" | "CONDITIONAL_REVIEW" | "HOLD" | "INVALID_INPUT";

export type DfreExecutionReadinessInput = {
  projectBankabilityScore: number;
  sponsorExecutionInput: DeliveryToBankabilityInput;
  criticalDependencyReadiness: CriticalDependencyReadiness;
};

export type DfreExecutionReadinessResult = {
  assetId: typeof GENESIS_V4_DFRE_EXECUTION_ADAPTER_ANCHOR.assetId;
  decisionId: typeof GENESIS_V4_DFRE_EXECUTION_ADAPTER_ANCHOR.decisionId;
  version: typeof GENESIS_V4_DFRE_EXECUTION_ADAPTER_ANCHOR.version;
  projectBankabilityScore: number;
  sponsorExecutionCredibilityScore: number;
  sponsorExecutionDecision: DeliveryToBankabilityDecision;
  criticalDependencyReadiness: CriticalDependencyReadiness;
  decision: DfreExecutionDecision;
  canPresentAsExecutionProven: boolean;
  blockers: string[];
};

function invalidResult(): DfreExecutionReadinessResult {
  return {
    assetId: GENESIS_V4_DFRE_EXECUTION_ADAPTER_ANCHOR.assetId,
    decisionId: GENESIS_V4_DFRE_EXECUTION_ADAPTER_ANCHOR.decisionId,
    version: GENESIS_V4_DFRE_EXECUTION_ADAPTER_ANCHOR.version,
    projectBankabilityScore: 0,
    sponsorExecutionCredibilityScore: 0,
    sponsorExecutionDecision: "INVALID_INPUT",
    criticalDependencyReadiness: "UNKNOWN",
    decision: "INVALID_INPUT",
    canPresentAsExecutionProven: false,
    blockers: ["INVALID_INPUT"]
  };
}

export function compileDfreExecutionReadiness(input: unknown): DfreExecutionReadinessResult {
  const parsed = DfreExecutionInputSchema.safeParse(input);
  if (!parsed.success) return invalidResult();

  const data = parsed.data;
  const execution = evaluateDeliveryToBankability(data.sponsorExecutionInput);
  if (execution.decision === "INVALID_INPUT") {
    return {
      ...invalidResult(),
      projectBankabilityScore: data.projectBankabilityScore,
      criticalDependencyReadiness: data.criticalDependencyReadiness,
      blockers: ["SPONSOR_EXECUTION_INPUT_INVALID"]
    };
  }

  const blockers: string[] = [];
  const executionProven = execution.decision === "PROVEN_OPERATOR" && execution.canClaimDelivered === true;

  if (data.projectBankabilityScore < 65) {
    blockers.push("PROJECT_BANKABILITY_BELOW_PREBANKABLE_THRESHOLD");
  }

  if (!executionProven) {
    blockers.push("SPONSOR_EXECUTION_NOT_PROVEN");
  }

  if (data.criticalDependencyReadiness === "PARTIAL") {
    blockers.push("CRITICAL_DEPENDENCIES_NOT_FULLY_VERIFIED");
  } else if (data.criticalDependencyReadiness === "BLOCKED") {
    blockers.push("CRITICAL_DEPENDENCY_BLOCKED");
  } else if (data.criticalDependencyReadiness === "UNKNOWN") {
    blockers.push("CRITICAL_DEPENDENCY_READINESS_UNKNOWN");
  }

  let decision: DfreExecutionDecision = "HOLD";
  if (
    executionProven
    && data.projectBankabilityScore >= 80
    && data.criticalDependencyReadiness === "VERIFIED"
  ) {
    decision = "READY_FOR_DUE_DILIGENCE";
  } else if (
    executionProven
    && data.projectBankabilityScore >= 65
    && (data.criticalDependencyReadiness === "VERIFIED" || data.criticalDependencyReadiness === "PARTIAL")
  ) {
    decision = "CONDITIONAL_REVIEW";
  }

  return {
    assetId: GENESIS_V4_DFRE_EXECUTION_ADAPTER_ANCHOR.assetId,
    decisionId: GENESIS_V4_DFRE_EXECUTION_ADAPTER_ANCHOR.decisionId,
    version: GENESIS_V4_DFRE_EXECUTION_ADAPTER_ANCHOR.version,
    projectBankabilityScore: data.projectBankabilityScore,
    sponsorExecutionCredibilityScore: execution.score,
    sponsorExecutionDecision: execution.decision,
    criticalDependencyReadiness: data.criticalDependencyReadiness,
    decision,
    canPresentAsExecutionProven: executionProven,
    blockers
  };
}
