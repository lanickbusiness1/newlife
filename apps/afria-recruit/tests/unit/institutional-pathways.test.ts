import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluatePathwayEligibility,
  rankInstitutionalPathways,
  recommendInstitutionalPathway,
  type CandidateEligibilityProfile,
  type InstitutionalPathway,
} from '../../lib/domain/institutional-pathways.js';

const basePathway: InstitutionalPathway = {
  id: 'UN-YPP-2026',
  institution: 'United Nations Secretariat',
  title: 'Young Professionals Programme',
  programType: 'YOUNG_PROFESSIONAL_PROGRAM',
  sourceRef: 'https://careers.un.org/ypp',
  sourceVerifiedAt: '2026-09-04T00:00:00Z',
  state: 'VERIFIED_OPEN',
  hardRules: [],
};

const eligibleProfile: CandidateEligibilityProfile = {
  nationalityCodes: ['BJ'],
  age: 29,
  highestEducationLevel: 'master',
  yearsExperience: 4,
  languageCodes: ['fr', 'en'],
  sponsorCountryCode: 'BJ',
  participatingCountryCodes: ['BJ', 'ML', 'GN'],
  monthsSinceGraduation: 24,
  residenceCountryCode: 'BJ',
  availableDocumentCodes: ['passport', 'degree'],
};

test('high fit never overrides a failed nationality hard rule', () => {
  const pathway: InstitutionalPathway = {
    ...basePathway,
    hardRules: [{
      id: 'nationality',
      kind: 'nationality',
      label: 'Nationality must be from a participating country',
      sourceRef: basePathway.sourceRef,
      allowedCodes: ['ML', 'GN'],
    }],
  };

  const result = recommendInstitutionalPathway(pathway, eligibleProfile, 95);
  assert.equal(result.eligibility.status, 'INELIGIBLE');
  assert.equal(result.recommendation, 'SKIP');
  assert.equal(result.fitScore, 95);
});

test('missing sponsor fact returns review required', () => {
  const pathway: InstitutionalPathway = {
    ...basePathway,
    state: 'SPONSOR_DEPENDENT',
    hardRules: [{
      id: 'sponsor',
      kind: 'sponsor',
      label: 'Sponsor country must be confirmed',
      sourceRef: basePathway.sourceRef,
      allowedCodes: ['FR', 'BE'],
    }],
  };
  const profile = { ...eligibleProfile, sponsorCountryCode: undefined };
  const eligibility = evaluatePathwayEligibility(pathway, profile);
  assert.equal(eligibility.status, 'REVIEW_REQUIRED');
  assert.equal(eligibility.rules[0]?.status, 'REVIEW_REQUIRED');
  assert.equal(recommendInstitutionalPathway(pathway, profile, 88).recommendation, 'PREPARE');
});

test('closed programme is skipped even when candidate is eligible', () => {
  const pathway: InstitutionalPathway = { ...basePathway, state: 'CLOSED' };
  const result = recommendInstitutionalPathway(pathway, eligibleProfile, 91);
  assert.equal(result.eligibility.status, 'ELIGIBLE');
  assert.equal(result.recommendation, 'SKIP');
});

test('verified open programme with satisfied rules is apply', () => {
  const pathway: InstitutionalPathway = {
    ...basePathway,
    hardRules: [
      {
        id: 'age',
        kind: 'age',
        label: 'Maximum age 32',
        sourceRef: basePathway.sourceRef,
        maximum: 32,
      },
      {
        id: 'education',
        kind: 'education',
        label: 'Bachelor or above',
        sourceRef: basePathway.sourceRef,
        minimumEducationLevel: 'bachelor',
      },
      {
        id: 'language',
        kind: 'language',
        label: 'English or French required',
        sourceRef: basePathway.sourceRef,
        allowedCodes: ['en', 'fr'],
      },
    ],
  };

  const result = recommendInstitutionalPathway(pathway, eligibleProfile, 76);
  assert.equal(result.eligibility.status, 'ELIGIBLE');
  assert.equal(result.recommendation, 'APPLY');
});

test('missing country participation evidence never defaults to eligible', () => {
  const pathway: InstitutionalPathway = {
    ...basePathway,
    state: 'COUNTRY_DEPENDENT',
    hardRules: [{
      id: 'country-participation',
      kind: 'country_participation',
      label: 'Country must participate in the current cycle',
      sourceRef: basePathway.sourceRef,
      requiredCode: 'BJ',
    }],
  };
  const profile = { ...eligibleProfile, participatingCountryCodes: undefined };
  const result = evaluatePathwayEligibility(pathway, profile);
  assert.equal(result.status, 'REVIEW_REQUIRED');
});

test('ladder ranks apply before prepare and skip regardless of higher ineligible fit', () => {
  const apply = recommendInstitutionalPathway(basePathway, eligibleProfile, 70);
  const prepare = recommendInstitutionalPathway(
    { ...basePathway, id: 'UN-JPO', state: 'SPONSOR_DEPENDENT' },
    eligibleProfile,
    90,
  );
  const skip = recommendInstitutionalPathway(
    {
      ...basePathway,
      id: 'UN-YPP-BLOCKED',
      hardRules: [{
        id: 'nationality',
        kind: 'nationality',
        label: 'Different participating countries',
        sourceRef: basePathway.sourceRef,
        allowedCodes: ['ET'],
      }],
    },
    eligibleProfile,
    99,
  );

  assert.deepEqual(
    rankInstitutionalPathways([skip, prepare, apply]).map((row) => row.pathwayId),
    ['UN-YPP-2026', 'UN-JPO', 'UN-YPP-BLOCKED'],
  );
});
