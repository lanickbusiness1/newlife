import type { CandidateContext } from '../repositories/candidate-context.js';
import { normalizeEvidenceLevel } from './evidence.js';
import type { JobSpec, RequirementCoverage } from './types.js';

const languageRank: Record<string, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
  native: 7,
};

function skillCoverage(context: CandidateContext, requirement: JobSpec['requirements'][number]): RequirementCoverage {
  const skill = context.skills.find((candidateSkill) => candidateSkill.skillId === requirement.skillId);
  if (!skill) {
    return {
      requirementId: requirement.id,
      requirement: requirement.label,
      coverage: 'GAP',
      evidenceRefs: [],
      explanation: 'Aucune compétence correspondante n’est présente dans le Talent Passport™.',
    };
  }

  const yearsEnough = requirement.minimumYears === undefined
    || (skill.yearsExperience !== null && skill.yearsExperience >= requirement.minimumYears);
  const evidence = normalizeEvidenceLevel(skill.evidenceStatus);
  const coverage = yearsEnough && evidence !== 'DECLARED' ? 'COVERED' : 'PARTIAL';
  const reasons = [];
  if (!yearsEnough) reasons.push('expérience déclarée inférieure au minimum demandé');
  if (evidence === 'DECLARED') reasons.push('compétence encore déclarative');

  return {
    requirementId: requirement.id,
    requirement: requirement.label,
    coverage,
    evidenceRefs: [`skill:${skill.skillId}`],
    explanation: coverage === 'COVERED'
      ? `Compétence soutenue par une preuve ${evidence.toLowerCase()}.`
      : `Couverture partielle : ${reasons.join(' ; ')}.`,
  };
}

function languageCoverage(context: CandidateContext, requirement: JobSpec['requirements'][number]): RequirementCoverage {
  const language = context.languages.find((candidateLanguage) => candidateLanguage.code.toLowerCase() === requirement.languageCode?.toLowerCase());
  if (!language) {
    return {
      requirementId: requirement.id,
      requirement: requirement.label,
      coverage: 'GAP',
      evidenceRefs: [],
      explanation: 'Aucun niveau linguistique correspondant n’est présent dans le Talent Passport™.',
    };
  }

  const actualRank = languageRank[language.level] ?? 0;
  const requiredRank = requirement.minimumLevel ? (languageRank[requirement.minimumLevel] ?? 0) : 0;
  const levelEnough = actualRank >= requiredRank;
  const evidence = normalizeEvidenceLevel(language.evidenceStatus);
  const coverage = levelEnough && evidence !== 'DECLARED' ? 'COVERED' : 'PARTIAL';

  return {
    requirementId: requirement.id,
    requirement: requirement.label,
    coverage,
    evidenceRefs: [`language:${language.code}`],
    explanation: coverage === 'COVERED'
      ? `Niveau ${language.level} soutenu par une preuve ${evidence.toLowerCase()}.`
      : `Couverture partielle : niveau ou preuve encore insuffisant(e).`,
  };
}

export function classifyRequirementCoverage(context: CandidateContext, jobSpec: JobSpec): RequirementCoverage[] {
  return jobSpec.requirements.map((requirement) => {
    if (requirement.kind === 'skill') return skillCoverage(context, requirement);
    if (requirement.kind === 'language') return languageCoverage(context, requirement);
    if (requirement.kind === 'experience') {
      const enough = requirement.minimumYears === undefined
        || (context.candidate.yearsExperience !== null && context.candidate.yearsExperience >= requirement.minimumYears);
      return {
        requirementId: requirement.id,
        requirement: requirement.label,
        coverage: enough ? 'PARTIAL' : 'GAP',
        evidenceRefs: enough ? ['candidate:years-experience'] : [],
        explanation: enough
          ? 'L’ancienneté déclarée couvre le seuil mais doit rester rattachée aux expériences sources.'
          : 'Ancienneté insuffisante ou non renseignée.',
      };
    }
    return {
      requirementId: requirement.id,
      requirement: requirement.label,
      coverage: 'NOT_APPLICABLE',
      evidenceRefs: [],
      explanation: 'Ce type d’exigence nécessite une revue humaine spécifique.',
    };
  });
}
