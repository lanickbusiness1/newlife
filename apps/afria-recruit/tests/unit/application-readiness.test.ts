import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreApplicationReadiness, type ApplicationReadinessInput } from '../../lib/domain/cv-diagnostic.js';
import type { CandidateContext } from '../../lib/repositories/candidate-context.js';
import type { JobSpec } from '../../lib/domain/types.js';

function syntheticContext(): CandidateContext {
  return {
    candidate: {
      id: 'candidate-1',
      userId: 'user-1',
      publicCode: 'AFR-001',
      professionalTitle: 'Responsable conformité',
      summary: 'Pilotage conformité et opérations régionales.',
      currentCountry: 'SN',
      homeCountry: 'BJ',
      yearsExperience: 8,
      verificationStatus: 'verified',
    },
    experiences: [{
      id: 'exp-1',
      organization: 'Organisation A',
      title: 'Responsable conformité',
      country: 'SN',
      startDate: '2020-01-01',
      endDate: null,
      isCurrent: true,
      description: 'Pilotage de dispositifs de conformité et coordination régionale.',
      evidenceStatus: 'verified',
      sourceDocumentId: 'doc-1',
    }],
    educations: [],
    skills: [{
      skillId: 'skill-compliance',
      name: 'Conformité',
      proficiency: 'advanced',
      yearsExperience: 6,
      lastUsedYear: 2026,
      evidenceStatus: 'evidenced',
    }],
    languages: [{ code: 'en', level: 'C1', evidenceStatus: 'verified' }],
    certifications: [],
    preferences: null,
    verifications: [],
    documents: [{
      id: 'doc-1',
      documentType: 'cv',
      mimeType: 'application/pdf',
      parsingStatus: 'parsed',
      parsedClaimStatus: 'reviewed',
      uploadedAt: '2026-08-21T08:00:00Z',
      synthetic: true,
    }],
  };
}

const targetJob: JobSpec = {
  id: 'job-1',
  title: 'Regional Compliance Lead',
  countryCode: 'SN',
  requirements: [
    { id: 'req-compliance', kind: 'skill', label: 'Conformité', required: true, skillId: 'skill-compliance', minimumYears: 5 },
    { id: 'req-en', kind: 'language', label: 'Anglais C1', required: true, languageCode: 'en', minimumLevel: 'C1' },
  ],
};

function completeInput(): ApplicationReadinessInput {
  return {
    context: syntheticContext(),
    jobSpec: targetJob,
    technical: {
      parserReadable: true,
      standardSections: true,
      singleColumn: true,
      noImageOnlyText: true,
      safeFileFormat: true,
    },
    semanticSignals: [{ id: 'sem-1', label: 'Pilotage conformité régionale', matched: true, evidenceRefs: ['experience:exp-1'] }],
    institutionSignals: [{ id: 'inst-1', label: 'Langage institutionnel attendu', matched: true, evidenceRefs: ['experience:exp-1'] }],
  };
}

test('a fully supported application scores the canonical 100 points', () => {
  const result = scoreApplicationReadiness(completeInput());

  assert.deepEqual(result.dimensions, {
    atsTechnical: 20,
    jobMatch: 30,
    semanticFit: 20,
    evidence: 15,
    institutionFit: 15,
  });
  assert.equal(result.total, 100);
  assert.deepEqual(result.gaps, []);
});

test('readiness gaps stay explicit and never invent missing evidence', () => {
  const input = completeInput();
  input.context.skills = [];
  input.technical.parserReadable = false;
  input.semanticSignals = [{ id: 'sem-1', label: 'Pilotage conformité régionale', matched: true, evidenceRefs: [] }];
  input.institutionSignals = [{ id: 'inst-1', label: 'Langage institutionnel attendu', matched: false, evidenceRefs: [] }];

  const result = scoreApplicationReadiness(input);

  assert.deepEqual(result.dimensions, {
    atsTechnical: 12,
    jobMatch: 15,
    semanticFit: 0,
    evidence: 15,
    institutionFit: 0,
  });
  assert.equal(result.total, 42);
  assert.deepEqual(result.gaps.map((gap) => gap.code), [
    'ATS_PARSER_UNREADABLE',
    'JOB_REQUIREMENT_GAP:req-compliance',
    'SEMANTIC_EVIDENCE_MISSING:sem-1',
    'INSTITUTION_CRITERION_GAP:inst-1',
  ]);
  assert.deepEqual(result.gaps.find((gap) => gap.code === 'JOB_REQUIREMENT_GAP:req-compliance')?.evidenceRefs, []);
  assert.deepEqual(result.gaps.find((gap) => gap.code === 'SEMANTIC_EVIDENCE_MISSING:sem-1')?.evidenceRefs, []);
});

test('canonical score refuses incomplete semantic or institution signal sets', () => {
  const noSemantic = completeInput();
  noSemantic.semanticSignals = [];
  assert.throws(() => scoreApplicationReadiness(noSemantic), /semantic signals/i);

  const noInstitution = completeInput();
  noInstitution.institutionSignals = [];
  assert.throws(() => scoreApplicationReadiness(noInstitution), /institution signals/i);
});
