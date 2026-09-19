import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCountryLegalPack,
  assertLegalRule,
  type CountryLegalPack,
  type LegalRule,
} from '../../lib/legal/types.js';

const validPack: CountryLegalPack = {
  countryCode: 'ML',
  version: '0.1.0',
  integrityHash: 'sha256:ml-pack-v0.1.0',
  status: 'COUNTRY_READY',
  legalRegimes: ['private_employment', 'state_public_service', 'territorial_public_service'],
  regionalLayers: [],
  sources: [
    {
      id: 'ML-TERR-001',
      title: 'Loi n°2018-035 du 27 juin 2018 portant Statut des fonctionnaires des Collectivités territoriales',
      authority: 'Journal officiel de la République du Mali',
      sourceUrl: 'https://sgg-mali.ml/JO/2018/mali-jo-2018-26.pdf',
      effectiveStatus: 'VERIFIED',
      effectiveFrom: '2018-06-27',
    },
  ],
};

const validRule: LegalRule = {
  id: 'ML-TERR-ELIG-001',
  countryCode: 'ML',
  regime: 'territorial_public_service',
  sourceId: 'ML-TERR-001',
  article: '12',
  version: '1.0.0',
  effectiveStatus: 'VERIFIED',
  lifecycleStatus: 'TECHNICALLY_VALIDATED',
  conditions: [],
  exceptions: [],
  requiredFacts: [],
  verdicts: ['PASS', 'FAIL', 'REVIEW_REQUIRED'],
};

test('accepts a complete country legal pack contract', () => {
  assert.deepEqual(assertCountryLegalPack(validPack), validPack);
});

test('rejects a country legal pack missing canonical identity fields', () => {
  for (const field of ['countryCode', 'version', 'integrityHash', 'status'] as const) {
    const malformed = { ...validPack } as Record<string, unknown>;
    delete malformed[field];
    assert.throws(() => assertCountryLegalPack(malformed), new RegExp(field));
  }
});

test('rejects a rule without exact source and article provenance', () => {
  const missingSource = { ...validRule, sourceId: '' };
  const missingArticle = { ...validRule, article: '' };
  assert.throws(() => assertLegalRule(missingSource), /sourceId/);
  assert.throws(() => assertLegalRule(missingArticle), /article/);
});

test('rejects unsupported legal verdict values', () => {
  const malformed = { ...validRule, verdicts: ['PASS', 'DENY'] } as unknown;
  assert.throws(() => assertLegalRule(malformed), /verdict/i);
});
