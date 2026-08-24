import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyVerifiedCredentialCompletion,
  classifyLearningOpportunity,
  computeEmployabilityDelta,
  evaluateLearningOpportunity,
  normalizeSkillToken,
  rankLearningOpportunities,
  type CandidateLearningContext,
  type CandidateSkillEvidence,
  type LearningOpportunity,
} from '../../lib/domain/learning-credential-intelligence.js';

const maliHumanitarianCandidate: CandidateLearningContext = {
  countryCode: 'ML',
  languages: ['fr'],
  targetSectors: ['humanitarian', 'ngo', 'un'],
  skillGaps: ['procurement', 'warehousing', 'inventory', 'transport', 'fleet', 'asset management'],
};

const disasterReady: LearningOpportunity = {
  id: 'disasterready-procurement-logistics',
  provider: 'Mercy Corps × DisasterReady',
  courseTitle: 'Procurement & Logistics Certificate',
  sourceUrl: 'https://fr.disasterready.org/procurement-logistics-certificate',
  sourceRetrievedAt: '2026-08-24T12:00:00Z',
  countryEligibility: ['*'],
  languages: ['fr', 'en', 'ar', 'es'],
  sectors: ['humanitarian', 'ngo', 'logistics'],
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

const unicefLogistics: LearningOpportunity = {
  id: 'unicef-logistics-at-unicef',
  provider: 'UNICEF Agora',
  courseTitle: 'La logistique à l’UNICEF',
  sourceUrl: 'https://agora.unicef.org/course/info.php?id=23243',
  sourceRetrievedAt: '2026-08-24T12:00:00Z',
  countryEligibility: ['*'],
  languages: ['fr', 'en'],
  sectors: ['humanitarian', 'un', 'logistics'],
  skills: ['warehousing', 'inventory', 'transport'],
  durationHours: 5,
  learningCost: { amount: 0, currency: 'USD', verified: true },
  assessmentRequired: true,
  assessmentVerified: true,
  credentialAvailable: true,
  credentialCost: { amount: 0, currency: 'USD', verified: true },
  credentialIssuer: 'UNICEF',
  accreditationOrRecognition: 'UNICEF Agora certificate',
  credentialExpiry: null,
  evidenceRefs: ['source:unicef-agora:primary'],
  verificationStatus: 'VERIFIED',
  misleadingClaimScore: 0,
};

const unicefColdChain: LearningOpportunity = {
  ...unicefLogistics,
  id: 'unicef-cold-chain',
  courseTitle: 'Cold Chain Logistics & Vaccine Management',
  sectors: ['health', 'vaccination'],
  skills: ['cold chain', 'inventory', 'transport'],
  specialized: true,
};

const kayaRestricted: LearningOpportunity = {
  ...disasterReady,
  id: 'kaya-dhl-restricted',
  provider: 'DHL Academy of Humanitarian Logistics / Kaya',
  courseTitle: 'Dangerous Goods',
  sourceUrl: 'https://kayaconnect.org/enrol/index.php?id=13330',
  countryEligibility: ['JO', 'LB', 'SY', 'YE'],
  languages: ['fr', 'en'],
  skills: ['transport'],
  evidenceRefs: ['source:kaya:primary'],
};

const edxAudit: LearningOpportunity = {
  ...disasterReady,
  id: 'edx-audit-track',
  provider: 'edX',
  courseTitle: 'Supply Chain audit track',
  sourceUrl: 'https://support.edx.org/hc/en-us/articles/1500003964681-What-is-the-audit-track',
  skills: ['supply chain'],
  learningCost: { amount: 0, currency: 'USD', verified: true },
  credentialCost: { amount: 99, currency: 'USD', verified: true },
  credentialIssuer: 'edX partner institution',
  evidenceRefs: ['source:edx:primary'],
  advertisedAsFreeCertification: true,
};

const unverifiedClaim: LearningOpportunity = {
  ...disasterReady,
  id: 'unverified-free-credential',
  provider: 'Unknown Provider',
  courseTitle: 'Free logistics certification',
  evidenceRefs: [],
  verificationStatus: 'PARTIAL',
};

test('AR-LCI-001 distinguishes free credential from free learning with paid credential', () => {
  assert.equal(classifyLearningOpportunity(disasterReady), 'FREE_CERTIFIED');
  assert.equal(classifyLearningOpportunity(unicefLogistics), 'FREE_CERTIFIED');
  assert.equal(classifyLearningOpportunity(edxAudit), 'FREE_LEARNING_PAID_CREDENTIAL');
});

test('restricted free credential is classified without hiding the restriction', () => {
  assert.equal(classifyLearningOpportunity(kayaRestricted), 'FREE_CERTIFIED_RESTRICTED');
  const result = evaluateLearningOpportunity(kayaRestricted, maliHumanitarianCandidate);
  assert.equal(result.eligibilityGate, 'FAIL');
  assert.equal(result.decision, 'REJECTED');
  assert.equal(result.recommendationScore, null);
  assert.ok(result.blockingReasons.some((reason) => reason.includes('COUNTRY_INELIGIBLE')));
});

test('materially unverified credential claims fail closed with no published score', () => {
  const result = evaluateLearningOpportunity(unverifiedClaim, maliHumanitarianCandidate);
  assert.equal(result.classification, 'UNVERIFIED_CREDENTIAL');
  assert.equal(result.eligibilityGate, 'FAIL');
  assert.equal(result.recommendationScore, null);
  assert.ok(result.blockingReasons.some((reason) => reason.includes('EVIDENCE')));
});

test('misleading free-certification claim fails closed when the credential is paid', () => {
  const result = evaluateLearningOpportunity(edxAudit, {
    ...maliHumanitarianCandidate,
    skillGaps: ['supply chain'],
  });
  assert.equal(result.classification, 'FREE_LEARNING_PAID_CREDENTIAL');
  assert.equal(result.eligibilityGate, 'FAIL');
  assert.equal(result.recommendationScore, null);
  assert.ok(result.blockingReasons.some((reason) => reason.includes('MISLEADING_FREE_CERTIFICATION')));
});

test('specialized credentials require target-sector fit', () => {
  assert.equal(classifyLearningOpportunity(unicefColdChain), 'SPECIALIZED_CERTIFIED');

  const rejected = evaluateLearningOpportunity(unicefColdChain, maliHumanitarianCandidate);
  assert.equal(rejected.eligibilityGate, 'FAIL');

  const healthFit = evaluateLearningOpportunity(unicefColdChain, {
    ...maliHumanitarianCandidate,
    targetSectors: ['health', 'vaccination'],
    skillGaps: ['cold chain', 'inventory'],
  });
  assert.equal(healthFit.eligibilityGate, 'PASS');
  assert.ok((healthFit.recommendationScore ?? 0) > 0);
});

test('skill normalization is deterministic and conservative', () => {
  assert.equal(normalizeSkillToken('Fleet Management'), 'fleet');
  assert.equal(normalizeSkillToken('Warehouse Management'), 'warehousing');
  assert.equal(normalizeSkillToken('Entrepôt'), 'entrepot');
  assert.equal(normalizeSkillToken('Procurement'), 'procurement');
});

test('AR-LCI-001 ranking prioritizes the course closing the most verified target gaps', () => {
  const ranked = rankLearningOpportunities([
    unicefLogistics,
    kayaRestricted,
    disasterReady,
    edxAudit,
    unverifiedClaim,
  ], maliHumanitarianCandidate);

  assert.equal(ranked[0].opportunityId, 'disasterready-procurement-logistics');
  assert.equal(ranked[0].decision, 'PRIORITY');
  assert.ok((ranked[0].recommendationScore ?? 0) >= 75);
  assert.deepEqual(
    ranked[0].closedSkills,
    ['procurement', 'warehousing', 'inventory', 'fleet', 'asset management'],
  );
  assert.ok(ranked.find((item) => item.opportunityId === 'kaya-dhl-restricted')?.recommendationScore === null);
});

test('verified credential completion upgrades only taught skills with provenance', () => {
  const existing: CandidateSkillEvidence[] = [
    { skill: 'procurement', evidenceState: 'declared', evidenceRefs: ['candidate:declared:procurement'] },
    { skill: 'leadership', evidenceState: 'employer-validated', evidenceRefs: ['employer:leadership'] },
  ];

  const updated = applyVerifiedCredentialCompletion(existing, disasterReady, {
    verified: true,
    credentialEvidenceRef: 'credential:disasterready:synthetic-proof',
  });

  const procurement = updated.find((item) => item.skill === 'procurement');
  const fleet = updated.find((item) => item.skill === 'fleet');
  const leadership = updated.find((item) => item.skill === 'leadership');

  assert.equal(procurement?.evidenceState, 'credential-evidenced');
  assert.deepEqual(procurement?.evidenceRefs, ['candidate:declared:procurement', 'credential:disasterready:synthetic-proof']);
  assert.equal(fleet?.evidenceState, 'credential-evidenced');
  assert.equal(leadership?.evidenceState, 'employer-validated');
  assert.notEqual(updated, existing);
});

test('credential completion fails closed without verified evidence', () => {
  assert.throws(
    () => applyVerifiedCredentialCompletion([], disasterReady, { verified: false, credentialEvidenceRef: '' }),
    /verified credential completion evidence/i,
  );
});

test('employability delta is explicit and bounded to canonical readiness scale', () => {
  assert.deepEqual(computeEmployabilityDelta(67, 84), { before: 67, after: 84, delta: 17 });
  assert.throws(() => computeEmployabilityDelta(-1, 84), /0\.\.100/);
  assert.throws(() => computeEmployabilityDelta(67, 101), /0\.\.100/);
});
