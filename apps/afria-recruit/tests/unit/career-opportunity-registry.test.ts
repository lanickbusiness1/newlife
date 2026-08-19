import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFICIAL_CAREER_OPPORTUNITIES } from '../../lib/fixtures/career-opportunities.js';

test('every fixture has official provenance and verification timestamp', () => {
  assert.ok(OFFICIAL_CAREER_OPPORTUNITIES.length >= 4);
  for (const item of OFFICIAL_CAREER_OPPORTUNITIES) {
    assert.equal(item.sourceAuthority, 'OFFICIAL');
    assert.match(item.sourceUrl, /^https:\/\//);
    assert.ok(Number.isFinite(Date.parse(item.verifiedAt)));
  }
});

test('registry covers volunteering, online volunteering, FAO young professionals and JPO pathways', () => {
  const ids = new Set(OFFICIAL_CAREER_OPPORTUNITIES.map((item) => item.id));
  assert.ok(ids.has('unv-onsite-generic'));
  assert.ok(ids.has('unv-online-generic'));
  assert.ok(ids.has('fao-young-professionals'));
  assert.ok(ids.has('undp-jpo-generic'));
});

test('vacancy-specific programmes preserve manual-review gates', () => {
  const restricted = OFFICIAL_CAREER_OPPORTUNITIES.filter((item) =>
    ['unv-onsite-generic', 'unv-online-generic', 'fao-young-professionals', 'undp-jpo-generic'].includes(item.id),
  );
  for (const item of restricted) {
    assert.ok(item.eligibilityRules.some((rule) => rule.type === 'MANUAL_REVIEW' && rule.blocking));
  }
});

test('JPO registry does not claim universal nationality eligibility', () => {
  const jpo = OFFICIAL_CAREER_OPPORTUNITIES.find((item) => item.id === 'undp-jpo-generic');
  assert.ok(jpo);
  assert.equal(jpo.eligibilityRules.some((rule) => rule.type === 'NATIONALITY_IN'), false);
});