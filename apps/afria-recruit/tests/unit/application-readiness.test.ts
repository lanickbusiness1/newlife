import test from 'node:test';
import assert from 'node:assert/strict';
import type { CandidateContext } from '../../lib/repositories/candidate-context.js';
import type { JobSpec } from '../../lib/domain/types.js';

type ReadinessInput = {
  context: CandidateContext;
  jobSpec: JobSpec;
  technical: {
    parserReadable: boolean;
    standardSections: boolean;
    singleColumn: boolean;
    noImageOnlyText: boolean;
    safeFileFormat: boolean;
  };
  semanticSignals: Array<{ id: string; label: string; matched: boolean; evidenceRefs: string[] }>;
  institutionSignals: Array<{ id: string; label: string; matched: boolean; evidenceRefs: string[] }>;
};

type ReadinessResult = {
  total: number;
  dimensions: {
    atsTechnical: number;
    jobMatch: number;
    semanticFit: number;
    evidence: number;
    institutionFit: number;
  };
};

type ScoreApplicationReadiness = (input: ReadinessInput) => ReadinessResult;

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

async function loadScorer(): Promise<ScoreApplicationReadiness> {
  const module = await import('../../lib/domain/cv-diagnostic.js');
  const scorer = (module as unknown as Record<string, unknown>).scoreApplicationReadiness;
  assert.equal(typeof scorer, 'function');
  return scorer as ScoreApplicationReadiness;
}

test('cv diagnostic exposes the canonical application readiness scorer', async () => {
  await loadScorer();
});

test('a fully supported application scores the canonical 100 points', async () => {
  const scorer = await loadScorer();
  const result = scorer({
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
  });

  assert.deepEqual(result.dimensions, {
    atsTechnical: 20,
    jobMatch: 30,
    semanticFit: 20,
    evidence: 15,
    institutionFit: 15,
  });
  assert.equal(result.total, 100);
});
