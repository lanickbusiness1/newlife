export type EvidenceStatus = string;

export interface CandidateSummary {
  id: string;
  userId: string;
  publicCode: string;
  professionalTitle: string | null;
  summary: string | null;
  currentCountry: string | null;
  homeCountry: string | null;
  yearsExperience: number | null;
  verificationStatus: string;
}

export interface ExperienceFact {
  id: string;
  organization: string;
  title: string;
  country: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
  evidenceStatus: EvidenceStatus;
  sourceDocumentId: string | null;
}

export interface EducationFact {
  id: string;
  institution: string;
  qualification: string;
  fieldOfStudy: string | null;
  country: string | null;
  startDate: string | null;
  completionDate: string | null;
  evidenceStatus: EvidenceStatus;
  sourceDocumentId: string | null;
}

export interface SkillFact {
  skillId: string;
  name: string | null;
  proficiency: string;
  yearsExperience: number | null;
  lastUsedYear: number | null;
  evidenceStatus: EvidenceStatus;
}

export interface LanguageFact {
  code: string;
  level: string;
  evidenceStatus: EvidenceStatus;
}

export interface CertificationFact {
  id: string;
  name: string;
  issuer: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  evidenceStatus: EvidenceStatus;
  sourceDocumentId: string | null;
}

export interface CandidatePreferences {
  availableFrom: string | null;
  contractTypes: string[];
  preferredCountries: string[];
  preferredWorkModes: string[];
  willingToRelocate: boolean;
  willingFieldRotation: boolean;
  workAuthorizationSummary: string | null;
}

export interface VerificationFact {
  id: string;
  claimType: string;
  claimReference: string | null;
  status: string;
  verifiedAt: string | null;
  expiresAt: string | null;
  hasEvidenceHash: boolean;
}

export interface CandidateDocumentAtsProfile {
  parserReadable: boolean;
  standardSections: boolean;
  singleColumn: boolean;
  noImageOnlyText: boolean;
  safeFileFormat: boolean;
  evidenceRefs: string[];
}

export interface CandidateDocumentSummary {
  id: string;
  documentType: string;
  mimeType: string | null;
  parsingStatus: string;
  parsedClaimStatus: string;
  uploadedAt: string;
  synthetic: boolean;
  atsProfile?: CandidateDocumentAtsProfile;
}

export interface CandidateContext {
  candidate: CandidateSummary;
  experiences: ExperienceFact[];
  educations: EducationFact[];
  skills: SkillFact[];
  languages: LanguageFact[];
  certifications: CertificationFact[];
  preferences: CandidatePreferences | null;
  verifications: VerificationFact[];
  documents: CandidateDocumentSummary[];
}

export interface CandidateRepository {
  loadContext(candidateId: string): Promise<CandidateContext>;
}
