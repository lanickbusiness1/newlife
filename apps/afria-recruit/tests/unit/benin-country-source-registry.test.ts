import test from 'node:test';
import assert from 'node:assert/strict';
import { BENIN_COUNTRY_SOURCE_REGISTRY } from '../../lib/data/benin-country-source-registry.js';

test('Benin country source registry contains at least ten canonical public sources', () => {
  assert.ok(BENIN_COUNTRY_SOURCE_REGISTRY.length >= 10);
  assert.ok(BENIN_COUNTRY_SOURCE_REGISTRY.every((source) => source.country === 'BJ'));
  assert.ok(BENIN_COUNTRY_SOURCE_REGISTRY.every((source) => source.canonicalUrl.startsWith('https://')));
});

test('Benin country source registry source IDs are unique and namespaced', () => {
  const ids = BENIN_COUNTRY_SOURCE_REGISTRY.map((source) => source.sourceId);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id.startsWith('BJ-')));
});

test('Benin country source registry is public-source metadata only and carries no PII fields', () => {
  const serialized = JSON.stringify(BENIN_COUNTRY_SOURCE_REGISTRY).toLowerCase();
  for (const forbidden of ['candidate_name', 'candidate_email', 'candidate_phone', 'cv_text', 'date_of_birth']) {
    assert.equal(serialized.includes(forbidden), false, `forbidden PII field: ${forbidden}`);
  }

  assert.ok(BENIN_COUNTRY_SOURCE_REGISTRY.every((source) => source.piiClass === 'PUBLIC_AGGREGATE_OR_METADATA'));
});

test('every registered source declares authority, evidence state and product mapping', () => {
  assert.ok(BENIN_COUNTRY_SOURCE_REGISTRY.every((source) => ['A', 'B'].includes(source.authorityClass)));
  assert.ok(BENIN_COUNTRY_SOURCE_REGISTRY.every((source) => source.evidenceState === 'EVIDENCED'));
  assert.ok(BENIN_COUNTRY_SOURCE_REGISTRY.every((source) => source.productMapping.includes('PRD-RECRUIT-001')));
});
