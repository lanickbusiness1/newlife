export const GENESIS_V4_VALIDATION_RELAY_ANCHOR = {
  genome: "GENESIS_V4",
  assetId: "INF-DEPLOYBOT-001",
  policyId: "REME-VAL-001",
  doctrine: "CEO Validation → DeployBot Execution Relay",
  invariant:
    "After CEO validation of a sufficiently complete roadmap, A0-A3 execution continues without micro-approval until a verified terminal deliverable or an explicit A4 veto."
} as const;

export type TargetDeliverable = "url" | "apk" | "aab" | "service" | "infrastructure";
export type RiskClass = "low" | "moderate" | "high" | "regulated";
export type GateStatus = "pass" | "conditional" | "fail" | "pending";
export type AutonomyLevel = "A1" | "A2" | "A3" | "A4";

export type RelayState =
  | "HANDOFF_ACCEPTED"
  | "SOURCE_PROVEN"
  | "BUILDING"
  | "CORRECTING"
  | "GATES_PENDING"
  | "READY_TO_DEPLOY"
  | "DEPLOYED_UNVERIFIED"
  | "BLOCKED_A4"
  | "DELIVERED_URL"
  | "DELIVERED_APK"
  | "DELIVERED_AAB"
  | "DELIVERED_SERVICE"
  | "DELIVERED_INFRASTRUCTURE";

export interface ValidationRelayEvidence {
  commitSha?: string;
  ciRun?: string;
  testsPassed?: boolean;
  m6?: GateStatus;
  s7plus?: GateStatus;
  m8?: GateStatus;
  big4?: GateStatus;
  finalUrlOrArtifact?: string;
  healthcheckPassed?: boolean;
  rollbackRef?: string;
  remeRef?: string;
}

export interface ValidationRelayInput {
  validationRef: string;
  assetId: string;
  baselineVersion: string;
  targetDeliverable: TargetDeliverable;
  riskClass: RiskClass;
  sourceRef?: string;
  budgetEnvelope?: {
    authorized: boolean;
    maxSpend?: number;
    currency?: string;
  };
  deploymentPolicy?: {
    stagingAllowed: boolean;
    productionDelegated: boolean;
  };
  a4Vetoes?: string[];
  evidence?: ValidationRelayEvidence;
}

export interface ValidationRelayOutput {
  anchor: typeof GENESIS_V4_VALIDATION_RELAY_ANCHOR;
  validationRef: string;
  assetId: string;
  state: RelayState;
  autonomyLevel: AutonomyLevel;
  continueAutomatically: boolean;
  humanApprovalRequired: boolean;
  nextAction: string;
  blockers: string[];
  finalDeliverable?: string;
  evidenceContract: string[];
}

const EVIDENCE_CONTRACT = [
  "validation_ref",
  "asset_id",
  "baseline_version",
  "source_ref",
  "commit_sha",
  "CI_run",
  "test_summary",
  "M6",
  "S7+",
  "M8",
  "Big4_if_required",
  "final_url_or_artifact",
  "healthcheck",
  "rollback_ref",
  "R.E.M.E_ref"
];

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function terminalState(target: TargetDeliverable): RelayState {
  switch (target) {
    case "url": return "DELIVERED_URL";
    case "apk": return "DELIVERED_APK";
    case "aab": return "DELIVERED_AAB";
    case "service": return "DELIVERED_SERVICE";
    case "infrastructure": return "DELIVERED_INFRASTRUCTURE";
  }
}

function autonomyFor(input: ValidationRelayInput): AutonomyLevel {
  if (input.a4Vetoes?.length) return "A4";
  if (input.deploymentPolicy?.productionDelegated && input.budgetEnvelope?.authorized) return "A3";
  if (input.deploymentPolicy?.stagingAllowed) return "A2";
  return "A1";
}

