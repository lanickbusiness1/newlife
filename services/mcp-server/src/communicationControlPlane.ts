export const GENESIS_V4_SOVEREIGN_COMMS_ANCHOR = {
  genome: "GENESIS_V4",
  parentAssetId: "PRD-SAW-001",
  capabilityId: "CAP-SAW-COMMS-001",
  doctrine: "Sovereign communications are provider-substitutable; routing is evidence-gated and fail-closed.",
  invariant: "A communication provider is never treated as sovereign on vendor claims alone when higher-assurance evidence is required."
} as const;

export type CommunicationProviderType =
  | "mirrorfly"
  | "matrix"
  | "rocketchat"
  | "whatsapp"
  | "custom";

export type CommunicationCapability =
  | "selfHosted"
  | "sourceCodeAccess"
  | "whiteLabel"
  | "e2ee"
  | "webSdk"
  | "mobileSdk"
  | "webhooks"
  | "dataResidencyControl"
  | "keyControl"
  | "exportability"
  | "auditLogs"
  | "backupRestore"
  | "noRemoteKillSwitch";

export type EvidenceLevel =
  | "vendor_claim"
  | "independent"
  | "contractual"
  | "tested";

export type RiskClass = "low" | "moderate" | "high" | "regulated";

export interface CapabilityEvidence {
  value: boolean;
  level: EvidenceLevel;
  sourceRef?: string;
}

export interface CommunicationProviderProfile {
  providerId: string;
  providerType: CommunicationProviderType;
  capabilities: Partial<Record<CommunicationCapability, CapabilityEvidence>>;
  sourceRefs?: string[];
}

export interface SovereignCommsRequirements {
  riskClass: RiskClass;
  sovereigntyMode: boolean;
  mandatory?: CommunicationCapability[];
  minimumEvidenceLevel?: EvidenceLevel;
}

export type ProviderDecisionStatus =
  | "ELIGIBLE"
  | "DUE_DILIGENCE_REQUIRED"
  | "REJECTED";

export interface ProviderEvaluation {
  providerId: string;
  providerType: CommunicationProviderType;
  status: ProviderDecisionStatus;
  score: number;
  missingCapabilities: CommunicationCapability[];
  insufficientEvidence: CommunicationCapability[];
  failedCapabilities: CommunicationCapability[];
  evidenceRefs: string[];
}

export interface CommunicationRouteInput {
  intentId: string;
  requirements: SovereignCommsRequirements;
  providers: CommunicationProviderProfile[];
}

export interface CommunicationRouteDecision {
  anchor: typeof GENESIS_V4_SOVEREIGN_COMMS_ANCHOR;
  intentId: string;
  state: "ROUTE_SELECTED" | "ALTERNATE_ROUTE_ACTIVE";
  selectedProviderId?: string;
  evaluations: ProviderEvaluation[];
  continueAutomatically: true;
  nextAction: string;
}

const EVIDENCE_RANK: Record<EvidenceLevel, number> = {
  vendor_claim: 1,
  independent: 2,
  contractual: 3,
  tested: 4
};

const SOVEREIGN_BASELINE: CommunicationCapability[] = [
  "selfHosted",
  "dataResidencyControl",
  "keyControl",
  "exportability",
  "auditLogs",
  "backupRestore"
];

const GENERAL_BASELINE: CommunicationCapability[] = [
  "webhooks",
  "exportability",
  "auditLogs"
];

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function requiredEvidenceLevel(requirements: SovereignCommsRequirements): EvidenceLevel {
  if (requirements.minimumEvidenceLevel) return requirements.minimumEvidenceLevel;
  if (requirements.riskClass === "regulated" || requirements.riskClass === "high") return "contractual";
  if (requirements.riskClass === "moderate") return "independent";
  return "vendor_claim";
}

function requiredCapabilities(requirements: SovereignCommsRequirements): CommunicationCapability[] {
  const set = new Set<CommunicationCapability>(
    requirements.sovereigntyMode ? SOVEREIGN_BASELINE : GENERAL_BASELINE
  );
  for (const capability of requirements.mandatory ?? []) set.add(capability);
  return [...set].sort();
}

