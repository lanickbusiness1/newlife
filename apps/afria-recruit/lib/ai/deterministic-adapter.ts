import { diagnoseCv } from '../domain/cv-diagnostic.js';
import { classifyRequirementCoverage } from '../domain/gap-matching.js';
import { rewriteAchievement } from '../domain/achievement-writer.js';
import type { CandidateAiAdapter } from './contracts.js';

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
    const focus = analysis.find((row) => row.coverage === 'GAP')
      ?? analysis.find((row) => row.coverage === 'PARTIAL')
      ?? analysis[0];
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
