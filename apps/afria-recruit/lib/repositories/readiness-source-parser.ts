import type { JobReadinessCriterion } from '../domain/types.js';
import type { Json } from '../supabase/database.types.js';
import type { CandidateDocumentAtsProfile } from './candidate-context.js';

interface JobReadinessCriteria {
  semanticCriteria?: JobReadinessCriterion[];
  institutionCriteria?: JobReadinessCriterion[];
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function evidenceRefs(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const refs = value.map(nonEmptyString);
  if (refs.some((item) => item === null)) return null;
  return [...new Set(refs as string[])];
}

function booleanField(source: Record<string, unknown>, key: string): boolean | null {
  return typeof source[key] === 'boolean' ? source[key] as boolean : null;
}

function readinessNamespace(value: Json): Record<string, unknown> | null {
  const root = record(value);
  if (!root) return null;
  return record(root.afria_readiness);
}

export function parseCandidateAtsProfile(parsedData: Json): CandidateDocumentAtsProfile | undefined {
  const namespace = readinessNamespace(parsedData);
  if (!namespace || namespace.schema_version !== 'candidate-ats-profile-v1') return undefined;
  const profile = record(namespace.ats_profile);
  if (!profile) return undefined;

  const parserReadable = booleanField(profile, 'parser_readable');
  const standardSections = booleanField(profile, 'standard_sections');
  const singleColumn = booleanField(profile, 'single_column');
  const noImageOnlyText = booleanField(profile, 'no_image_only_text');
  const safeFileFormat = booleanField(profile, 'safe_file_format');
  const refs = evidenceRefs(profile.evidence_refs);
  if (
    parserReadable === null
    || standardSections === null
    || singleColumn === null
    || noImageOnlyText === null
    || safeFileFormat === null
    || !refs
  ) return undefined;

  return {
    parserReadable,
    standardSections,
    singleColumn,
    noImageOnlyText,
    safeFileFormat,
    evidenceRefs: refs,
  };
}

function parseCriterion(value: unknown): JobReadinessCriterion | null {
  const source = record(value);
  if (!source) return null;
  const id = nonEmptyString(source.id);
  const label = nonEmptyString(source.label);
  const sourceRef = nonEmptyString(source.source_ref);
  if (!id || !label || !sourceRef || !Array.isArray(source.anchors) || source.anchors.length === 0) return null;
  const anchors = source.anchors.map(nonEmptyString);
  if (anchors.some((anchor) => anchor === null)) return null;
  return { id, label, sourceRef, anchors: anchors as string[] };
}

function parseCriteria(value: unknown): JobReadinessCriterion[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const parsed = value.map(parseCriterion);
  if (parsed.some((criterion) => criterion === null)) return null;
  return parsed as JobReadinessCriterion[];
}

export function parseJobReadinessCriteria(rawPayload: Json): JobReadinessCriteria {
  const namespace = readinessNamespace(rawPayload);
  if (!namespace || namespace.schema_version !== 'job-readiness-v1') return {};
  const semanticCriteria = parseCriteria(namespace.semantic_criteria);
  const institutionCriteria = parseCriteria(namespace.institution_criteria);
  if (!semanticCriteria || !institutionCriteria) return {};
  return { semanticCriteria, institutionCriteria };
}
