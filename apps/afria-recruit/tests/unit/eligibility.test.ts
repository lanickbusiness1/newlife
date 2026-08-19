import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEligibility } from '../../lib/domain/eligibility.js';
import type { CareerOpportunity, CandidateEligibilityProfile } from '../../lib/domain/career-opportunity.js';

const NOW = new Date('2026-08-19T00:00:00.000Z');

function opportunity(overrides: Partial<CareerOpportunity> = {}): CareerOpportunity {
  return {
    id: 'unv-online-1',
    title: 'Online Volunteer',
    organization: 'UNV',
    kind: 'ONLINE_VOLUNTEERING',
    countryCode: null,
    remote: true,
    sourceUrl: 'https://www.unv.org/become-online-volunteer',
    sourceAuthority: 'OFFICIAL',
    verifiedAt: '2026-08-19T00:00:00.000Z',
    opensAt: null,
    closesAt: null,
    eligibilityRules: [{ id: 'age-18', type: 'MIN_AGE', value: 18, blocking: true }],
    progression: {
      goalAlignment: 70,
      evidenceGain: 80,
      skillGain: 60,
      futureEligibilityUnlock: 50,
      networkExposure: 80,
      immediateFit: 70,
    },
    burden: { estimatedHours: null, directCostUsd: null },
    ...overrides,
  };
}

function profile(overrides: Partial<CandidateEligibilityProfile> = {}): CandidateEligibilityProfile {
  return {
    candidateId: 'candidate-1',
    age: null,
    nationalities: [],
    residenceCountryCode: null,
    highestEducationLevel: null,
    yearsExperience: null,
    languageCodes: [],
    ...overrides,
  };
}

test('missing blocking candidate data requires review instead of inferred eligibility', () => {
  const result = evaluateEligibility(profile(), opportunity(), NOW);
  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.deepEqual(result.missingData, ['age']);
  assert.equal(result.failedRuleIds.length, 0);
});

test('known conflict with blocking rule is ineligible', () => {
  const result = evaluateEligibility(profile({ age: 17 }), opportunity(), NOW);
  assert.equal(result.status, 'INELIGIBLE');
  assert.deepEqual(result.failedRuleIds, ['age-18']);
});

test('all blocking rules satisfied is eligible', () => {
  const result = evaluateEligibility(profile({ age: 25 }), opportunity(), NOW);
  assert.equal(result.status, 'ELIGIBLE');
  assert.deepEqual(result.failedRuleIds, []);
  assert.deepEqual(result.missingData, []);
});

test('home-country-like absence of nationality never becomes inferred nationality eligibility', () => {
  const result = evaluateEligibility(
    profile({ age: 25, nationalities: [] }),
    opportunity({
      eligibilityRules: [{ id: 'nationality-ml', type: 'NATIONALITY_IN', value: ['ML'], blocking: true }],
    }),
    NOW,
  );
  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.deepEqual(result.missingData, ['nationalities']);
});

test('manual-review blocking rule prevents automatic eligible status', () => {
  const result = evaluateEligibility(
    profile({ age: 25 }),
    opportunity({
      eligibilityRules: [
        { id: 'age-18', type: 'MIN_AGE', value: 18, blocking: true },
        { id: 'vacancy-specific', type: 'MANUAL_REVIEW', value: 'Check vacancy-specific requirements', blocking: true },
      ],
    }),
    NOW,
  );
  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.deepEqual(result.reviewRuleIds, ['vacancy-specific']);
});

test('stale source cannot produce automatic eligible status', () => {
  const result = evaluateEligibility(
    profile({ age: 25 }),
    opportunity({ verifiedAt: '2026-06-01T00:00:00.000Z' }),
    NOW,
  );
  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.equal(result.sourceFresh, false);
});

test('known ineligibility takes precedence over manual review', () => {
  const result = evaluateEligibility(
    profile({ age: 17 }),
    opportunity({
      eligibilityRules: [
        { id: 'age-18', type: 'MIN_AGE', value: 18, blocking: true },
        { id: 'vacancy-specific', type: 'MANUAL_REVIEW', value: 'Check vacancy-specific requirements', blocking: true },
      ],
    }),
    NOW,
  );
  assert.equal(result.status, 'INELIGIBLE');
  assert.deepEqual(result.failedRuleIds, ['age-18']);
});