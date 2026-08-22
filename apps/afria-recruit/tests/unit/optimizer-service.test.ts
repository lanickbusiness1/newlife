import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { FixtureCandidateRepository, SYNTHETIC_CANDIDATE_ID } from '../../lib/repositories/fixture-candidate-repository.js';
import { DeterministicCandidateAiAdapter } from '../../lib/ai/deterministic-adapter.js';
import {
  CandidateOptimizerService,
  type DecisionStore,
  type HumanReviewStore,
  type JobRepository,
} from '../../lib/services/candidate-optimizer-service.js';
import type { JobSpec } from '../../lib/domain/types.js';
import type { ValidatedDecisionInput } from '../../lib/ai/persist-decision.js';

const JOB_ID = '00000000-0000-4000-8000-000000000202';
const job: JobSpec = {
  id: JOB_ID,
  title: 'Responsable programmes régionaux',
  countryCode: 'SN',
  requirements: [
    { id: 'skill:skill-project', kind: 'skill', label: 'Gestion de projets', required: true, skillId: 'skill-project', minimumYears: 5 },
    { id: 'skill:skill-finance', kind: 'skill', label: 'Conformité financière', required: true, skillId: 'skill-finance', minimumYears: 2 },
  ],
  semanticCriteria: [{
    id: 'semantic-project-management',
    label: 'Maîtrise de la gestion de projets',
    anchors: ['gestion', 'projets'],
    sourceRef: `job:${JOB_ID}:semantic:1`,
  }],
  institutionCriteria: [{
    id: 'institution-english',
    label: 'Capacité à travailler en anglais B2',
    anchors: ['en', 'b2'],
    sourceRef: `job:${JOB_ID}:institution:1`,
  }],
};

class FakeDecisionStore implements DecisionStore {
  readonly writes: ValidatedDecisionInput[] = [];
  readonly decisions = new Map<string, { id: string; candidateId: string; jobId: string | null; decisionType: string; output: unknown }>();
  async persist(input: ValidatedDecisionInput) {
    this.writes.push(input);
    const id = `decision-${this.writes.length}`;
    this.decisions.set(id, { id, candidateId: input.candidateId, jobId: input.jobId ?? null, decisionType: input.decisionType, output: input.output });
    return id;
  }
  async findOwned(id: string, candidateId: string) {
    const value = this.decisions.get(id);
    return value && value.candidateId === candidateId ? value : null;
  }
}

class FakeReviewStore implements HumanReviewStore {
  readonly writes: Array<{ decisionId: string; reviewerId: string; outcome: 'approved' | 'rejected'; rationale: string }> = [];
  async persist(input: { decisionId: string; reviewerId: string; outcome: 'approved' | 'rejected'; rationale: string }) {
    this.writes.push(input);
    return `review-${this.writes.length}`;
  }
}

class FakeJobRepository implements JobRepository {
  async listOpen() { return [job]; }
  async getJobSpec(id: string) { return id === JOB_ID ? job : null; }
}

function service(candidateRepository = new FixtureCandidateRepository()) {
  const decisionStore = new FakeDecisionStore();
  const reviewStore = new FakeReviewStore();
  return {
    decisionStore,
    reviewStore,
    service: new CandidateOptimizerService({
      candidateRepository,
      jobRepository: new FakeJobRepository(),
      aiAdapter: new DeterministicCandidateAiAdapter(),
      decisionStore,
      reviewStore,
      modelId: 'candidate-os-deterministic-v1',
      modelProvider: 'deterministic',
    }),
  };
}

test('diagnostic persists an assessment_score with a Candidate OS artifact kind', async () => {
  const fixture = service();
  const result = await fixture.service.diagnose(SYNTHETIC_CANDIDATE_ID);
  assert.equal(result.decisionId, 'decision-1');
  assert.equal(fixture.decisionStore.writes[0]?.decisionType, 'assessment_score');
  assert.equal((fixture.decisionStore.writes[0]?.output as { artifactKind?: string }).artifactKind, 'candidate_cv_diagnostic_v1');
  assert.equal(fixture.decisionStore.writes[0]?.candidateId, SYNTHETIC_CANDIDATE_ID);
  assert.match(fixture.decisionStore.writes[0]?.inputHash ?? '', /^[a-f0-9]{64}$/);
});

