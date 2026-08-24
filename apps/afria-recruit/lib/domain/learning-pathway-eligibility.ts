import {
  evaluateLearningOpportunity,
  normalizeSkillToken,
  type CandidateLearningContext,
  type LearningEvaluation,
  type LearningOpportunity,
} from './learning-credential-intelligence.js';

export type LearningGapKind =
  | 'skill'
  | 'language'
  | 'education'
  | 'experience'
  | 'procedure'
  | 'software'
  | 'credential'
  | 'license'
  | 'other';

export interface CandidateLearningGap {
  id: string;
  kind: LearningGapKind;
  label: string;
  required: boolean;
  skill?: string;
  evidenceRefs: string[];
}

export interface TypedCandidateLearningContext extends CandidateLearningContext {
  gaps: CandidateLearningGap[];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function collectSkillGaps(context: TypedCandidateLearningContext): string[] {
  const candidates = [
    ...context.skillGaps,
    ...context.gaps
      .filter((gap) => gap.kind === 'skill')
      .map((gap) => gap.skill ?? gap.label),
  ];

  return unique(
    candidates
      .map(normalizeSkillToken)
      .filter((skill) => skill.length > 0),
  );
}

function outstandingRequiredNonSkillGaps(context: TypedCandidateLearningContext): CandidateLearningGap[] {
  return context.gaps.filter((gap) => gap.required && gap.kind !== 'skill');
}

function outstandingReason(gap: CandidateLearningGap): string {
  return `OUTSTANDING_REQUIRED_GAP:${gap.kind}:${gap.id}`;
}

function explainOutstandingGaps(gaps: CandidateLearningGap[]): string {
  if (gaps.length === 0) return '';
  const labels = gaps.map((gap) => gap.label).join(' ; ');
  return ` Des exigences obligatoires non fermées par cette formation restent à vérifier : ${labels}.`;
}

/**
 * Adds eligibility semantics above the stable learning-course evaluator.
 *
 * A learning opportunity may close a verified skill gap while leaving other
 * mandatory eligibility requirements unresolved (education equivalence,
 * organisation-specific procedures, software, licence, language, etc.). In
 * that case the course remains useful, but the pathway cannot be promoted to
 * PASS: it is held at REVIEW for human or source-backed resolution.
 */
export function evaluateLearningPathway(
  opportunity: LearningOpportunity,
  context: TypedCandidateLearningContext,
): LearningEvaluation {
  const skillGaps = collectSkillGaps(context);
  const coreResult = evaluateLearningOpportunity(opportunity, {
    ...context,
    skillGaps,
  });
  const outstanding = outstandingRequiredNonSkillGaps(context);
  const reasons = unique([
    ...coreResult.blockingReasons,
    ...outstanding.map(outstandingReason),
  ]);

  if (coreResult.eligibilityGate === 'FAIL') {
    return {
      ...coreResult,
      blockingReasons: reasons,
      explanation: `${coreResult.explanation}${explainOutstandingGaps(outstanding)}`,
    };
  }

  if (outstanding.length > 0) {
    return {
      ...coreResult,
      eligibilityGate: 'REVIEW',
      decision: 'REVIEW',
      blockingReasons: reasons,
      explanation: `${coreResult.explanation}${explainOutstandingGaps(outstanding)} Le parcours reste en revue et ne constitue pas une preuve d’éligibilité complète.`,
    };
  }

  return coreResult;
}
