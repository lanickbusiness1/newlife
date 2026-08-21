import type { CandidateContext } from '../repositories/candidate-context.js';
import { normalizeEvidenceLevel } from './evidence.js';
import { classifyRequirementCoverage } from './gap-matching.js';
import type { JobSpec, RequirementCoverage } from './types.js';

export interface ApplicationReadinessTechnicalSignals {
  parserReadable: boolean;
  standardSections: boolean;
  singleColumn: boolean;
  noImageOnlyText: boolean;
  safeFileFormat: boolean;
}

export interface ApplicationReadinessEvidenceSignal {
  id: string;
  label: string;
  matched: boolean;
  evidenceRefs: string[];
}

export interface ApplicationReadinessInput {
  context: CandidateContext;
  jobSpec: JobSpec;
  technical: ApplicationReadinessTechnicalSignals;
  semanticSignals: ApplicationReadinessEvidenceSignal[];
  institutionSignals: ApplicationReadinessEvidenceSignal[];
}

export interface ApplicationReadinessDimensions {
  atsTechnical: number;
  jobMatch: number;
  semanticFit: number;
  evidence: number;
  institutionFit: number;
}

export interface ApplicationReadinessResult {
  total: number;
  dimensions: ApplicationReadinessDimensions;
}

const COVERAGE_RATIO: Record<RequirementCoverage['coverage'], number> = {
  COVERED: 1,
  PARTIAL: 0.5,
  GAP: 0,
  NOT_APPLICABLE: 0,
};

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function scoreAtsTechnical(technical: ApplicationReadinessTechnicalSignals): number {
  return (technical.parserReadable ? 8 : 0)
    + (technical.standardSections ? 4 : 0)
    + (technical.singleColumn ? 3 : 0)
    + (technical.noImageOnlyText ? 3 : 0)
    + (technical.safeFileFormat ? 2 : 0);
}

function scoreJobMatch(context: CandidateContext, jobSpec: JobSpec): number {
  const coverage = classifyRequirementCoverage(context, jobSpec);
  if (!coverage.length) return 0;

  let earned = 0;
  let available = 0;

  coverage.forEach((row, index) => {
    const requirement = jobSpec.requirements[index];
    const weight = requirement?.required ? 2 : 1;
    available += weight;
    earned += weight * COVERAGE_RATIO[row.coverage];
  });

  return available ? roundOne((earned / available) * 30) : 0;
}

function scoreEvidenceBackedSignals(signals: ApplicationReadinessEvidenceSignal[], maximum: number): number {
  if (!signals.length) return 0;
  const supported = signals.filter((signal) => signal.matched && signal.evidenceRefs.length > 0).length;
  return roundOne((supported / signals.length) * maximum);
}

function scoreCandidateEvidence(context: CandidateContext): number {
  const evidenceStatuses = [
    ...context.experiences.map((fact) => fact.evidenceStatus),
    ...context.educations.map((fact) => fact.evidenceStatus),
    ...context.skills.map((fact) => fact.evidenceStatus),
    ...context.languages.map((fact) => fact.evidenceStatus),
    ...context.certifications.map((fact) => fact.evidenceStatus),
  ];

  if (!evidenceStatuses.length) return 0;
  const substantiated = evidenceStatuses.filter((status) => normalizeEvidenceLevel(status) !== 'DECLARED').length;
  return roundOne((substantiated / evidenceStatuses.length) * 15);
}

export function scoreApplicationReadiness(input: ApplicationReadinessInput): ApplicationReadinessResult {
  const dimensions: ApplicationReadinessDimensions = {
    atsTechnical: scoreAtsTechnical(input.technical),
    jobMatch: scoreJobMatch(input.context, input.jobSpec),
    semanticFit: scoreEvidenceBackedSignals(input.semanticSignals, 20),
    evidence: scoreCandidateEvidence(input.context),
    institutionFit: scoreEvidenceBackedSignals(input.institutionSignals, 15),
  };

  return {
    total: roundOne(
      dimensions.atsTechnical
      + dimensions.jobMatch
      + dimensions.semanticFit
      + dimensions.evidence
      + dimensions.institutionFit,
    ),
    dimensions,
  };
}