test('job analysis preserves unsupported requirements as GAP and uses match_recommendation', async () => {
  const fixture = service();
  const result = await fixture.service.analyzeJob(SYNTHETIC_CANDIDATE_ID, JOB_ID);
  assert.equal(result.analysis.requirements.find((row) => row.requirementId === 'skill:skill-finance')?.coverage, 'GAP');
  assert.equal(fixture.decisionStore.writes[0]?.jobId, JOB_ID);
  assert.equal(fixture.decisionStore.writes[0]?.decisionType, 'match_recommendation');
  assert.equal((fixture.decisionStore.writes[0]?.output as { artifactKind?: string }).artifactKind, 'candidate_job_gap_analysis_v1');
});

test('application readiness is derived from canonical evidence and persisted as an assessment artifact', async () => {
  const fixture = service();

  const result = await fixture.service.applicationReadiness(SYNTHETIC_CANDIDATE_ID, JOB_ID);

  assert.ok(result.readiness.total > 0);
  assert.equal(result.readiness.dimensions.atsTechnical, 20);
  assert.equal(fixture.decisionStore.writes[0]?.decisionType, 'assessment_score');
  assert.equal((fixture.decisionStore.writes[0]?.output as { artifactKind?: string }).artifactKind, 'candidate_application_readiness_v1');
  assert.equal(fixture.decisionStore.writes[0]?.jobId, JOB_ID);
});

test('application readiness fails closed before persistence when canonical signals are incomplete', async () => {
  const base = new FixtureCandidateRepository();
  const incompleteRepository = {
    async loadContext(candidateId: string) {
      const context = await base.loadContext(candidateId);
      delete context.documents[0].atsProfile;
      return context;
    },
  };
  const fixture = service(incompleteRepository);

  await assert.rejects(
    () => fixture.service.applicationReadiness(SYNTHETIC_CANDIDATE_ID, JOB_ID),
    /readiness signals are incomplete/i,
  );
  assert.equal(fixture.decisionStore.writes.length, 0);
});

test('dual CV variants have identical fact fingerprints and use canonical assessment_score storage', async () => {
  const fixture = service();
  const result = await fixture.service.buildVariants(SYNTHETIC_CANDIDATE_ID, JOB_ID);
  assert.equal(result.variants.ats.factsFingerprint, result.variants.human.factsFingerprint);
  assert.equal(result.variants.ats.factsFingerprint, createHash('sha256').update(result.variants.factsCanonicalJson).digest('hex'));
  assert.equal(fixture.decisionStore.writes[0]?.decisionType, 'assessment_score');
  assert.equal((fixture.decisionStore.writes[0]?.output as { artifactKind?: string }).artifactKind, 'candidate_cv_variants_v1');
});

test('approval is blocked when a blocking truth conflict exists', async () => {
  const base = new FixtureCandidateRepository();
  const conflictingRepository = {
    async loadContext(candidateId: string) {
      const context = await base.loadContext(candidateId);
      context.experiences[0] = { ...context.experiences[0], startDate: '2025-12-01', endDate: '2024-01-01', isCurrent: false };
      return context;
    },
  };
  const fixture = service(conflictingRepository);
  const diagnostic = await fixture.service.diagnose(SYNTHETIC_CANDIDATE_ID);
  await assert.rejects(
    () => fixture.service.review(SYNTHETIC_CANDIDATE_ID, 'user-synth', diagnostic.decisionId, 'approved', 'Validation'),
    /blocking truth conflict/i,
  );
  assert.equal(fixture.reviewStore.writes.length, 0);
});

test('review cannot approve a decision owned by another candidate', async () => {
  const fixture = service();
  fixture.decisionStore.decisions.set('foreign', { id: 'foreign', candidateId: 'other', jobId: null, decisionType: 'assessment_score', output: {} });
  await assert.rejects(
    () => fixture.service.review(SYNTHETIC_CANDIDATE_ID, 'user-synth', 'foreign', 'approved', 'Validation'),
    /decision not found/i,
  );
});
