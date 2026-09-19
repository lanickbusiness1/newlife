import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessDataSourceTrust,
  type DataSourceTrustInput,
} from '../../lib/domain/data-source-trust.js';

function source(overrides: Partial<DataSourceTrustInput> = {}): DataSourceTrustInput {
  return {
    authorityClass: 'A',
    provenance: 1,
    freshness: 1,
    quality: 1,
    representativeness: 1,
    license: 1,
    sovereignty: 1,
    licenseStatus: 'clear',
    ...overrides,
  };
}

test('official fully evidenced source is VERIFIED_READY at 100/100', () => {
  assert.deepEqual(assessDataSourceTrust(source()), {
    trustScore: 100,
    evidenceState: 'VERIFIED_READY',
    redistributionAllowed: true,
    flags: [],
  });
});

test('unknown reuse rights fail closed for redistribution without hiding the source', () => {
  const result = assessDataSourceTrust(source({
    license: 0,
    licenseStatus: 'unknown',
  }));

  assert.equal(result.trustScore, 95);
  assert.equal(result.evidenceState, 'VERIFIED_READY');
  assert.equal(result.redistributionAllowed, false);
  assert.deepEqual(result.flags, ['LICENSE_REUSE_UNRESOLVED']);
});

test('stale weakly representative source is downgraded to OBSERVED_REVIEW', () => {
  const result = assessDataSourceTrust(source({
    authorityClass: 'B',
    freshness: 0,
    representativeness: 0.4,
    quality: 0.6,
    license: 0,
    licenseStatus: 'unknown',
  }));

  assert.equal(result.trustScore, 55);
  assert.equal(result.evidenceState, 'OBSERVED_REVIEW');
  assert.equal(result.redistributionAllowed, false);
  assert.deepEqual(result.flags, [
    'STALE_OR_UNDATED',
    'REPRESENTATIVENESS_LIMITED',
    'LICENSE_REUSE_UNRESOLVED',
  ]);
});

test('component scores outside 0..1 are rejected instead of silently normalized', () => {
  assert.throws(
    () => assessDataSourceTrust(source({ freshness: 1.2 })),
    /freshness must be between 0 and 1/,
  );
});
