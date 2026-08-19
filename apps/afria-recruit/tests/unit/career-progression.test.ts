import test from 'node:test';
import assert from 'node:assert/strict';
import { rankCareerNextActions, SCORE_WEIGHTS, scoreProgression } from '../../lib/domain/career-progression.js';
import type { CandidateEligibilityProfile, CareerOpportunity } from '../../lib/domain/career-opportunity.js';

const now = new Date('2026-08-19T00:00:00.000Z');
const goal = { id: 'goal-1', title: 'Programme Officer', targetOrganization: 'UNDP' };
const profile: CandidateEligibilityProfile = {
  candidateId: 'candidate-1',
  age: 28,
  nationalities: ['ML'],
  residenceCountryCode: 'ML',
  highestEducationLevel: 'MASTER',
  yearsExperience: 4,
  languageCodes: ['fr', 'en'],
};

function fixture(id: string, overrides: Partial<CareerOpportunity> = {}): CareerOpportunity {
  return {
    id,
    title: id,
    organization: 'UNDP',
    kind: 'ONLINE_VOLUNTEERING',
    countryCode: null,
    remote: true,
    sourceUrl: 'https://www.unv.org/become-online-volunteer',
    sourceAuthority: 'OFFICIAL',
    verifiedAt: '2026-08-19T00:00:00.000Z',
    opensAt: null,
    closesAt: null,
    eligibilityRules: [{ id: `${id}-age`, type: 'MIN_AGE', value: 18, blocking: true }],
    progression: {
      goalAlignment: 70,
      evidenceGain: 70,
      skillGain: 70,
      futureEligibilityUnlock: 70,
      networkExposure: 70,
      immediateFit: 70,
    },
    burden: { estimatedHours: null, directCostUsd: null },
    ...overrides,
  };
}

const eligibleLow = fixture('eligible-low', {
  progression: {
    goalAlignment: 50,
    evidenceGain: 50,
    skillGain: 50,
    futureEligibilityUnlock: 50,
    networkExposure: 50,
    immediateFit: 50,
  },
});

const reviewHigh = fixture('review-high', {
  eligibilityRules: [{ id: 'manual', type: 'MANUAL_REVIEW', value: 'Vacancy-specific criteria', blocking: true }],
  progression: {
    goalAlignment: 100,
    evidenceGain: 100,
    skillGain: 100,
    futureEligibilityUnlock: 100,
    networkExposure: 100,
    immediateFit: 100,
  },
});

const ineligibleHigh = fixture('ineligible-high', {
  eligibilityRules: [{ id: 'age-max', type: 'MAX_AGE', value: 25, blocking: true }],
  progression: {
    goalAlignment: 100,
    evidenceGain: 100,
    skillGain: 100,
    futureEligibilityUnlock: 100,
    networkExposure: 100,
    immediateFit: 100,
  },
});

test('progression weights sum to 100', () => {
  assert.equal(Object.values(SCORE_WEIGHTS).reduce((sum, weight) => sum + weight, 0), 100);
});

test('progression scoring clamps components and discloses weighted components', () => {
  const scored = scoreProgression(fixture('clamp', {
    progression: {
      goalAlignment: 120,
      evidenceGain: -20,
      skillGain: 80,
      futureEligibilityUnlock: 80,
      networkExposure: 80,
      immediateFit: 80,
    },
  }), goal);
  assert.equal(scored.components.goalAlignment.raw, 100);
  assert.equal(scored.components.evidenceGain.raw, 0);
  assert.ok(scored.total >= 0 && scored.total <= 100);
});

test('eligible opportunities rank before review-required and ineligible opportunities', () => {
  const ranked = rankCareerNextActions(goal, [ineligibleHigh, reviewHigh, eligibleLow], profile, now);
  assert.equal(ranked[0].eligibility.status, 'ELIGIBLE');
  assert.equal(ranked[1].eligibility.status, 'REVIEW_REQUIRED');
  assert.equal(ranked[2].eligibility.status, 'INELIGIBLE');
});

test('same inputs produce identical ranking', () => {
  const fixtures = [reviewHigh, eligibleLow, ineligibleHigh, fixture('eligible-tie-b'), fixture('eligible-tie-a')];
  assert.deepEqual(
    rankCareerNextActions(goal, fixtures, profile, now),
    rankCareerNextActions(goal, fixtures, profile, now),
  );
});

test('organization match increases goal-alignment component without changing other raw signals', () => {
  const matching = scoreProgression(fixture('org-match', { organization: 'UNDP' }), goal);
  const nonMatching = scoreProgression(fixture('org-other', { organization: 'FAO' }), goal);
  assert.ok(matching.components.goalAlignment.raw > nonMatching.components.goalAlignment.raw);
  assert.equal(matching.components.skillGain.raw, nonMatching.components.skillGain.raw);
});