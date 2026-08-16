import type { CandidateContext } from '../repositories/candidate-context.js';
import type { TruthConflict } from './types.js';

function dateAfter(left: string, right: string): boolean {
  return new Date(left).getTime() > new Date(right).getTime();
}

export function findTruthConflicts(context: CandidateContext): TruthConflict[] {
  const conflicts: TruthConflict[] = [];

  for (const experience of context.experiences) {
    if (experience.startDate && experience.endDate && dateAfter(experience.startDate, experience.endDate)) {
      conflicts.push({
        code: 'EXPERIENCE_DATE_ORDER',
        message: `La date de début de « ${experience.title} » est postérieure à sa date de fin.`,
        blocking: true,
        evidenceRefs: [`experience:${experience.id}`],
      });
    }
    if (experience.isCurrent && experience.endDate) {
      conflicts.push({
        code: 'CURRENT_EXPERIENCE_HAS_END_DATE',
        message: `L’expérience « ${experience.title} » est marquée en cours mais possède une date de fin.`,
        blocking: true,
        evidenceRefs: [`experience:${experience.id}`],
      });
    }
  }

  if (context.candidate.yearsExperience !== null && context.candidate.yearsExperience < 0) {
    conflicts.push({
      code: 'NEGATIVE_YEARS_EXPERIENCE',
      message: 'Le nombre d’années d’expérience ne peut pas être négatif.',
      blocking: true,
      evidenceRefs: ['candidate:years-experience'],
    });
  }

  return conflicts;
}
