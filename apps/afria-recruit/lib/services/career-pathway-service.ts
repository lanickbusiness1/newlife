import type { CareerOpportunity, CandidateEligibilityProfile } from '../domain/career-opportunity.js';
import { rankCareerNextActions, type CareerGoal, type CareerNextAction } from '../domain/career-progression.js';
import type { CandidateContext, CandidateRepository } from '../repositories/candidate-context.js';

export interface CareerPathwayServiceDependencies {
  candidateRepository: CandidateRepository;
  opportunities: CareerOpportunity[];
}

export interface CareerPathwayResult {
  goal: CareerGoal;
  actions: CareerNextAction[];
}

export function buildCandidateEligibilityProfile(context: CandidateContext): CandidateEligibilityProfile {
  return {
    candidateId: context.candidate.id,
    age: null,
    nationalities: [],
    residenceCountryCode: context.candidate.currentCountry?.trim() || null,
    highestEducationLevel: null,
    yearsExperience: context.candidate.yearsExperience,
    languageCodes: context.languages.map((language) => language.code).filter(Boolean),
  };
}

function goalId(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `career-goal:${slug || 'target'}`;
}

export class CareerPathwayService {
  constructor(private readonly dependencies: CareerPathwayServiceDependencies) {}

  async rankForCandidate(candidateId: string, goalTitle: string, now: Date = new Date()): Promise<CareerPathwayResult> {
    const trimmedGoal = goalTitle.trim();
    if (!trimmedGoal) throw new Error('Career goal title is required');

    const context = await this.dependencies.candidateRepository.loadContext(candidateId);
    const profile = buildCandidateEligibilityProfile(context);
    const goal: CareerGoal = { id: goalId(trimmedGoal), title: trimmedGoal };
    const actions = rankCareerNextActions(goal, this.dependencies.opportunities, profile, now);
    return { goal, actions };
  }
}