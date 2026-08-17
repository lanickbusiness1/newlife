import type {
  JobRequirement,
  JobSpec,
  RequirementCoverage,
  RequirementPriority,
} from './types.js';

export type ProofChallengeType =
  | 'WORK_SAMPLE'
  | 'STRUCTURED_QUESTION'
  | 'PORTFOLIO_EVIDENCE'
  | 'CERTIFICATE_EVIDENCE'
  | 'REFERENCE_EVIDENCE';

export interface ProofChallengeRecommendation {
  type: ProofChallengeType;
  requirementId: string;
  reason: string;
  promotesEvidence: false;
}

export interface RecruiterLensItem {
  requirementId: string;
  requirement: string;
  priority: RequirementPriority;
  coverage: RequirementCoverage['coverage'];
  evidenceRefs: string[];
  riskFlags: string[];
  likelyQuestions: string[];
  doNotClaim: string[];
  proofChallenge: ProofChallengeRecommendation | null;
}

function resolvePriority(requirement: JobRequirement): RequirementPriority {
  if (requirement.calibration?.blocking) return 'BLOCKING';
  if (requirement.calibration?.priority) return requirement.calibration.priority;
  return requirement.required ? 'HIGH' : 'MEDIUM';
}

function challengeType(requirement: JobRequirement): ProofChallengeType {
  if (requirement.kind === 'skill') return 'WORK_SAMPLE';
  if (requirement.kind === 'language' || requirement.kind === 'experience') return 'STRUCTURED_QUESTION';
  if (requirement.kind === 'education') return 'CERTIFICATE_EVIDENCE';
  return 'REFERENCE_EVIDENCE';
}

function proofChallenge(requirement: JobRequirement, row: RequirementCoverage): ProofChallengeRecommendation | null {
  if (row.coverage !== 'GAP' && row.coverage !== 'PARTIAL') return null;
  return {
    type: challengeType(requirement),
    requirementId: requirement.id,
    reason: row.coverage === 'GAP'
      ? 'Une preuve supplémentaire est nécessaire avant de soutenir cette exigence.'
      : 'La couverture existe mais la preuve ou le niveau reste insuffisant.',
    promotesEvidence: false,
  };
}

export function buildRecruiterLens(jobSpec: JobSpec, coverage: RequirementCoverage[]): RecruiterLensItem[] {
  const byRequirement = new Map(coverage.map((row) => [row.requirementId, row]));

  return jobSpec.requirements.map((requirement) => {
    const row = byRequirement.get(requirement.id) ?? {
      requirementId: requirement.id,
      requirement: requirement.label,
      coverage: 'NOT_APPLICABLE' as const,
      evidenceRefs: [],
      explanation: 'Aucune analyse de couverture disponible.',
    };
    const priority = resolvePriority(requirement);
    const riskFlags: string[] = [];
    if (priority === 'BLOCKING' && row.coverage !== 'COVERED') riskFlags.push('BLOCKING_REQUIREMENT_UNPROVEN');
    if (row.coverage === 'GAP') riskFlags.push('NO_SUPPORTING_EVIDENCE');
    if (row.coverage === 'PARTIAL') riskFlags.push('PARTIAL_EVIDENCE');

    return {
      requirementId: requirement.id,
      requirement: requirement.label,
      priority,
      coverage: row.coverage,
      evidenceRefs: [...row.evidenceRefs],
      riskFlags,
      likelyQuestions: row.coverage === 'GAP' || row.coverage === 'PARTIAL'
        ? [`Quelle preuve concrète pouvez-vous fournir pour « ${requirement.label} » ?`]
        : [],
      doNotClaim: row.coverage === 'GAP' ? [requirement.label] : [],
      proofChallenge: proofChallenge(requirement, row),
    };
  });
}
