import test from 'node:test';
import assert from 'node:assert/strict';
import type { LegalRule, LegalSource } from '../../lib/legal/types.js';
import {
  crossCheckRule,
  type LegalAdversarialEvidenceSet,
} from '../../lib/legal/adversarial-review.js';
import { runLegalRuleTestMatrix } from '../../lib/legal/legal-test-harness.js';

const rule: LegalRule = {
  id: 'ML-TERR-AGE-001',
  countryCode: 'ML',
  regime: 'territorial_public_service',
  sourceId: 'ML-TERR-001',
  article: '12',
  version: '1.0.0',
  effectiveStatus: 'VERIFIED',
  lifecycleStatus: 'TECHNICALLY_VALIDATED',
  conditions: [{ fact: 'age', operator: 'gte', value: 18 }],
  exceptions: [],
  requiredFacts: ['age'],
  verdicts: ['PASS', 'FAIL', 'REVIEW_REQUIRED'],
  onMatch: 'PASS',
  onNoMatch: 'FAIL',
};

const source: LegalSource = {
  id: 'ML-TERR-001',
  title: 'Territorial statute',
  authority: 'Official Gazette',
  sourceUrl: 'https://example.invalid/ml-territorial',
  effectiveStatus: 'VERIFIED',
};

const cleanEvidence: LegalAdversarialEvidenceSet = {
  sources: [source],
  applicableRegime: 'territorial_public_service',
  requiredExceptionIds: [],
  representedExceptionIds: [],
  specialSourceIds: [],
  supranationalConflicts: [],
  nonDiscriminationStatus: 'PASS',
};

test('omitted statutory exceptions block CROSS_CHECKED promotion', () => {
  const result = crossCheckRule(rule, {
    ...cleanEvidence,
    requiredExceptionIds: ['DISABILITY-EXCEPTION'],
  });
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.findings.some((finding) => finding.code === 'OMITTED_EXCEPTION'));
});

test('superseded source evidence blocks the rule', () => {
  const result = crossCheckRule(rule, {
    ...cleanEvidence,
    sources: [{ ...source, effectiveStatus: 'REPLACED' }],
  });
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.findings.some((finding) => finding.code === 'SOURCE_NOT_CURRENT'));
});

test('a conflicting special statute blocks silent promotion', () => {
  const special: LegalSource = {
    ...source,
    id: 'ML-HEALTH-SPECIAL',
    specificity: 'special',
    conflictsWith: ['ML-TERR-001'],
  };
  const result = crossCheckRule(rule, {
    ...cleanEvidence,
    sources: [source, special],
    specialSourceIds: ['ML-HEALTH-SPECIAL'],
  });
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.findings.some((finding) => finding.code === 'SPECIAL_STATUTE_CONFLICT'));
});

test('non-discrimination failure blocks legal promotion', () => {
  const result = crossCheckRule(rule, {
    ...cleanEvidence,
    nonDiscriminationStatus: 'FAIL',
  });
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.findings.some((finding) => finding.code === 'NON_DISCRIMINATION_FAILURE'));
});

test('adjacent but non-applicable legal regime is rejected', () => {
  const result = crossCheckRule(rule, {
    ...cleanEvidence,
    applicableRegime: 'state_public_service',
  });
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.findings.some((finding) => finding.code === 'RULE_REGIME_MISMATCH'));
});

test('supranational conflict forces review instead of automatic promotion', () => {
  const result = crossCheckRule(rule, {
    ...cleanEvidence,
    supranationalConflicts: ['UEMOA-LAYER-CONFLICT'],
  });
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.findings.some((finding) => finding.code === 'SUPRANATIONAL_CONFLICT'));
});

test('clean evidence reaches CROSS_CHECKED', () => {
  const result = crossCheckRule(rule, cleanEvidence);
  assert.equal(result.status, 'CROSS_CHECKED');
  assert.deepEqual(result.findings, []);
});

test('legal test harness reproduces expected verdict matrix deterministically', () => {
  const matrix = runLegalRuleTestMatrix(rule, [
    { id: 'adult', facts: { age: 25 }, expectedVerdict: 'PASS' },
    { id: 'minor', facts: { age: 16 }, expectedVerdict: 'FAIL' },
    { id: 'missing-age', facts: {}, expectedVerdict: 'REVIEW_REQUIRED' },
  ]);
  assert.equal(matrix.passed, true);
  assert.deepEqual(matrix.failures, []);
});
