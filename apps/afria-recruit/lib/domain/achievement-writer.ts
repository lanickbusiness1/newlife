import type { ConfirmedFact } from './evidence-elicitation.js';

export interface VerifiedMetric {
  value: string;
  sourceRef: string;
}

export interface RewriteAchievementInput {
  sourceStatement: string;
  verifiedMetrics: VerifiedMetric[];
  confirmedFacts?: ConfirmedFact[];
  externalProcessingConsentId?: string;
}

export interface RewriteAchievementOutput {
  text: string;
  usedMetrics: string[];
  usedConfirmedFacts: string[];
}

function validateConfirmedFacts(facts: ConfirmedFact[]): ConfirmedFact[] {
  return facts.map((fact) => {
    const key = fact.key.trim();
    const value = fact.value.trim();
    const sourceRef = fact.sourceRef.trim();
    if (!key || !value) throw new Error('Confirmed fact key and value are required');
    if (!sourceRef) throw new Error('Confirmed fact source is required');
    return { ...fact, key, value, sourceRef };
  });
}

export function rewriteAchievement(input: RewriteAchievementInput): RewriteAchievementOutput {
  const source = input.sourceStatement.trim();
  if (!source) throw new Error('Source statement is required');

  const confirmedFacts = validateConfirmedFacts(input.confirmedFacts ?? []);
  const validMetrics = input.verifiedMetrics.filter((metric) => metric.value.trim() && metric.sourceRef.trim());
  const metrics = validMetrics.map((metric) => metric.value.trim());
  const usedMetrics = validMetrics.map((metric) => metric.sourceRef.trim());
  const usedConfirmedFacts = confirmedFacts.map((fact) => `${fact.sourceRef}:${fact.key}`);

  const clauses: string[] = [];
  if (confirmedFacts.length) {
    const declared = confirmedFacts
      .filter((fact) => fact.status === 'DECLARED')
      .map((fact) => fact.value);
    const evidenced = confirmedFacts
      .filter((fact) => fact.status !== 'DECLARED')
      .map((fact) => fact.value);
    if (declared.length) clauses.push(`Détail déclaré et confirmé par le candidat : ${declared.join(' ; ')}`);
    if (evidenced.length) clauses.push(`Détail soutenu par une preuve : ${evidenced.join(' ; ')}`);
  }
  if (metrics.length) clauses.push(`Résultat documenté : ${metrics.join(' ; ')}`);

  if (!clauses.length) return { text: source, usedMetrics: [], usedConfirmedFacts: [] };
  return {
    text: `${source.replace(/[.\s]+$/, '')}. ${clauses.join('. ')}.`,
    usedMetrics,
    usedConfirmedFacts,
  };
}
