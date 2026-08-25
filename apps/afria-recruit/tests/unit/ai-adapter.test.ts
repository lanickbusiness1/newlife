import test from 'node:test';
import assert from 'node:assert/strict';
import { FixtureCandidateRepository, SYNTHETIC_CANDIDATE_ID } from '../../lib/repositories/fixture-candidate-repository.js';
import { getCandidateAiAdapter } from '../../lib/ai/index.js';
import { validateRewriteOutput, validateJobAnalysisOutput } from '../../lib/ai/validators.js';
import { buildOpenAIRequest, OpenAICandidateAiAdapter } from '../../lib/ai/openai-adapter.js';
import { buildDecisionInsert } from '../../lib/ai/persist-decision.js';
import type { JobSpec } from '../../lib/domain/types.js';

const job: JobSpec = {
  id: 'job-ai-test',
  title: 'Responsable programmes',
  countryCode: 'SN',
  requirements: [
    { id: 'req-project', kind: 'skill', label: 'Gestion de projets', required: true, skillId: 'skill-project', minimumYears: 5 },
    { id: 'req-finance', kind: 'skill', label: 'Conformité financière', required: true, skillId: 'skill-finance', minimumYears: 2 },
  ],
};

test('missing OpenAI configuration falls back to deterministic adapter', () => {
  const adapter = getCandidateAiAdapter({ AFRIA_RECRUIT_AI_PROVIDER: 'openai' });
  assert.equal(adapter.providerName, 'deterministic');
});

test('deterministic adapter keeps unsupported requirements as gaps', async () => {
  const context = await new FixtureCandidateRepository().loadContext(SYNTHETIC_CANDIDATE_ID);
  const adapter = getCandidateAiAdapter({});
  const analysis = await adapter.analyzeJob({ context, jobSpec: job });
  assert.equal(analysis.requirements.find((row) => row.requirementId === 'req-finance')?.coverage, 'GAP');
});

test('rewrite validator rejects a fabricated numeric claim', () => {
  assert.throws(
    () => validateRewriteOutput(
      { text: 'Amélioration de la satisfaction de 35%.', usedMetrics: [] },
      { sourceStatement: 'Amélioration de la satisfaction.', verifiedMetrics: [] },
    ),
    /unsupported numeric claim/i,
  );
});

test('rewrite validator accepts only an explicitly supplied metric', () => {
  const output = validateRewriteOutput(
    { text: 'Coordination terrain. Résultat documenté : 12 équipes.', usedMetrics: ['exp-synth-1'] },
    { sourceStatement: 'Coordination terrain.', verifiedMetrics: [{ value: '12 équipes', sourceRef: 'exp-synth-1' }] },
  );
  assert.match(output.text, /12 équipes/);
});

test('OpenAI rewrite never sends candidate text externally without explicit processing consent', async () => {
  let calls = 0;
  const adapter = new OpenAICandidateAiAdapter('test-key', 'test-model', async () => {
    calls += 1;
    throw new Error('fetch must not be called without consent');
  });
  const output = await adapter.rewrite({ sourceStatement: 'Coordination des équipes terrain.', verifiedMetrics: [] });
  assert.equal(calls, 0);
  assert.equal(output.text, 'Coordination des équipes terrain.');
});

test('OpenAI rewrite may call the provider only when an explicit consent id is attached', async () => {
  let calls = 0;
  const adapter = new OpenAICandidateAiAdapter('test-key', 'test-model', async () => {
    calls += 1;
    return new Response(JSON.stringify({
      output: [{ content: [{ type: 'output_text', text: JSON.stringify({ text: 'Coordination des équipes terrain.', usedMetrics: [] }) }] }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const output = await adapter.rewrite({
    sourceStatement: 'Coordination des équipes terrain.',
    verifiedMetrics: [],
    externalProcessingConsentId: 'consent-synthetic-1',
  });
  assert.equal(calls, 1);
  assert.equal(output.text, 'Coordination des équipes terrain.');
});

test('job analysis validator rejects evidence attached to a GAP', () => {
  assert.throws(
    () => validateJobAnalysisOutput({
      requirements: [{ requirementId: 'req-finance', requirement: 'Conformité financière', coverage: 'GAP', evidenceRefs: ['skill:invented'], explanation: 'Invented' }],
    }),
    /gap cannot carry evidence/i,
  );
});

test('OpenAI request is non-stored and uses strict structured output', () => {
  const request = buildOpenAIRequest({
    model: 'model-from-env',
    schemaName: 'candidate_rewrite',
    schema: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' } }, required: ['text'] },
    instructions: 'Return only evidence-safe content.',
    input: 'Synthetic test input',
  });
  assert.equal(request.store, false);
  assert.equal(request.model, 'model-from-env');
  assert.equal(request.text.format.type, 'json_schema');
  assert.equal(request.text.format.strict, true);
});

test('decision persistence payload matches the canonical ai_decisions schema and vocabulary', () => {
  const payload = buildDecisionInsert({
    candidateId: SYNTHETIC_CANDIDATE_ID,
    jobId: '00000000-0000-4000-8000-000000000202',
    decisionType: 'assessment_score',
    inputHash: 'a'.repeat(64),
    output: { artifactKind: 'candidate_achievement_rewrite_v1', text: 'Synthetic' },
    promptVersion: 'candidate-rewrite-v1',
    modelId: 'model-from-env',
    modelProvider: 'openai',
  });
  assert.deepEqual(Object.keys(payload).sort(), [
    'candidate_id', 'decision_type', 'human_review_required', 'input_hash', 'job_id', 'model_id', 'model_provider', 'output', 'prompt_version',
  ].sort());
  assert.equal(payload.decision_type, 'assessment_score');
  assert.equal(payload.candidate_id, SYNTHETIC_CANDIDATE_ID);
  assert.equal(payload.model_id, 'model-from-env');
  assert.equal(payload.model_provider, 'openai');
  assert.equal(payload.human_review_required, true);
  assert.equal('subject_type' in payload, false);
  assert.equal('subject_id' in payload, false);
  assert.equal('model_name' in payload, false);
});

test('decision persistence rejects non-canonical decision types', () => {
  assert.throws(() => buildDecisionInsert({
    candidateId: SYNTHETIC_CANDIDATE_ID,
    decisionType: 'candidate_cv_diagnostic_v1' as never,
    inputHash: 'a'.repeat(64),
    output: { artifactKind: 'candidate_cv_diagnostic_v1' },
    promptVersion: 'candidate-diagnostic-v1',
    modelId: 'candidate-os-deterministic-v1',
    modelProvider: 'deterministic',
  }), /unsupported decision type/i);
});
