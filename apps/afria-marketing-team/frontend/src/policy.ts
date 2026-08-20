import type { Capability, PolicyDecision } from "./domain";

const SENSITIVE = new Set<Capability>(["SEND", "PAY", "DELETE", "EXPORT"]);

export interface PolicyContext {
  humanApproved: boolean;
  tenantReady?: boolean;
  killSwitchActive?: boolean;
}

export function simulatePolicy(capability: Capability, context: PolicyContext): PolicyDecision {
  if (context.killSwitchActive) {
    return {
      capability,
      state: "blocked",
      reason: "kill switch active",
      humanApprovalRequired: false,
      auditRef: `S7-AUDIT-${capability}-BLOCKED`
    };
  }

  if (SENSITIVE.has(capability) && !context.humanApproved) {
    return {
      capability,
      state: "needs_human",
      reason: `${capability}: human approval required before execution`,
      humanApprovalRequired: true,
      auditRef: `S7-AUDIT-${capability}-HUMAN-GATE`
    };
  }

  return {
    capability,
    state: "allowed",
    reason: `${capability}: policy simulation allowed`,
    humanApprovalRequired: false,
    auditRef: `S7-AUDIT-${capability}-ALLOWED`
  };
}
