import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCountryLegalPack } from '../../lib/legal/country-pack-loader.js';
import { resolveJurisdiction } from '../../lib/legal/jurisdiction-resolver.js';

const maliPack = loadCountryLegalPack('ML');

test('resolves private employment before applying legal rules', () => {
  const result = resolveJurisdiction({ employerType: 'private', subject: 'employment' }, maliPack);
  assert.equal(result.regime, 'private_employment');
});

test('resolves State civil service before applying legal rules', () => {
  const result = resolveJurisdiction({ employerType: 'state', subject: 'recruitment' }, maliPack);
  assert.equal(result.regime, 'state_public_service');
});

test('resolves territorial public service before applying legal rules', () => {
  const result = resolveJurisdiction({ employerType: 'territorial_authority', subject: 'recruitment' }, maliPack);
  assert.equal(result.regime, 'territorial_public_service');
});

test('refuses to guess a legal regime from an unsupported employer type', () => {
  assert.throws(
    () => resolveJurisdiction({ employerType: 'unknown', subject: 'recruitment' }, maliPack),
    /jurisdiction.*unknown|unsupported.*employer/i,
  );
});
