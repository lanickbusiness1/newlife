import type { LegalRule, LegalVerdict } from './types.js';
import { evaluateLegalRules } from './rule-evaluator.js';

export interface LegalRuleTestCase {
  id: string;
  facts: Record<string, unknown>;
  expectedVerdict: LegalVerdict;
}

export interface LegalRuleTestFailure {
  id: string;
  expectedVerdict: LegalVerdict;
  actualVerdict: LegalVerdict;
}

export interface LegalRuleTestMatrixResult {
  passed: boolean;
  failures: LegalRuleTestFailure[];
}

export function runLegalRuleTestMatrix(
  rule: LegalRule,
  cases: LegalRuleTestCase[],
): LegalRuleTestMatrixResult {
  const failures = cases.flatMap((testCase): LegalRuleTestFailure[] => {
    const result = evaluateLegalRules(testCase.facts, [rule], {
      countryCode: rule.countryCode,
      regime: rule.regime,
    });
    return result.verdict === testCase.expectedVerdict
      ? []
      : [{ id: testCase.id, expectedVerdict: testCase.expectedVerdict, actualVerdict: result.verdict }];
  });

  return { passed: failures.length === 0, failures };
}
