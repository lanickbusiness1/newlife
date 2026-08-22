import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCandidateAtsProfile,
  parseJobReadinessCriteria,
} from '../../lib/repositories/readiness-source-parser.js';

test('candidate ATS profile is accepted only from the versioned parsed_data namespace', () => {
  const result = parseCandidateAtsProfile({
    afria_readiness: {
      schema_version: 'candidate-ats-profile-v1',
      ats_profile: {
        parser_readable: true,
        standard_sections: true,
        single_column: true,
        no_image_only_text: true,
        safe_file_format: true,
        evidence_refs: ['document:cv-1:ats-profile'],
      },
    },
  });

  assert.deepEqual(result, {
    parserReadable: true,
    standardSections: true,
    singleColumn: true,
    noImageOnlyText: true,
    safeFileFormat: true,
    evidenceRefs: ['document:cv-1:ats-profile'],
  });
});

test('candidate ATS profile fails closed on missing version or evidence', () => {
  assert.equal(parseCandidateAtsProfile({
    afria_readiness: {
      ats_profile: {
        parser_readable: true,
        standard_sections: true,
        single_column: true,
        no_image_only_text: true,
        safe_file_format: true,
        evidence_refs: ['document:cv-1:ats-profile'],
      },
    },
  }), undefined);

  assert.equal(parseCandidateAtsProfile({
    afria_readiness: {
      schema_version: 'candidate-ats-profile-v1',
      ats_profile: {
        parser_readable: true,
        standard_sections: true,
        single_column: true,
        no_image_only_text: true,
        safe_file_format: true,
        evidence_refs: [],
      },
    },
  }), undefined);
});

test('job readiness criteria are accepted only when each criterion is sourced', () => {
  const result = parseJobReadinessCriteria({
    afria_readiness: {
      schema_version: 'job-readiness-v1',
      semantic_criteria: [{
        id: 'sem-1',
        label: 'Pilotage régional',
        anchors: ['pilotage', 'régional'],
        source_ref: 'source:job-1:semantic:1',
      }],
      institution_criteria: [{
        id: 'inst-1',
        label: 'Expérience institutionnelle',
        anchors: ['institutionnelle'],
        source_ref: 'source:job-1:institution:1',
      }],
    },
  });

  assert.deepEqual(result, {
    semanticCriteria: [{ id: 'sem-1', label: 'Pilotage régional', anchors: ['pilotage', 'régional'], sourceRef: 'source:job-1:semantic:1' }],
    institutionCriteria: [{ id: 'inst-1', label: 'Expérience institutionnelle', anchors: ['institutionnelle'], sourceRef: 'source:job-1:institution:1' }],
  });
});

test('job readiness criteria fail closed on malformed or unsourced payloads', () => {
  assert.deepEqual(parseJobReadinessCriteria({}), {});
  assert.deepEqual(parseJobReadinessCriteria({
    afria_readiness: {
      schema_version: 'job-readiness-v1',
      semantic_criteria: [{ id: 'sem-1', label: 'Pilotage régional', anchors: ['pilotage'], source_ref: '' }],
      institution_criteria: [],
    },
  }), {});
});
