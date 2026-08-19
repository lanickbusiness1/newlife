import type {
  CandidateEligibilityProfile,
  CareerOpportunity,
  EligibilityResult,
  OpportunityKind,
  OpportunityProgressionSignals,
} from './career-opportunity.js';
import { evaluateEligibility } from './eligibility.js';

export const SCORE_WEIGHTS = {
  goalAlignment: 30,
  evidenceGain: 20,
  skillGain: 15,
  futureEligibilityUnlock: 15,
  networkExposure: 10,
  immediateFit: 10,
} as const;

type ScoreKey = keyof typeof SCORE_WEIGHTS;

export interface CareerGoal {
  id: string;
  title: string;
  targetOrganization?: string;
  targetKind?: OpportunityKind;
}

export interface ScoreComponent {
  raw: number;
  weight: number;
  weighted: number;
}

export interface CareerProgressionScore {
  total: number;
  components: Record<ScoreKey, ScoreComponent>;
}

export interface CareerNextAction {
  rank: number;
  opportunity: CareerOpportunity;
  eligibility: EligibilityResult;
  progressionScore: CareerProgressionScore;
  whyThisNext: string[];
  missingData: string[];
}

const STATUS_ORDER: Record<EligibilityResult['status'], number> = {
  ELIGIBLE: 0,
  REVIEW_REQUIRED: 1,
  INELIGIBLE: 2,
};

const COMPONENT_LABELS: Record<ScoreKey, string> = {
  goalAlignment: 'Alignement avec l’objectif de carrière',
  evidenceGain: 'Gain de preuves professionnelles',
  skillGain: 'Développement de compétences',
  futureEligibilityUnlock: 'Éligibilités futures débloquées',
  networkExposure: 'Exposition réseau et institutionnelle',
  immediateFit: 'Adéquation immédiate',
};

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function sameText(left: string | undefined, right: string): boolean {
  if (!left) return false;
  return left.trim().localeCompare(right.trim(), undefined, { sensitivity: 'accent' }) === 0;
}

function effectiveSignals(opportunity: CareerOpportunity, goal: CareerGoal): OpportunityProgressionSignals {
  const organizationMatch = sameText(goal.targetOrganization, opportunity.organization);
  const kindMatch = Boolean(goal.targetKind && goal.targetKind === opportunity.kind);
  const hasStructuredTarget = Boolean(goal.targetOrganization || goal.targetKind);

  let goalAlignment = 0;
  if (hasStructuredTarget && (organizationMatch || kindMatch)) {
    goalAlignment = opportunity.progression.goalAlignment;
    if (organizationMatch) goalAlignment += 15;
    if (kindMatch) goalAlignment += 10;
  }

  return { ...opportunity.progression, goalAlignment };
}

export function scoreProgression(opportunity: CareerOpportunity, goal: CareerGoal): CareerProgressionScore {
  const signals = effectiveSignals(opportunity, goal);
  const components = {} as Record<ScoreKey, ScoreComponent>;
  let total = 0;

  for (const key of Object.keys(SCORE_WEIGHTS) as ScoreKey[]) {
    const raw = clamp(signals[key]);
    const weight = SCORE_WEIGHTS[key];
    const weighted = (raw * weight) / 100;
    components[key] = { raw, weight, weighted };
    total += weighted;
  }

  return { total: Math.round(total * 100) / 100, components };
}

function reasons(score: CareerProgressionScore): string[] {
  return (Object.entries(score.components) as Array<[ScoreKey, ScoreComponent]>)
    .filter(([, component]) => component.raw > 0)
    .sort((a, b) => b[1].weighted - a[1].weighted || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([key]) => COMPONENT_LABELS[key]);
}

export function rankCareerNextActions(
  goal: CareerGoal,
  opportunities: CareerOpportunity[],
  profile: CandidateEligibilityProfile,
  now: Date = new Date(),
): CareerNextAction[] {
  const ranked = opportunities.map((opportunity) => {
    const eligibility = evaluateEligibility(profile, opportunity, now);
    const progressionScore = scoreProgression(opportunity, goal);
    return {
      rank: 0,
      opportunity,
      eligibility,
      progressionScore,
      whyThisNext: reasons(progressionScore),
      missingData: [...eligibility.missingData],
    } satisfies CareerNextAction;
  });

  ranked.sort((left, right) => {
    const statusDelta = STATUS_ORDER[left.eligibility.status] - STATUS_ORDER[right.eligibility.status];
    if (statusDelta !== 0) return statusDelta;
    const scoreDelta = right.progressionScore.total - left.progressionScore.total;
    if (scoreDelta !== 0) return scoreDelta;
    return left.opportunity.id.localeCompare(right.opportunity.id);
  });

  return ranked.map((action, index) => ({ ...action, rank: index + 1 }));
}