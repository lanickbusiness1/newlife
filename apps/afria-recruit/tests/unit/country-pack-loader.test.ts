import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  listCountryPackVersions,
  loadCountryLegalPack,
} from '../../lib/legal/country-pack-loader.js';

test('loads Mali from the country-pack registry without embedding candidate decisions', () => {
  const pack = loadCountryLegalPack('ML');
  assert.equal(pack.countryCode, 'ML');
  assert.equal(pack.version, '0.1.0');
  assert.equal(pack.status, 'SOURCE_VERIFIED');
  assert.ok(pack.sources.some((source) => source.id === 'ML-TERR-001'));
  assert.ok(pack.sources.some((source) => source.id === 'ML-DIS-001'));
  assert.equal('rules' in pack, false);
});

test('lists immutable Country Legal Pack versions by ISO code', () => {
  assert.deepEqual(listCountryPackVersions('ML'), ['0.1.0']);
});

test('unknown countries fail closed', () => {
  assert.throws(() => loadCountryLegalPack('ZZ'), /Country Legal Pack.*ZZ/i);
  assert.deepEqual(listCountryPackVersions('ZZ'), []);
});

test('country-pack loader contains no Mali-specific decision branch', () => {
  const source = readFileSync(resolve(process.cwd(), 'lib/legal/country-pack-loader.ts'), 'utf8');
  assert.doesNotMatch(source, /if\s*\([^)]*(?:country|countryCode)[^)]*===\s*['"]ML['"]/i);
});
