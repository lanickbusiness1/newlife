export type OpportunityKind =
  | 'JOB'
  | 'INTERNSHIP'
  | 'VOLUNTEERING'
  | 'ONLINE_VOLUNTEERING'
  | 'FELLOWSHIP'
  | 'YOUNG_PROFESSIONAL_PROGRAM'
  | 'JPO'
  | 'GRADUATE_PROGRAM'
  | 'TRAINEESHIP'
  | 'CONSULTANCY'
  | 'TALENT_POOL'
  | 'ROSTER'
  | 'SCHOLARSHIP'
  | 'CERTIFICATION'
  | 'MENTORSHIP';

export type EducationLevel = 'SECONDARY' | 'BACHELOR' | 'MASTER' | 'PHD';

export type EligibilityRule =
  | { id: string; type: 'MIN_AGE' | 'MAX_AGE'; value: number; blocking: boolean }
  | { id: string; type: 'NATIONALITY_IN' | 'RESIDENCE_IN' | 'LANGUAGE_IN'; value: string[]; blocking: boolean }
  | { id: string; type: 'MIN_EDUCATION'; value: EducationLevel; blocking: boolean }
  | { id: string; type: 'MIN_EXPERIENCE_YEARS'; value: number; blocking: boolean }
  | { id: string; type: 'MANUAL_REVIEW'; value: string; blocking: boolean };

export interface CandidateEligibilityProfile {
  candidateId: string;
  age: number | null;
  nationalities: string[];
  residenceCountryCode: string | null;
  highestEducationLevel: EducationLevel | null;
  yearsExperience: number | null;
  languageCodes: string[];
}

export interface OpportunityProgressionSignals {
  goalAlignment: number;
  evidenceGain: number;
  skillGain: number;
  futureEligibilityUnlock: number;
  networkExposure: number;
  immediateFit: number;
}

export interface OpportunityBurden {
  estimatedHours: number | null;
  directCostUsd: number | null;
}

export interface CareerOpportunity {
  id: string;
  title: string;
  organization: string;
  kind: OpportunityKind;
  countryCode: string | null;
  remote: boolean;
  sourceUrl: string;
  sourceAuthority: 'OFFICIAL';
  verifiedAt: string;
  opensAt: string | null;
  closesAt: string | null;
  eligibilityRules: EligibilityRule[];
  progression: OpportunityProgressionSignals;
  burden: OpportunityBurden;
}

export type EligibilityStatus = 'ELIGIBLE' | 'INELIGIBLE' | 'REVIEW_REQUIRED';

export interface EligibilityResult {
  status: EligibilityStatus;
  failedRuleIds: string[];
  reviewRuleIds: string[];
  missingData: string[];
  sourceFresh: boolean;
}