import type {
  LegalCondition,
  LegalRegime,
  LegalRule,
  LegalVerdict,
} from './types.js';

export interface LegalEvaluationContext {
  countryCode: string;
  regime: LegalRegime;
}

export interface LegalRuleEvaluationResult {
  ruleId: string;
  ruleVersion: string;
  verdict: LegalVerdict;
}

export interface LegalEvaluationResult {
  verdict: LegalVerdict;
  ruleResults: LegalRuleEvaluationResult[];
  missingFacts: string[];
  reasons: string[];
}

function hasFact(facts: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(facts, key) && facts[key] !== null && facts[key] !== undefined;
}

function matchesCondition(facts: Record<string, unknown>, condition: LegalCondition): boolean {
  const factValue = facts[condition.fact];

  switch (condition.operator) {
    case 'present':
      return hasFact(facts, condition.fact);
    case 'absent':
      return !hasFact(facts, condition.fact);
    case 'equals':
      return factValue === condition.value;
    case 'not_equals':
      return factValue !== condition.value;
    case 'gte':
      return typeof factValue === 'number' && typeof condition.value === 'number' && factValue >= condition.value;
    case 'lte':
      return typeof factValue === 'number' && typeof condition.value === 'number' && factValue <= condition.value;
    case 'gt':
      return typeof factValue === 'number' && typeof condition.value === 'number' && factValue > condition.value;
    case 'lt':
      return typeof factValue === 'number' && typeof condition.value === 'number' && factValue < condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.some((candidate) => candidate === factValue);
  }
}

function aggregateVerdict(results: LegalRuleEvaluationResult[]): LegalVerdict {
  if (results.some((result) => result.verdict === 'REVIEW_REQUIRED')) return 'REVIEW_REQUIRED';
  if (results.some((result) => result.verdict === 'FAIL')) return 'FAIL';
  if (results.some((result) => result.verdict === 'PASS')) return 'PASS';
  return 'NOT_APPLICABLE';
}

export function evaluateLegalRules(
  facts: Record<string, unknown>,
  rules: LegalRule[],
  context: LegalEvaluationContext,
): LegalEvaluationResult {
  const applicableRules = rules.filter(
    (rule) => rule.countryCode === context.countryCode && rule.regime === context.regime,
  );

  if (applicableRules.length === 0) {
    return {
      verdict: 'NOT_APPLICABLE',
      ruleResults: [],
      missingFacts: [],
      reasons: ['NO_APPLICABLE_RULE'],
    };
  }

  const missingFacts = [...new Set(
    applicableRules.flatMap((rule) => rule.requiredFacts.filter((fact) => !hasFact(facts, fact))),
  )].sort();

  const invalidRules = applicableRules
    .filter((rule) => rule.lifecycleStatus !== 'TECHNICALLY_VALIDATED' || rule.effectiveStatus !== 'VERIFIED')
    .map((rule) => rule.id)
    .sort();

  if (missingFacts.length > 0 || invalidRules.length > 0) {
    return {
      verdict: 'REVIEW_REQUIRED',
      ruleResults: applicableRules.map((rule) => ({
        ruleId: rule.id,
        ruleVersion: rule.version,
        verdict: 'REVIEW_REQUIRED',
      })),
      missingFacts,
      reasons: invalidRules.map((ruleId) => `RULE_NOT_VALIDATED:${ruleId}`),
    };
  }

  const ruleResults = applicableRules.map((rule): LegalRuleEvaluationResult => {
    const exceptionTriggered = rule.exceptions.some((condition) => matchesCondition(facts, condition));
    if (exceptionTriggered) {
      return { ruleId: rule.id, ruleVersion: rule.version, verdict: 'REVIEW_REQUIRED' };
    }

    const matched = rule.conditions.every((condition) => matchesCondition(facts, condition));
    return {
      ruleId: rule.id,
      ruleVersion: rule.version,
      verdict: matched ? (rule.onMatch ?? 'PASS') : (rule.onNoMatch ?? 'NOT_APPLICABLE'),
    };
  });

  return {
    verdict: aggregateVerdict(ruleResults),
    ruleResults,
    missingFacts: [],
    reasons: [],
  };
}
