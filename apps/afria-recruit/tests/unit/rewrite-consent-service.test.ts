import test from 'node:test';
import assert from 'node:assert/strict';
import { FixtureCandidateRepository, SYNTHETIC_CANDIDATE_ID } from '../../lib/repositories/fixture-candidate-repository.js';
import type { CandidateAiAdapter } from '../../lib/ai/contracts.js';
import type { JobSpec } from '../../lib/domain/types.js';
import type { ValidatedDecisionInput } from '../../lib/ai/persist-decision.js';
import {
  CandidateOptimizerService,
  type DecisionStore,
  type ExternalProcessingConsentStore,
  type HumanReviewStore,
  type JobRepository,
} from '../../lib/services/candidate-optimizer-service.js';

const JOB_ID = '00000000-0000-4000-8000-000000000202';
const job: JobSpec = {
  id: JOB_ID,
  title: 'Responsable programmes régionaux',
  countryCode: 'SN',
  requirements: [],
};

class FakeDecisionStore implements DecisionStore {
  async persist(_input: ValidatedDecisionInput) { return 'decision-1'; }
  async findOwned() { return null; }
}
class FakeReviewStore implements HumanReviewStore {
  async persist() { return 'review-1'; }
}
class FakeJobRepository implements JobRepository {
  async listOpen() { return [job]; }
  async getJobSpec(id: string) { return id === JOB_ID ? job : null; }
}
class FakeConsentStore implements ExternalProcessingConsentStore {
  calls: Array<{ candidateId: string; jobId: string; policyVersion: string }> = [];
  async createCvRewriteConsent(input: { candidateId: string; jobId: string; policyVersion: string }) {
    this.calls.push(input);
    return 'consent-synthetic-1';
  }
}

test('external rewrite creates auditable consent before provider invocation', async () => {
  const consentStore = new FakeConsentStore();
  let providerConsentId: string | undefined;
  const adapter: CandidateAiAdapter = {
    providerName: 'openai',
    async diagnose() { return { findings: [] }; },
    async analyzeJob() { return { requirements: [] }; },
    async rewrite(input) {
      providerConsentId = input.externalProcessingConsentId;
      return { text: input.sourceStatement, usedMetrics: [] };
    },
    async interviewTurn() { return { question: 'Synthetic', feedback: null, focusRequirementIds: [], evidenceRefs: [] }; },
  };

  const service = new CandidateOptimizerService({
    candidateRepository: new FixtureCandidateRepository(),
    jobRepository: new FakeJobRepository(),
    aiAdapter: adapter,
    decisionStore: new FakeDecisionStore(),
    reviewStore: new FakeReviewStore(),
    externalProcessingConsentStore: consentStore,
    modelId: 'test-model',
    modelProvider: 'openai',
  });

  const result = await service.rewrite(
    SYNTHETIC_CANDIDATE_ID,
    JOB_ID,
    'exp-synth-1',
    'Coordination d’équipes et de programmes multisectoriels.',
    [],
    true,
  );

  assert.equal(consentStore.calls.length, 1);
  assert.deepEqual(consentStore.calls[0], { candidateId: SYNTHETIC_CANDIDATE_ID, jobId: JOB_ID, policyVersion: 'candidate-os-v1' });
  assert.equal(providerConsentId, 'consent-synthetic-1');
  assert.equal(result.consentId, 'consent-synthetic-1');
});
