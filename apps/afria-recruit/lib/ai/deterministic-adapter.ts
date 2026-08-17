import { diagnoseCv } from '../domain/cv-diagnostic.js';
import { classifyRequirementCoverage } from '../domain/gap-matching.js';
import { rewriteAchievement } from '../domain/achievement-writer.js';
import { buildRecruiterLens, type RecruiterLensItem } from '../domain/recruiter-lens.js';
import type { CandidateAiAdapter } from './contracts.js';

function interviewRiskRank(item: RecruiterLensItem): number {
  if (item.priority === 'BLOCKING' && item.coverage === 'GAP') return 0;
  if (item.priority === 'BLOCKING' && item.coverage === 'PARTIAL') return 1;
  if (item.priority === 'HIGH' && item.coverage === 'GAP') return 2;
  if (item.priority === 'HIGH' && item.coverage === 'PARTIAL') return 3;
  if (item.coverage === 'GAP') return 4;
  if (item.coverage === 'PARTIAL') return 5;
  return 6;
}

export class DeterministicCandidateAiAdapter implements CandidateAiAdapter {
  readonly providerName = 'deterministic' as const;

  async diagnose(input: Parameters<CandidateAiAdapter['diagnose']>[0]) {
    return { findings: diagnoseCv(input.context) };
  }

  async analyzeJob(input: Parameters<CandidateAiAdapter['analyzeJob']>[0]) {
    return { requirements: classifyRequirementCoverage(input.context, input.jobSpec) };
  }

  async rewrite(input: Parameters<CandidateAiAdapter['rewrite']>[0]) {
    return rewriteAchievement(input);
  }

  async interviewTurn(input: Parameters<CandidateAiAdapter['interviewTurn']>[0]) {
    const analysis = classifyRequirementCoverage(input.context, input.jobSpec);
    const lens = buildRecruiterLens(input.jobSpec, analysis);
    const focus = [...lens]
      .sort((left, right) => interviewRiskRank(left) - interviewRiskRank(right))
      .find((item) => item.coverage === 'GAP' || item.coverage === 'PARTIAL')
      ?? lens[0];
    const question = focus
      ? `Pouvez-vous décrire une situation concrète liée à « ${focus.requirement} » en distinguant clairement ce que vous avez fait personnellement et le résultat observé ?`
      : `Présentez une réalisation pertinente pour le poste de ${input.jobSpec.title}, en citant uniquement des faits que vous pouvez soutenir.`;
    const feedback = input.candidateAnswer?.trim()
      ? 'Réponse enregistrée pour entraînement. Vérifiez qu’elle cite des faits précis et uniquement des résultats que vous pouvez soutenir.'
      : null;
    return {
      question,
      feedback,
      focusRequirementIds: focus ? [focus.requirementId] : [],
      evidenceRefs: focus?.evidenceRefs ?? [],
    };
  }
}
