export type RequirementKind = 'skill' | 'language' | 'experience' | 'education' | 'other';
export type RequirementPriority = 'BLOCKING' | 'HIGH' | 'MEDIUM';
export type EvidenceExpectation = 'DECLARED' | 'EVIDENCED' | 'VERIFIED';

export interface RequirementCalibration {
  blocking: boolean;
  priority: RequirementPriority;
  minimumEvidence: EvidenceExpectation;
}

export interface JobRequirement {
  id: string;
  kind: RequirementKind;
  label: string;
  required: boolean;
  skillId?: string;
  languageCode?: string;
  minimumYears?: number;
  minimumLevel?: string;
  calibration?: RequirementCalibration;
}

export interface JobSpec {
  id: string;
  title: string;
  countryCode: string | null;
  requirements: JobRequirement[];
}

export interface RequirementCoverage {
  requirementId: string;
  requirement: string;
  coverage: 'COVERED' | 'PARTIAL' | 'GAP' | 'NOT_APPLICABLE';
  evidenceRefs: string[];
  explanation: string;
}

export interface TruthConflict {
  code: string;
  message: string;
  blocking: boolean;
  evidenceRefs: string[];
}

export interface DiagnosticFinding {
  code: string;
  severity: 'info' | 'warning' | 'blocking';
  message: string;
  evidenceRefs: string[];
  blocking: boolean;
}

export interface CanonicalJobInput {
  id: string;
  title: string;
  countryCode?: string | null;
  skills?: Array<{ skillId: string; label: string; required: boolean; minimumYears?: number | null }>;
  languages?: Array<{ languageCode: string; label: string; required: boolean; minimumLevel?: string }>;
}
