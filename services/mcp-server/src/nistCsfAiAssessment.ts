export const NIST_CSF_AI_ASSESSMENT_ANCHOR = {
  publication: "NIST SP 1353 ipd",
  publicationDate: "2026-08-19",
  commentsDue: "2026-10-15T23:59:00-04:00",
  policyVersion: "2026-09-23.1",
  truthState: "CODED_CONTROL_NOT_CYBERSECURITY_ASSURANCE",
  source: "https://csrc.nist.gov/pubs/sp/1353/ipd"
} as const;

export type CsfAiUseCase = "governance_review" | "current_state_profile" | "target_state_profile";
export type CsfDataClassification = "public" | "internal" | "confidential" | "restricted";

export interface CsfEvidenceItem {
  evidenceRef: string;
  kind: "policy" | "strategy" | "risk_governance" | "artifact" | "interview" | "current_profile" | "industry_reference" | "requirement";
  summary: string;
  sourceUrl?: string;
  observedAt?: string;
}

export interface CsfAiAssessmentRequest {
  organizationId: string;
  useCase: CsfAiUseCase;
  dataClassification: CsfDataClassification;
  providerApprovedForClassification?: boolean;
  evidence: CsfEvidenceItem[];
  missionObjectives?: string[];
  stakeholderExpectations?: string[];
  riskLandscape?: string[];
  requirements?: string[];
}

export interface CsfAiAssessmentPlan {
  policyVersion: string;
  publication: string;
  useCase: CsfAiUseCase;
  artifactType: "GOVERNANCE_REVIEW" | "CURRENT_STATE_PROFILE" | "TARGET_STATE_PROFILE";
  evidenceRefs: string[];
  evidenceCoverage: { requiredKinds: string[]; presentKinds: string[]; missingKinds: string[] };
  explicitAssumptions: string[];
  observedGaps: string[];
  executionPolicy: "DRAFT_REQUIRES_HUMAN_VALIDATION";
  assuranceClaimAllowed: false;
  truthState: "DRAFT_PLAN_ONLY";
  commentWindow: { dueAt: string; status: "OPEN" };
}

const REQUIRED_EVIDENCE: Record<CsfAiUseCase, CsfEvidenceItem["kind"][]> = {
  governance_review: ["policy", "strategy", "risk_governance"],
  current_state_profile: ["artifact", "interview"],
  target_state_profile: ["current_profile", "industry_reference", "requirement"]
};

const ARTIFACT_TYPES: Record<CsfAiUseCase, CsfAiAssessmentPlan["artifactType"]> = {
  governance_review: "GOVERNANCE_REVIEW",
  current_state_profile: "CURRENT_STATE_PROFILE",
  target_state_profile: "TARGET_STATE_PROFILE"
};

function validateRequest(request: CsfAiAssessmentRequest) {
  if (!request || typeof request !== "object") throw new Error("CSF_AI_INVALID_REQUEST");
  if (!request.organizationId?.trim()) throw new Error("CSF_AI_ORGANIZATION_REQUIRED");
  if (!Array.isArray(request.evidence)) throw new Error("CSF_AI_EVIDENCE_ARRAY_REQUIRED");

  for (const item of request.evidence) {
    if (!item.evidenceRef?.trim()) throw new Error("CSF_AI_EVIDENCE_REF_REQUIRED");
    if (!item.summary?.trim()) throw new Error("CSF_AI_EVIDENCE_SUMMARY_REQUIRED");
  }

  const controlled = request.dataClassification === "confidential"
    || request.dataClassification === "restricted";
  if (controlled && !request.providerApprovedForClassification) {
    throw new Error("CSF_AI_CONTROLLED_PROVIDER_REQUIRED");
  }
}

export function compileNistCsfAiAssessment(request: CsfAiAssessmentRequest): CsfAiAssessmentPlan {
  validateRequest(request);

  const requiredKinds = REQUIRED_EVIDENCE[request.useCase];
  if (!requiredKinds) throw new Error("CSF_AI_UNSUPPORTED_USE_CASE");

  const presentKinds = [...new Set(request.evidence.map(item => item.kind))];
  const missingKinds = requiredKinds.filter(kind => !presentKinds.includes(kind));
  const explicitAssumptions: string[] = [];
  const observedGaps = missingKinds.map(kind => `MISSING_EVIDENCE_KIND:${kind}`);

  if (request.useCase === "target_state_profile") {
    if (!request.missionObjectives?.length) explicitAssumptions.push("MISSION_OBJECTIVES_NOT_PROVIDED");
    if (!request.stakeholderExpectations?.length) explicitAssumptions.push("STAKEHOLDER_EXPECTATIONS_NOT_PROVIDED");
    if (!request.riskLandscape?.length) explicitAssumptions.push("RISK_LANDSCAPE_NOT_PROVIDED");
    if (!request.requirements?.length) explicitAssumptions.push("REQUIREMENTS_NOT_PROVIDED");
  }

  return {
    policyVersion: NIST_CSF_AI_ASSESSMENT_ANCHOR.policyVersion,
    publication: NIST_CSF_AI_ASSESSMENT_ANCHOR.publication,
    useCase: request.useCase,
    artifactType: ARTIFACT_TYPES[request.useCase],
    evidenceRefs: request.evidence.map(item => item.evidenceRef),
    evidenceCoverage: { requiredKinds, presentKinds, missingKinds },
    explicitAssumptions,
    observedGaps,
    executionPolicy: "DRAFT_REQUIRES_HUMAN_VALIDATION",
    assuranceClaimAllowed: false,
    truthState: "DRAFT_PLAN_ONLY",
    commentWindow: { dueAt: NIST_CSF_AI_ASSESSMENT_ANCHOR.commentsDue, status: "OPEN" }
  };
}
