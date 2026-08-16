export interface VerifiedMetric {
  value: string;
  sourceRef: string;
}

export interface RewriteAchievementInput {
  sourceStatement: string;
  verifiedMetrics: VerifiedMetric[];
}

export interface RewriteAchievementOutput {
  text: string;
  usedMetrics: string[];
}

export function rewriteAchievement(input: RewriteAchievementInput): RewriteAchievementOutput {
  const source = input.sourceStatement.trim();
  if (!source) throw new Error('Source statement is required');

  if (!input.verifiedMetrics.length) {
    return { text: source, usedMetrics: [] };
  }

  const metrics = input.verifiedMetrics
    .filter((metric) => metric.value.trim() && metric.sourceRef.trim())
    .map((metric) => metric.value.trim());
  const usedMetrics = input.verifiedMetrics
    .filter((metric) => metric.value.trim() && metric.sourceRef.trim())
    .map((metric) => metric.sourceRef);

  if (!metrics.length) return { text: source, usedMetrics: [] };
  return {
    text: `${source.replace(/[.\s]+$/, '')}. Résultat documenté : ${metrics.join(' ; ')}.`,
    usedMetrics,
  };
}
