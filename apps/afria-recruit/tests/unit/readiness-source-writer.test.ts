import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachCandidateAtsReadiness,
  attachJobReadiness,
} from '../../lib/repositories/readiness-source-writer.js';
import {
  parseCandidateAtsProfile,
  parseJobReadinessCriteria,
} from '../../lib/repositories/readiness-source-parser.js';
import type { Json } from '../../lib/supabase/database.types.js';

const candidateProfile = {
  parserReadable: true,
  standardSections: true,
  singleColumn: true,
  noImageOnlyText: true,
  safeFileFormat: true,
  evidenceRefs: ['document:cv-1:parser-proof', 'document:cv-1:layout-proof'],
};

const jobCriteria = {
  semanticCriteria: [{
    id: 'sem-1',
    label: 'Pilotage régional',
    anchors: ['pilotage', 'régional'],
    sourceRef: 'source:job-1:semantic:1',
  }],
  institutionCriteria: [{
    id: 'inst-1',
    label: 'Expérience institutionnelle',
    anchors: ['institutionnelle'],
    sourceRef: 'source:job-1:institution:1',
  }],
};

test('candidate producer preserves parsed payload and round-trips through the canonical reader', () => {
  const source: Json = {
    parser: { vendor: 'internal-v1', pages: 2 },
    claims: [{ kind: 'skill', value: 'Gestion de projets' }],
  };
  const before = structuredClone(source);

  const output = attachCandidateAtsReadiness(source, candidateProfile);

  assert.deepEqual(source, before, 'writer must not mutate producer input');
  assert.deepEqual((output as Record<string, Json>).parser, { vendor: 'internal-v1', pages: 2 });
  assert.deepEqual(parseCandidateAtsProfile(output), candidateProfile);
});

test('candidate producer preserves unrelated readiness metadata', () => {
  const output = attachCandidateAtsReadiness({
    afria_readiness: { producer: 'cv-parser', trace_id: 'trace-1' },
  }, candidateProfile) as Record<string, Json>;

  assert.deepEqual(output.afria_readiness, {
    producer: 'cv-parser',
    trace_id: 'trace-1',
    schema_version: 'candidate-ats-profile-v1',
    ats_profile: {
      parser_readable: true,
      standard_sections: true,
      single_column: true,
      no_image_only_text: true,
      safe_file_format: true,
      evidence_refs: ['document:cv-1:parser-proof', 'document:cv-1:layout-proof'],
    },
  });
});

test('candidate producer fails closed when evidence provenance is empty', () => {
  assert.throws(
    () => attachCandidateAtsReadiness({}, { ...candidateProfile, evidenceRefs: [] }),
    /evidence refs/i,
  );
});

test('job producer preserves raw source payload and round-trips sourced criteria', () => {
  const source: Json = {
    source_url: 'https://example.org/jobs/1',
    source_snapshot_hash: 'sha256:abc',
    raw_description: 'Pilotage régional et coordination institutionnelle.',
  };
  const before = structuredClone(source);

  const output = attachJobReadiness(source, jobCriteria);

  assert.deepEqual(source, before, 'writer must not mutate producer input');
  assert.equal((output as Record<string, Json>).source_snapshot_hash, 'sha256:abc');
  assert.deepEqual(parseJobReadinessCriteria(output), jobCriteria);
});

test('job producer preserves unrelated readiness metadata', () => {
  const output = attachJobReadiness({
    afria_readiness: { producer: 'opportunity-intelligence', trace_id: 'trace-2' },
  }, jobCriteria) as Record<string, Json>;

  const namespace = output.afria_readiness as Record<string, Json>;
  assert.equal(namespace.producer, 'opportunity-intelligence');
  assert.equal(namespace.trace_id, 'trace-2');
  assert.equal(namespace.schema_version, 'job-readiness-v1');
});

test('job producer rejects unsourced, empty, or incomplete criteria', () => {
  assert.throws(
    () => attachJobReadiness({}, {
      ...jobCriteria,
      semanticCriteria: [{ ...jobCriteria.semanticCriteria[0], sourceRef: '' }],
    }),
    /source ref/i,
  );

  assert.throws(
    () => attachJobReadiness({}, { ...jobCriteria, institutionCriteria: [] }),
    /institution criteria/i,
  );
});

test('writers refuse non-object source payloads rather than destroying upstream data', () => {
  assert.throws(() => attachCandidateAtsReadiness(['legacy'] as Json, candidateProfile), /object payload/i);
  assert.throws(() => attachJobReadiness('legacy' as Json, jobCriteria), /object payload/i);
});