function output(
  input: ValidationRelayInput,
  state: RelayState,
  nextAction: string,
  blockers: string[] = [],
  finalDeliverable?: string
): ValidationRelayOutput {
  const terminal = state.startsWith("DELIVERED_");
  const blockedA4 = state === "BLOCKED_A4";
  return {
    anchor: GENESIS_V4_VALIDATION_RELAY_ANCHOR,
    validationRef: input.validationRef,
    assetId: input.assetId,
    state,
    autonomyLevel: autonomyFor(input),
    continueAutomatically: !terminal && !blockedA4,
    humanApprovalRequired: blockedA4,
    nextAction,
    blockers,
    finalDeliverable,
    evidenceContract: [...EVIDENCE_CONTRACT]
  };
}

export function compileValidationRelay(input: ValidationRelayInput): ValidationRelayOutput {
  if (!text(input.validationRef) || !text(input.assetId) || !text(input.baselineVersion)) {
    throw new Error("GENESIS_V4_VALIDATION_RELAY_INVALID: validationRef, assetId and baselineVersion are required");
  }

  if (input.a4Vetoes?.length) {
    return output(
      input,
      "BLOCKED_A4",
      "Escalate only the explicit A4 veto to the CEO/human authority, preserving all prior evidence.",
      input.a4Vetoes.map(veto => `A4:${veto}`)
    );
  }

  if (!text(input.sourceRef)) {
    return output(
      input,
      "HANDOFF_ACCEPTED",
      "Prove the canonical source from Genome/Notion/GitHub/Drive before build."
    );
  }

  const evidence = input.evidence ?? {};

  if (!text(evidence.commitSha)) {
    return output(
      input,
      "SOURCE_PROVEN",
      "Build the validated baseline in an isolated workspace and record the commit SHA."
    );
  }

  if (!text(evidence.ciRun) || evidence.testsPassed !== true) {
    const blockers = evidence.testsPassed === false ? ["Tests are failing"] : [];
    return output(
      input,
      evidence.testsPassed === false ? "CORRECTING" : "BUILDING",
      evidence.testsPassed === false
        ? "Diagnose, patch, rerun tests and CI automatically; do not return the task to the CEO."
        : "Run the full CI contract and persist the test evidence.",
      blockers
    );
  }

  const gateBlockers: string[] = [];
  const requiredGates: Array<[string, GateStatus | undefined]> = [
    ["M6", evidence.m6],
    ["S7+", evidence.s7plus],
    ["M8", evidence.m8]
  ];

  for (const [name, status] of requiredGates) {
    if (status !== "pass") gateBlockers.push(`${name} gate is ${status ?? "missing"}`);
  }

  if ((input.riskClass === "high" || input.riskClass === "regulated") && evidence.big4 !== "pass") {
    gateBlockers.push(`Big4 gate is ${evidence.big4 ?? "missing"}`);
  }

  if (gateBlockers.length) {
    return output(
      input,
      gateBlockers.some(item => /fail|conditional/.test(item)) ? "CORRECTING" : "GATES_PENDING",
      "Run corrective actions and re-evaluate the required gates automatically within the delegated scope.",
      gateBlockers
    );
  }

  if (!text(evidence.finalUrlOrArtifact)) {
    return output(
      input,
      "READY_TO_DEPLOY",
      "Deploy or package the validated release using the authorized staging/production policy, then record the real URL or artifact."
    );
  }

  const deliveryBlockers: string[] = [];
  if (evidence.healthcheckPassed !== true) deliveryBlockers.push("Healthcheck proof missing");
  if (!text(evidence.rollbackRef)) deliveryBlockers.push("Rollback proof missing");

  if (deliveryBlockers.length) {
    return output(
      input,
      "DEPLOYED_UNVERIFIED",
      "Verify the deployed artifact in a fresh environment, prove healthcheck and rollback/reversibility, then re-evaluate.",
      deliveryBlockers
    );
  }

  return output(
    input,
    terminalState(input.targetDeliverable),
    "Archive release evidence in R.E.M.E/Genome and hand off to Revenue & Growth Engine when applicable.",
    [],
    evidence.finalUrlOrArtifact
  );
}
