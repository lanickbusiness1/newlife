import test from 'node:test';
import assert from 'node:assert/strict';
import { CareerPathwayService, buildCandidateEligibilityProfile } from '../../lib/services/career-pathway-service.js';
import type { CandidateContext, CandidateRepository } from '../../lib/repositories/candidate-context.js';
import type { CareerOpportunity } from '../../lib/domain/career-opportunity.js';

const context: CandidateContext = {
  candidate: {
    id: 'candidate-1', userId: 'user-1', publicCode: 'C-1', professionalTitle: 'Programme Manager',
    summary: null, currentCountry: 'ML', homeCountry: 'BJ', yearsExperience: 8, verificationStatus: 'partial',
  },
  experiences: [],
  educations: [{
    id: 'edu-1', institution: 'Institute', qualification: 'Master project management', fieldOfStudy: null,
    country: 'BJ', startDate: null, completionDate: null, evidenceStatus: 'evidenced', sourceDocumentId: null,
  }],
  skills: [],
  languages: [{ code: 'fr', level: 'C2', evidenceStatus: 'declared' }, { code: 'en', level: 'B2', evidenceStatus: 'evidenced' }],
  certifications: [], preferences: null, verifications: [], documents: [],
};

const opportunity: CareerOpportunity = {
  id: 'online', title: 'Online Volunteer', organization: 'United Nations Volunteers', kind: 'ONLINE_VOLUNTEERING',
  countryCode: null, remote: true, sourceUrl: 'https://www.unv.org/become-online-volunteer', sourceAuthority: 'OFFICIAL',
  verifiedAt: '2026-08-19T00:00:00.000Z', opensAt: null, closesAt: null,
  eligibilityRules: [{ id: 'age', type: 'MIN_AGE', value: 18, blocking: true }],
  progression: { goalAlignment: 70, evidenceGain: 80, skillGain: 70, futureEligibilityUnlock: 60, networkExposure: 80, immediateFit: 75 },
  burden: { estimatedHours: null, directCostUsd: 0 },
};

class Repo implements CandidateRepository {
  async loadContext(candidateId: string) {
    assert.equal(candidateId, 'candidate-1');
    return structuredClone(context);
  }
}

test('profile builder never treats home country as nationality', () => {
  const profile = buildCandidateEligibilityProfile(context);
  assert.deepEqual(profile.nationalities, []);
  assert.equal(profile.residenceCountryCode, 'ML');
  assert.equal(profile.yearsExperience, 8);
  assert.deepEqual(profile.languageCodes.sort(), ['en', 'fr']);
});

test('service returns ranked actions without application or AI dependencies', async () => {
  const service = new CareerPathwayService({ candidateRepository: new Repo(), opportunities: [opportunity] });
  const result = await service.rankForCandidate('candidate-1', 'Programme Officer', new Date('2026-08-19T00:00:00.000Z'));
  assert.equal(result.goal.title, 'Programme Officer');
  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0].eligibility.status, 'REVIEW_REQUIRED');
  assert.deepEqual(result.actions[0].missingData, ['age']);
});