import type { JobAnalysisOutput, RewriteInput, RewriteOutput, InterviewTurnOutput } from './contracts.js';

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max = 4000): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  if (value.length > max) throw new Error(`${label} exceeds maximum length`);
  return value.trim();
}

function stringArray(value: unknown, label: string, maxItems = 100): string[] {
  if (!Array.isArray(value) || value.length > maxItems || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} must be a bounded string array`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function numericClaims(value: string): string[] {
  return value.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? [];
}

export function validateRewriteOutput(value: unknown, input: RewriteInput): RewriteOutput {
  const candidate = object(value, 'rewrite output');
  const outputText = text(candidate.text, 'rewrite text');
  const usedMetrics = stringArray(candidate.usedMetrics, 'usedMetrics', 20);
  const allowedRefs = new Set(input.verifiedMetrics.map((metric) => metric.sourceRef));
  if (usedMetrics.some((reference) => !allowedRefs.has(reference))) {
    throw new Error('Rewrite references an unsupported metric source');
  }

  const allowedNumericClaims = new Set(numericClaims([
    input.sourceStatement,
    ...input.verifiedMetrics.map((metric) => metric.value),
  ].join(' ')));
  for (const claim of numericClaims(outputText)) {
    if (!allowedNumericClaims.has(claim)) throw new Error(`Unsupported numeric claim: ${claim}`);
  }

  return { text: outputText, usedMetrics };
}

export function validateJobAnalysisOutput(value: unknown): JobAnalysisOutput {
  const candidate = object(value, 'job analysis');
  if (!Array.isArray(candidate.requirements)) throw new Error('requirements must be an array');
  const allowedCoverage = new Set(['COVERED', 'PARTIAL', 'GAP', 'NOT_APPLICABLE']);
  const requirements = candidate.requirements.map((raw, index) => {
    const row = object(raw, `requirement ${index}`);
    const requirementId = text(row.requirementId, 'requirementId', 200);
    const requirement = text(row.requirement, 'requirement', 1000);
    const coverage = text(row.coverage, 'coverage', 32);
    if (!allowedCoverage.has(coverage)) throw new Error('Invalid coverage');
    const evidenceRefs = stringArray(row.evidenceRefs, 'evidenceRefs', 50);
    if (coverage === 'GAP' && evidenceRefs.length) throw new Error('GAP cannot carry evidence');
    const explanation = text(row.explanation, 'explanation', 2000);
    return { requirementId, requirement, coverage: coverage as JobAnalysisOutput['requirements'][number]['coverage'], evidenceRefs, explanation };
  });
  return { requirements };
}

export function validateInterviewTurnOutput(value: unknown, allowedRequirementIds: string[]): InterviewTurnOutput {
  const candidate = object(value, 'interview turn');
  const question = text(candidate.question, 'question', 1200);
  const feedback = candidate.feedback === null || candidate.feedback === undefined
    ? null
    : text(candidate.feedback, 'feedback', 2500);
  const focusRequirementIds = stringArray(candidate.focusRequirementIds, 'focusRequirementIds', 20);
  if (focusRequirementIds.some((id) => !allowedRequirementIds.includes(id))) {
    throw new Error('Interview turn references an unknown requirement');
  }
  const evidenceRefs = stringArray(candidate.evidenceRefs, 'evidenceRefs', 30);
  return { question, feedback, focusRequirementIds, evidenceRefs };
}
