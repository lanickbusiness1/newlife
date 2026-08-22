import type { CandidateContext, CandidateRepository } from './candidate-context.js';

export const SYNTHETIC_CANDIDATE_ID = '00000000-0000-4000-8000-000000000101';

const fixture: CandidateContext = {
  candidate: {
    id: SYNTHETIC_CANDIDATE_ID,
    userId: '00000000-0000-4000-8000-000000000001',
    publicCode: 'SYNTH-CAND-001',
    professionalTitle: 'Responsable opérations humanitaires',
    summary: 'Profil synthétique utilisé uniquement pour les tests Candidate OS.',
    currentCountry: 'ML',
    homeCountry: 'BJ',
    yearsExperience: 8,
    verificationStatus: 'partial',
  },
  experiences: [
    {
      id: 'exp-synth-1',
      organization: 'Organisation Exemple Sahel',
      title: 'Responsable opérations',
      country: 'ML',
      startDate: '2021-01-01',
      endDate: null,
      isCurrent: true,
      description: 'Coordination d’équipes et de programmes multisectoriels.',
      evidenceStatus: 'declared',
      sourceDocumentId: 'doc-synth-1',
    },
  ],
  educations: [
    {
      id: 'edu-synth-1',
      institution: 'Institut Exemple Afrique',
      qualification: 'Master gestion de projets',
      fieldOfStudy: 'Gestion de projets',
      country: 'BJ',
      startDate: '2014-09-01',
      completionDate: '2016-06-30',
      evidenceStatus: 'evidenced',
      sourceDocumentId: 'doc-synth-1',
    },
  ],
  skills: [
    { skillId: 'skill-project', name: 'Gestion de projets', proficiency: 'advanced', yearsExperience: 8, lastUsedYear: 2026, evidenceStatus: 'evidenced' },
    { skillId: 'skill-logistics', name: 'Logistique humanitaire', proficiency: 'advanced', yearsExperience: 6, lastUsedYear: 2026, evidenceStatus: 'declared' },
  ],
  languages: [
    { code: 'fr', level: 'C2', evidenceStatus: 'declared' },
    { code: 'en', level: 'B2', evidenceStatus: 'evidenced' },
  ],
  certifications: [
    { id: 'cert-synth-1', name: 'Sécurité terrain — exercice synthétique', issuer: 'Centre Exemple', issuedAt: '2025-03-01', expiresAt: null, evidenceStatus: 'evidenced', sourceDocumentId: 'doc-synth-1' },
  ],
  preferences: {
    availableFrom: '2026-09-01',
    contractTypes: ['fixed_term'],
    preferredCountries: ['ML', 'BJ', 'SN'],
    preferredWorkModes: ['onsite', 'hybrid'],
    willingToRelocate: true,
    willingFieldRotation: true,
    workAuthorizationSummary: 'À confirmer selon le pays cible.',
  },
  verifications: [],
  documents: [
    {
      id: 'doc-synth-1',
      documentType: 'cv',
      mimeType: 'application/pdf',
      parsingStatus: 'parsed',
      parsedClaimStatus: 'declared',
      uploadedAt: '2026-08-01T00:00:00Z',
      synthetic: true,
      atsProfile: {
        parserReadable: true,
        standardSections: true,
        singleColumn: true,
        noImageOnlyText: true,
        safeFileFormat: true,
        evidenceRefs: ['document:doc-synth-1:ats-profile'],
      },
    },
  ],
};

export class FixtureCandidateRepository implements CandidateRepository {
  async loadContext(candidateId: string): Promise<CandidateContext> {
    if (candidateId !== SYNTHETIC_CANDIDATE_ID) throw new Error('Candidate not found');
    return structuredClone(fixture);
  }
}
