import test from 'node:test';
import assert from 'node:assert/strict';
import type { LegalSource } from '../../lib/legal/types.js';
import { compileLegalRule, type LegalRuleDraft } from '../../lib/legal/rule-compiler.js';
import { evaluateLegalRules } from '../../lib/legal/rule-evaluator.js';

const verifiedSource: LegalSource = {
  id: 'ML-TERR-001',
  title: 'Territorial public service statute',
  authority: 'Official Gazette',
  sourceUrl: 'https://example.invalid/ml-territorial',
  effectiveStatus: 'VERIFIED',
  effectiveFrom: '2018-06-27',
};

const validDraft: LegalRuleDraft = {
  id: 'ML-TERR-AGE-001',
  countryCode: 'ML',
  regime: 'territorial_public_service',
  sourceId: 'ML-TERR-001',
  article: '12',
  version: '1.0.0',
  requiredFacts: ['age'],
  conditions: [{ fact: 'age', operator: 'gte', value: 18 }],
  exceptions: [],
  onMatch: 'PASS',
  onNoMatch: 'FAIL',
};

test('a rule without an exact article cannot become technically validated', () => {
  const compiled = compileLegalRule({ ...validDraft, article: '' }, [verifiedSource]);
  assert.equal(compiled.lifecycleStatus, 'REVIEW_REQUIRED');
});

test('a rule backed by incomplete effective source evidence cannot become technically validated', () => {
  const incomplete = { ...verifiedSource, effectiveStatus: 'INCOMPLETE' as const };
  const compiled = compileLegalRule(validDraft, [incomplete]);
  assert.equal(compiled.lifecycleStatus, 'REVIEW_REQUIRED');
});

test('a sourced structured rule compiles to TECHNICALLY_VALIDATED', () => {
  const compiled = compileLegalRule(validDraft, [verifiedSource]);
  assert.equal(compiled.lifecycleStatus, 'TECHNICALLY_VALIDATED');
  assert.equal(compiled.article, '12');
});

test('deterministic evaluator returns PASS and FAIL from explicit conditions only', () => {
  const rule = compileLegalRule(validDraft, [verifiedSource]);
  assert.equal(
    evaluateLegalRules({ age: 25 }, [rule], { countryCode: 'ML', regime: 'territorial_public_service' }).verdict,
    'PASS',
  );
  assert.equal(
    evaluateLegalRules({ age: 16 }, [rule], { countryCode: 'ML', regime: 'territorial_public_service' }).verdict,
    'FAIL',
  );
});

test('missing required facts fail closed to REVIEW_REQUIRED', () => {
  const rule = compileLegalRule(validDraft, [verifiedSource]);
  const result = evaluateLegalRules({}, [rule], { countryCode: 'ML', regime: 'territorial_public_service' });
  assert.equal(result.verdict, 'REVIEW_REQUIRED');
  assert.deepEqual(result.missingFacts, ['age']);
});

test('same facts plus same rule version produces byte-identical serialized output', () => {
  const rule = compileLegalRule(validDraft, [verifiedSource]);
  const first = evaluateLegalRules({ age: 25 }, [rule], { countryCode: 'ML', regime: 'territorial_public_service' });
  const second = evaluateLegalRules({ age: 25 }, [rule], { countryCode: 'ML', regime: 'territorial_public_service' });
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});
