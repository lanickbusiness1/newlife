import type { CandidateContext } from '../repositories/candidate-context.js';
import { normalizeEvidenceLevel } from './evidence.js';
import { classifyRequirementCoverage } from './gap-matching.js';
import type { JobReadinessCriterion, JobSpec, RequirementCoverage } from './types.js';

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
  criterionSourceRef?: string;
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

export interface ApplicationReadinessGap {
  dimension: keyof ApplicationReadinessDimensions;
  code: string;
  label: string;
  action: string;
  evidenceRefs: string[];
}

export interface ApplicationReadinessResult {
  total: number;
  dimensions: ApplicationReadinessDimensions;
  gaps: ApplicationReadinessGap[];
}

interface CandidateEvidenceFact {
  ref: string;
  text: string;
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

function scoreJobMatch(coverage: RequirementCoverage[], jobSpec: JobSpec): number {
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
  const supported = signals.filter((signal) => signal.matched && signal.evidenceRefs.length > 0).length;
  return roundOne((supported / signals.length) * maximum);
}

function evidenceStatuses(context: CandidateContext): string[] {
  return [
    ...context.experiences.map((fact) => fact.evidenceStatus),
    ...context.educations.map((fact) => fact.evidenceStatus),
    ...context.skills.map((fact) => fact.evidenceStatus),
    ...context.languages.map((fact) => fact.evidenceStatus),
    ...context.certifications.map((fact) => fact.evidenceStatus),
  ];
}

function scoreCandidateEvidence(context: CandidateContext): number {
  const statuses = evidenceStatuses(context);
  if (!statuses.length) return 0;
  const substantiated = statuses.filter((status) => normalizeEvidenceLevel(status) !== 'DECLARED').length;
  return roundOne((substantiated / statuses.length) * 15);
}

function technicalGaps(technical: ApplicationReadinessTechnicalSignals): ApplicationReadinessGap[] {
  const gaps: ApplicationReadinessGap[] = [];
  if (!technical.parserReadable) gaps.push({ dimension: 'atsTechnical', code: 'ATS_PARSER_UNREADABLE', label: 'Le CV n’est pas lisible de façon fiable par le parseur ATS.', action: 'Produire une version texte exploitable et vérifier le parsing avant candidature.', evidenceRefs: [] });
  if (!technical.standardSections) gaps.push({ dimension: 'atsTechnical', code: 'ATS_NON_STANDARD_SECTIONS', label: 'Les sections du CV ne suivent pas une structure ATS standard.', action: 'Utiliser des titres de sections explicites et conventionnels.', evidenceRefs: [] });
  if (!technical.singleColumn) gaps.push({ dimension: 'atsTechnical', code: 'ATS_COMPLEX_LAYOUT', label: 'La mise en page peut perturber la lecture séquentielle ATS.', action: 'Générer une variante ATS à lecture linéaire.', evidenceRefs: [] });
  if (!technical.noImageOnlyText) gaps.push({ dimension: 'atsTechnical', code: 'ATS_IMAGE_ONLY_TEXT', label: 'Des informations utiles sont encodées uniquement dans des images.', action: 'Restituer toute information candidate sous forme de texte sélectionnable.', evidenceRefs: [] });
  if (!technical.safeFileFormat) gaps.push({ dimension: 'atsTechnical', code: 'ATS_UNSAFE_FILE_FORMAT', label: 'Le format de fichier n’est pas considéré comme sûr pour le traitement ATS.', action: 'Exporter une version PDF texte ou DOCX validée par le parseur.', evidenceRefs: [] });
  return gaps;
}

function jobGaps(coverage: RequirementCoverage[]): ApplicationReadinessGap[] {
  return coverage.flatMap((row) => {
    if (row.coverage === 'COVERED') return [];
    const suffix = row.coverage === 'PARTIAL' ? 'PARTIAL' : row.coverage === 'NOT_APPLICABLE' ? 'REVIEW_REQUIRED' : 'GAP';
    return [{
      dimension: 'jobMatch' as const,
      code: `JOB_REQUIREMENT_${suffix}:${row.requirementId}`,
      label: `${row.requirement} — ${row.explanation}`,
      action: row.coverage === 'GAP'
        ? 'Ne pas inventer cette exigence : documenter une preuve réelle, combler le gap ou conserver le statut GAP.'
        : 'Renforcer la preuve ou soumettre cette exigence à une revue humaine avant optimisation.',
      evidenceRefs: row.evidenceRefs,
    }];
  });
}

function signalGaps(
  dimension: 'semanticFit' | 'institutionFit',
  signals: ApplicationReadinessEvidenceSignal[],
): ApplicationReadinessGap[] {
  const prefix = dimension === 'semanticFit' ? 'SEMANTIC' : 'INSTITUTION';
  return signals.flatMap((signal) => {
    if (signal.matched && signal.evidenceRefs.length > 0) return [];
    const missingEvidence = signal.matched && signal.evidenceRefs.length === 0;
    return [{
      dimension,
      code: `${prefix}_${missingEvidence ? 'EVIDENCE_MISSING' : 'CRITERION_GAP'}:${signal.id}`,
      label: signal.label,
      action: missingEvidence
        ? 'Rattacher une preuve candidate existante ; sinon retirer le match.'
        : 'Conserver le critère comme gap jusqu’à ce qu’une correspondance réelle et prouvée existe.',
      evidenceRefs: signal.evidenceRefs,
    }];
  });
}

function evidenceGaps(context: CandidateContext): ApplicationReadinessGap[] {
  const declaredCount = evidenceStatuses(context).filter((status) => normalizeEvidenceLevel(status) === 'DECLARED').length;
  if (!declaredCount) return [];
  return [{
    dimension: 'evidence',
    code: 'EVIDENCE_UNSUBSTANTIATED',
    label: `${declaredCount} fait(s) candidat restent déclaratifs.`,
    action: 'Rattacher des documents, références ou validations réelles avant de présenter ces faits comme étayés.',
    evidenceRefs: [],
  }];
}

function assertCompleteCanonicalSignalSets(input: ApplicationReadinessInput): void {
  if (!input.semanticSignals.length) {
    throw new Error('Canonical application readiness score requires semantic signals.');
  }
  if (!input.institutionSignals.length) {
    throw new Error('Canonical application readiness score requires institution signals.');
  }
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function candidateEvidenceFacts(context: CandidateContext): CandidateEvidenceFact[] {
  const facts: CandidateEvidenceFact[] = [];
  const add = (ref: string, status: string, parts: Array<string | number | null | undefined>) => {
    if (normalizeEvidenceLevel(status) === 'DECLARED') return;
    const text = normalizeSearchText(parts.filter((part) => part !== null && part !== undefined).join(' '));
    if (text) facts.push({ ref, text });
  };

  for (const fact of context.experiences) {
    add(`experience:${fact.id}`, fact.evidenceStatus, [fact.title, fact.organization, fact.description, fact.country]);
  }
  for (const fact of context.educations) {
    add(`education:${fact.id}`, fact.evidenceStatus, [fact.qualification, fact.fieldOfStudy, fact.institution, fact.country]);
  }
  for (const fact of context.skills) {
    add(`skill:${fact.skillId}`, fact.evidenceStatus, [fact.name, fact.proficiency, fact.yearsExperience]);
  }
  for (const fact of context.languages) {
    add(`language:${fact.code}`, fact.evidenceStatus, [fact.code, fact.level]);
  }
  for (const fact of context.certifications) {
    add(`certification:${fact.id}`, fact.evidenceStatus, [fact.name, fact.issuer]);
  }

  return facts;
}

function validateCriteria(criteria: JobReadinessCriterion[] | undefined, label: 'semantic' | 'institution'): JobReadinessCriterion[] {
  if (!criteria?.length) throw new Error(`Canonical application readiness score requires sourced ${label} criteria.`);
  for (const criterion of criteria) {
    if (!criterion.id.trim() || !criterion.label.trim() || !criterion.sourceRef.trim() || !criterion.anchors.length) {
      throw new Error(`Canonical application readiness score requires sourced ${label} criteria.`);
    }
    if (criterion.anchors.some((anchor) => !normalizeSearchText(anchor))) {
      throw new Error(`Canonical application readiness score requires sourced ${label} criteria.`);
    }
  }
  return criteria;
}

function buildCriterionSignals(criteria: JobReadinessCriterion[], facts: CandidateEvidenceFact[]): ApplicationReadinessEvidenceSignal[] {
  return criteria.map((criterion) => {
    const anchors = criterion.anchors.map(normalizeSearchText);
    const matchingFacts = facts.filter((fact) => anchors.every((anchor) => fact.text.includes(anchor)));
    return {
      id: criterion.id,
      label: criterion.label,
      matched: matchingFacts.length > 0,
      evidenceRefs: matchingFacts.map((fact) => fact.ref),
      criterionSourceRef: criterion.sourceRef,
    };
  });
}

function canonicalTechnicalSignals(context: CandidateContext): ApplicationReadinessTechnicalSignals {
  const cv = context.documents
    .filter((document) => document.documentType.trim().toLowerCase() === 'cv')
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0];
  if (!cv?.atsProfile || !cv.atsProfile.evidenceRefs.length) {
    throw new Error('Canonical application readiness score requires a proven CV ATS profile.');
  }
  return {
    parserReadable: cv.atsProfile.parserReadable,
    standardSections: cv.atsProfile.standardSections,
    singleColumn: cv.atsProfile.singleColumn,
    noImageOnlyText: cv.atsProfile.noImageOnlyText,
    safeFileFormat: cv.atsProfile.safeFileFormat,
  };
}

export function scoreApplicationReadiness(input: ApplicationReadinessInput): ApplicationReadinessResult {
  assertCompleteCanonicalSignalSets(input);
  const coverage = classifyRequirementCoverage(input.context, input.jobSpec);
  const dimensions: ApplicationReadinessDimensions = {
    atsTechnical: scoreAtsTechnical(input.technical),
    jobMatch: scoreJobMatch(coverage, input.jobSpec),
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
    gaps: [
      ...technicalGaps(input.technical),
      ...jobGaps(coverage),
      ...signalGaps('semanticFit', input.semanticSignals),
      ...evidenceGaps(input.context),
      ...signalGaps('institutionFit', input.institutionSignals),
    ],
  };
}

export function scoreApplicationReadinessFromCanonicalSources(
  context: CandidateContext,
  jobSpec: JobSpec,
): ApplicationReadinessResult {
  const facts = candidateEvidenceFacts(context);
  const semanticCriteria = validateCriteria(jobSpec.semanticCriteria, 'semantic');
  const institutionCriteria = validateCriteria(jobSpec.institutionCriteria, 'institution');
  return scoreApplicationReadiness({
    context,
    jobSpec,
    technical: canonicalTechnicalSignals(context),
    semanticSignals: buildCriterionSignals(semanticCriteria, facts),
    institutionSignals: buildCriterionSignals(institutionCriteria, facts),
  });
}