function capabilityScore(evidence: CapabilityEvidence | undefined): number {
  if (!evidence?.value) return 0;
  return 10 + EVIDENCE_RANK[evidence.level];
}

export function evaluateCommunicationProvider(
  provider: CommunicationProviderProfile,
  requirements: SovereignCommsRequirements
): ProviderEvaluation {
  if (!nonEmpty(provider.providerId)) {
    throw new Error("SOVEREIGN_COMMS_INVALID_PROVIDER: providerId is required");
  }

  const minimumRank = EVIDENCE_RANK[requiredEvidenceLevel(requirements)];
  const mandatory = requiredCapabilities(requirements);
  const missingCapabilities: CommunicationCapability[] = [];
  const insufficientEvidence: CommunicationCapability[] = [];
  const failedCapabilities: CommunicationCapability[] = [];
  const evidenceRefs = new Set<string>(provider.sourceRefs ?? []);

  for (const capability of mandatory) {
    const evidence = provider.capabilities[capability];
    if (!evidence) {
      missingCapabilities.push(capability);
      continue;
    }
    if (evidence.sourceRef) evidenceRefs.add(evidence.sourceRef);
    if (evidence.value !== true) {
      failedCapabilities.push(capability);
      continue;
    }
    if (EVIDENCE_RANK[evidence.level] < minimumRank) {
      insufficientEvidence.push(capability);
    }
  }

  const score = Object.values(provider.capabilities)
    .reduce((sum, evidence) => sum + capabilityScore(evidence), 0);

  let status: ProviderDecisionStatus = "ELIGIBLE";
  if (failedCapabilities.length > 0) {
    status = "REJECTED";
  } else if (missingCapabilities.length > 0 || insufficientEvidence.length > 0) {
    status = "DUE_DILIGENCE_REQUIRED";
  }

  return {
    providerId: provider.providerId,
    providerType: provider.providerType,
    status,
    score,
    missingCapabilities,
    insufficientEvidence,
    failedCapabilities,
    evidenceRefs: [...evidenceRefs].sort()
  };
}

export function compileCommunicationRoute(input: CommunicationRouteInput): CommunicationRouteDecision {
  if (!nonEmpty(input.intentId)) {
    throw new Error("SOVEREIGN_COMMS_INVALID_INTENT: intentId is required");
  }
  if (!Array.isArray(input.providers) || input.providers.length === 0) {
    throw new Error("SOVEREIGN_COMMS_NO_PROVIDERS: at least one provider candidate is required");
  }

  const evaluations = input.providers
    .map(provider => evaluateCommunicationProvider(provider, input.requirements))
    .sort((a, b) => {
      if (a.status !== b.status) {
        const statusRank: Record<ProviderDecisionStatus, number> = {
          ELIGIBLE: 3,
          DUE_DILIGENCE_REQUIRED: 2,
          REJECTED: 1
        };
        return statusRank[b.status] - statusRank[a.status];
      }
      if (a.score !== b.score) return b.score - a.score;
      return a.providerId.localeCompare(b.providerId);
    });

  const selected = evaluations.find(item => item.status === "ELIGIBLE");
  if (selected) {
    return {
      anchor: GENESIS_V4_SOVEREIGN_COMMS_ANCHOR,
      intentId: input.intentId,
      state: "ROUTE_SELECTED",
      selectedProviderId: selected.providerId,
      evaluations,
      continueAutomatically: true,
      nextAction: "Instantiate the selected provider adapter under the existing Sovereign Agentic Workspace and capture execution evidence."
    };
  }

  const hasDueDiligenceCandidate = evaluations.some(item => item.status === "DUE_DILIGENCE_REQUIRED");
  return {
    anchor: GENESIS_V4_SOVEREIGN_COMMS_ANCHOR,
    intentId: input.intentId,
    state: "ALTERNATE_ROUTE_ACTIVE",
    evaluations,
    continueAutomatically: true,
    nextAction: hasDueDiligenceCandidate
      ? "Run contractual/technical due diligence in parallel while evaluating substitute providers; do not stop the product execution chain."
      : "Substitute the provider or activate a self-hosted fallback route; do not return a global BLOCKED state."
  };
}
