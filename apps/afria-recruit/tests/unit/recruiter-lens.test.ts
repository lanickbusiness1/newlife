import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecruiterLens } from '../../lib/domain/recruiter-lens.js';
import type { JobSpec, RequirementCoverage } from '../../lib/domain/types.js';

const job: JobSpec = {
  id: 'job-1',
  title: 'Finance Manager',
  countryCode: 'SN',
  requirements: [
    {
      id: 'finance',
      kind: 'skill',
      label: 'Conformité financière',
      required: true,
      skillId: 'finance',
      minimumYears: 2,
      calibration: { blocking: true, priority: 'BLOCKING', minimumEvidence: 'EVIDENCED' },
    },
    {
      id: 'english',
      kind: 'language',
      label: 'Anglais B2',
      required: false,
      languageCode: 'en',
      minimumLevel: 'B2',
      calibration: { blocking: false, priority: 'MEDIUM', minimumEvidence: 'DECLARED' },
    },
  ],
};

const coverage: RequirementCoverage[] = [
  {
    requirementId: 'finance',
    requirement: 'Conformité financière',
    coverage: 'GAP',
    evidenceRefs: [],
    explanation: 'Aucune preuve.',
  },
  {
    requirementId: 'english',
    requirement: 'Anglais B2',
    coverage: 'PARTIAL',
    evidenceRefs: ['language:en'],
    explanation: 'Déclaratif.',
  },
];

test('recruiter lens never promotes GAP and marks blocking requirement', () => {
  const lens = buildRecruiterLens(job, coverage);
  const finance = lens.find((item) => item.requirementId === 'finance');
  assert.equal(finance?.coverage, 'GAP');
  assert.equal(finance?.priority, 'BLOCKING');
  assert.deepEqual(finance?.evidenceRefs, []);
  assert.ok(finance?.doNotClaim.includes('Conformité financière'));
});

test('partial or gap requirement receives bounded proof recommendation', () => {
  const lens = buildRecruiterLens(job, coverage);
  assert.equal(lens.find((item) => item.requirementId === 'finance')?.proofChallenge?.type, 'WORK_SAMPLE');
  assert.equal(lens.find((item) => item.requirementId === 'english')?.proofChallenge?.type, 'STRUCTURED_QUESTION');
});
