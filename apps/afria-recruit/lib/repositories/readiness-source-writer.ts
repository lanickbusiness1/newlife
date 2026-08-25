import type { JobReadinessCriterion } from '../domain/types.js';
import type { Json } from '../supabase/database.types.js';
import type { CandidateDocumentAtsProfile } from './candidate-context.js';

export interface JobReadinessProducerInput {
  semanticCriteria: JobReadinessCriterion[];
  institutionCriteria: JobReadinessCriterion[];
}

function objectPayload(value: Json): Record<string, Json | undefined> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Readiness producer requires an object payload and refuses destructive replacement.');
  }
  return { ...value };
}

function readinessNamespace(root: Record<string, Json | undefined>): Record<string, Json | undefined> {
  const existing = root.afria_readiness;
  if (existing === undefined) return {};
  if (existing === null || typeof existing !== 'object' || Array.isArray(existing)) {
    throw new Error('Existing afria_readiness value must be an object payload.');
  }
  return { ...existing };
}

function nonEmpty(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error('Readiness producer requires a non-empty value.');
  return normalized;
}

function candidateEvidenceRefs(profile: CandidateDocumentAtsProfile): string[] {
  if (!Array.isArray(profile.evidenceRefs) || profile.evidenceRefs.length === 0) {
    throw new Error('Candidate readiness producer requires non-empty evidence refs.');
  }
  const refs = profile.evidenceRefs.map((ref) => ref.trim());
  if (refs.some((ref) => !ref)) {
    throw new Error('Candidate readiness producer requires non-empty evidence refs.');
  }
  return [...new Set(refs)];
}

function assertCandidateBooleans(profile: CandidateDocumentAtsProfile): void {
  const values = [
    profile.parserReadable,
    profile.standardSections,
    profile.singleColumn,
    profile.noImageOnlyText,
    profile.safeFileFormat,
  ];
  if (values.some((value) => typeof value !== 'boolean')) {
    throw new Error('Candidate readiness producer requires all five ATS boolean signals.');
  }
}

function normalizeCriterion(
  criterion: JobReadinessCriterion,
  group: 'semantic' | 'institution',
): Record<string, Json> {
  const id = criterion.id.trim();
  const label = criterion.label.trim();
  const sourceRef = criterion.sourceRef.trim();
  if (!id) throw new Error(`${group} criterion requires a non-empty id.`);
  if (!label) throw new Error(`${group} criterion requires a non-empty label.`);
  if (!sourceRef) throw new Error(`${group} criterion requires a non-empty source ref.`);
  if (!Array.isArray(criterion.anchors) || criterion.anchors.length === 0) {
    throw new Error(`${group} criterion requires non-empty anchors.`);
  }
  const anchors = criterion.anchors.map((anchor) => anchor.trim());
  if (anchors.some((anchor) => !anchor)) {
    throw new Error(`${group} criterion requires non-empty anchors.`);
  }
  return {
    id,
    label,
    anchors: [...new Set(anchors)],
    source_ref: sourceRef,
  };
}

function normalizeCriteria(
  criteria: JobReadinessCriterion[],
  group: 'semantic' | 'institution',
): Record<string, Json>[] {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    throw new Error(`Job readiness producer requires non-empty ${group} criteria.`);
  }
  return criteria.map((criterion) => normalizeCriterion(criterion, group));
}

export function attachCandidateAtsReadiness(
  parsedData: Json,
  profile: CandidateDocumentAtsProfile,
): Json {
  const root = objectPayload(parsedData);
  const namespace = readinessNamespace(root);
  assertCandidateBooleans(profile);
  const refs = candidateEvidenceRefs(profile);

  return {
    ...root,
    afria_readiness: {
      ...namespace,
      schema_version: 'candidate-ats-profile-v1',
      ats_profile: {
        parser_readable: profile.parserReadable,
        standard_sections: profile.standardSections,
        single_column: profile.singleColumn,
        no_image_only_text: profile.noImageOnlyText,
        safe_file_format: profile.safeFileFormat,
        evidence_refs: refs,
      },
    },
  };
}

export function attachJobReadiness(
  rawPayload: Json,
  input: JobReadinessProducerInput,
): Json {
  const root = objectPayload(rawPayload);
  const namespace = readinessNamespace(root);
  const semanticCriteria = normalizeCriteria(input.semanticCriteria, 'semantic');
  const institutionCriteria = normalizeCriteria(input.institutionCriteria, 'institution');

  return {
    ...root,
    afria_readiness: {
      ...namespace,
      schema_version: 'job-readiness-v1',
      semantic_criteria: semanticCriteria,
      institution_criteria: institutionCriteria,
    },
  };
}
