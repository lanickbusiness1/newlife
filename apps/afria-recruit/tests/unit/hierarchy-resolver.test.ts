import test from 'node:test';
import assert from 'node:assert/strict';
import type { CountryLegalPack, LegalSource } from '../../lib/legal/types.js';
import { resolveApplicableSources } from '../../lib/legal/hierarchy-resolver.js';

const generalSource = {
  id: 'ML-TERR-GENERAL',
  title: 'General territorial statute',
  authority: 'Official Gazette',
  sourceUrl: 'https://example.invalid/general',
  effectiveStatus: 'VERIFIED',
  effectiveFrom: '2018-01-01',
  regimes: ['territorial_public_service'],
  subjects: ['recruitment', 'health'],
  normLevel: 'statute',
  specificity: 'general',
} as LegalSource;

const specialHealthSource = {
  id: 'ML-HEALTH-SPECIAL',
  title: 'Special health recruitment statute',
  authority: 'Official Gazette',
  sourceUrl: 'https://example.invalid/special',
  effectiveStatus: 'VERIFIED',
  effectiveFrom: '2020-01-01',
  regimes: ['territorial_public_service'],
  subjects: ['health'],
  normLevel: 'special_statute',
  specificity: 'special',
} as LegalSource;

const pack = {
  countryCode: 'ML',
  version: 'test',
  integrityHash: 'sha256:test',
  status: 'SOURCE_VERIFIED',
  legalRegimes: ['territorial_public_service'],
  regionalLayers: [],
  sources: [generalSource, specialHealthSource],
} as CountryLegalPack;

test('a proven special statute outranks an applicable general source', () => {
  const result = resolveApplicableSources(
    { regime: 'territorial_public_service', subject: 'health' },
    '2026-08-23',
    pack,
    [],
  );

  assert.equal(result.status, 'RESOLVED');
  assert.equal(result.sources[0]?.id, 'ML-HEALTH-SPECIAL');
  assert.ok(result.sources.some((source) => source.id === 'ML-TERR-GENERAL'));
});

test('unresolved conflicts return REVIEW_REQUIRED instead of silently choosing a source', () => {
  const conflictA = { ...specialHealthSource, id: 'ML-CONFLICT-A', conflictsWith: ['ML-CONFLICT-B'] } as LegalSource;
  const conflictB = { ...specialHealthSource, id: 'ML-CONFLICT-B', conflictsWith: ['ML-CONFLICT-A'] } as LegalSource;
  const conflictPack = { ...pack, sources: [generalSource, conflictA, conflictB] } as CountryLegalPack;

  const result = resolveApplicableSources(
    { regime: 'territorial_public_service', subject: 'health' },
    '2026-08-23',
    conflictPack,
    [],
  );

  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.ok(result.conflicts.length > 0);
});
