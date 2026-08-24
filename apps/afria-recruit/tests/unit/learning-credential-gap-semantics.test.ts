import test from 'node:test';
import assert from 'node:assert/strict';
import { type LearningOpportunity } from '../../lib/domain/learning-credential-intelligence.js';
import {
  evaluateLearningPathway,
  type TypedCandidateLearningContext,
} from '../../lib/domain/learning-pathway-eligibility.js';

const disasterReady: LearningOpportunity = {
  id: 'disasterready-procurement-logistics',
  provider: 'Mercy Corps × DisasterReady',
  courseTitle: 'Procurement & Logistics Certificate',
  sourceUrl: 'https://fr.disasterready.org/procurement-logistics-certificate',
  sourceRetrievedAt: '2026-08-24T22:00:00Z',
  countryEligibility: ['*'],
  languages: ['fr', 'en'],
  sectors: ['humanitarian', 'logistics'],
  skills: ['procurement', 'warehouse management', 'inventory', 'fleet management', 'asset management'],
  durationHours: 5,
  learningCost: { amount: 0, currency: 'USD', verified: true },
  assessmentRequired: true,
  assessmentVerified: true,
  credentialAvailable: true,
  credentialCost: { amount: 0, currency: 'USD', verified: true },
  credentialIssuer: 'Mercy Corps × DisasterReady',
  accreditationOrRecognition: 'Humanitarian learning credential',
  credentialExpiry: null,
  evidenceRefs: ['source:disasterready:primary'],
  verificationStatus: 'VERIFIED',
  misleadingClaimScore: 0,
};

test('a course cannot pretend to close a required non-skill eligibility gap', () => {
  const context: TypedCandidateLearningContext = {
    countryCode: 'ML',
    languages: ['fr', 'en'],
    targetSectors: ['humanitarian'],
    skillGaps: [],
    gaps: [
      {
        id: 'gap-cicr-procedures',
        kind: 'procedure',
        label: 'Maîtrise des procédures logistiques du CICR',
        required: true,
        evidenceRefs: ['job:cicr-tombouctou-2026'],
      },
    ],
  };

  const result = evaluateLearningPathway(disasterReady, context);
  assert.equal(result.eligibilityGate, 'FAIL');
  assert.equal(result.recommendationScore, null);
  assert.deepEqual(result.closedSkills, []);
  assert.ok(result.blockingReasons.includes('NO_TARGET_GAP_CLOSURE'));
  assert.ok(result.blockingReasons.includes('OUTSTANDING_REQUIRED_GAP:procedure:gap-cicr-procedures'));
});

test('a useful course stays REVIEW while another required eligibility gap remains open', () => {
  const context: TypedCandidateLearningContext = {
    countryCode: 'ML',
    languages: ['fr', 'en'],
    targetSectors: ['humanitarian'],
    skillGaps: ['procurement'],
    gaps: [
      {
        id: 'gap-procurement',
        kind: 'skill',
        label: 'Procurement',
        skill: 'procurement',
        required: true,
        evidenceRefs: ['job:cicr-tombouctou-2026'],
      },
      {
        id: 'gap-diploma-equivalence',
        kind: 'education',
        label: 'Équivalence du diplôme technique logistique/administration',
        required: true,
        evidenceRefs: ['job:cicr-tombouctou-2026'],
      },
    ],
  };

  const result = evaluateLearningPathway(disasterReady, context);
  assert.equal(result.eligibilityGate, 'REVIEW');
  assert.equal(result.decision, 'REVIEW');
  assert.ok((result.recommendationScore ?? 0) > 0);
  assert.deepEqual(result.closedSkills, ['procurement']);
  assert.ok(result.blockingReasons.includes('OUTSTANDING_REQUIRED_GAP:education:gap-diploma-equivalence'));
});
