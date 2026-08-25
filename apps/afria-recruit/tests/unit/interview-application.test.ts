import test from 'node:test';
import assert from 'node:assert/strict';
import { FixtureCandidateRepository, SYNTHETIC_CANDIDATE_ID } from '../../lib/repositories/fixture-candidate-repository.js';
import { DeterministicCandidateAiAdapter } from '../../lib/ai/deterministic-adapter.js';
import type { ValidatedDecisionInput } from '../../lib/ai/persist-decision.js';
import type { JobSpec } from '../../lib/domain/types.js';
import type { DecisionStore, JobRepository, OwnedDecision } from '../../lib/services/candidate-optimizer-service.js';
import {
  InterviewService,
  type ConsentStore,
  type InterviewStore,
} from '../../lib/services/interview-service.js';
import {
  ApplicationService,
  buildStartedApplicationInsert,
  type ApplicationEventStore,
  type ApplicationStore,
  type ReviewGateStore,
} from '../../lib/services/application-service.js';

const JOB_ID = '00000000-0000-4000-8000-000000000202';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const job: JobSpec = {
  id: JOB_ID,
  title: 'Responsable programmes régionaux',
  countryCode: 'SN',
  requirements: [
    { id: 'skill:skill-project', kind: 'skill', label: 'Gestion de projets', required: true, skillId: 'skill-project', minimumYears: 5 },
    { id: 'skill:skill-finance', kind: 'skill', label: 'Conformité financière', required: true, skillId: 'skill-finance', minimumYears: 2 },
  ],
};

class FakeJobRepository implements JobRepository {
  async listOpen() { return [job]; }
  async getJobSpec(id: string) { return id === JOB_ID ? job : null; }
}

class FakeDecisionStore implements DecisionStore {
  writes: ValidatedDecisionInput[] = [];
  decisions = new Map<string, OwnedDecision>();
  async persist(input: ValidatedDecisionInput) {
    this.writes.push(input);
    const id = `decision-${this.writes.length}`;
    this.decisions.set(id, { id, candidateId: input.candidateId, jobId: input.jobId ?? null, decisionType: input.decisionType, output: input.output });
    return id;
  }
  async findOwned(id: string, candidateId: string) {
    const value = this.decisions.get(id);
    return value?.candidateId === candidateId ? value : null;
  }
}

class FakeConsentStore implements ConsentStore {
  writes: Array<{ candidateId: string; jobId: string; policyVersion: string }> = [];
  async createProcessingConsent(input: { candidateId: string; jobId: string; policyVersion: string }) {
    this.writes.push(input);
    return 'consent-1';
  }
}

class FakeInterviewStore implements InterviewStore {
  created: Array<Record<string, unknown>> = [];
  statuses: string[] = [];
  async create(input: { candidateId: string; jobId: string; consentId: string; modelProvider: string; modelId: string; promptVersion: string }) {
    this.created.push(input);
    return 'interview-1';
  }
  async findOwned(id: string, candidateId: string) {
    return id === 'interview-1' && candidateId === SYNTHETIC_CANDIDATE_ID ? { id, candidateId, jobId: JOB_ID, status: 'in_progress' } : null;
  }
  async markEvaluationPending(id: string) { this.statuses.push(`${id}:evaluation_pending`); }
}

function interviewFixture() {
  const decisionStore = new FakeDecisionStore();
  const consentStore = new FakeConsentStore();
  const interviewStore = new FakeInterviewStore();
  const service = new InterviewService({
    candidateRepository: new FixtureCandidateRepository(),
    jobRepository: new FakeJobRepository(),
    aiAdapter: new DeterministicCandidateAiAdapter(),
    decisionStore,
    consentStore,
    interviewStore,
    modelId: 'candidate-os-deterministic-v1',
    modelProvider: 'deterministic',
  });
  return { service, decisionStore, consentStore, interviewStore };
}

test('interview start creates explicit platform-processing consent before the session', async () => {
  const fixture = interviewFixture();
  const result = await fixture.service.start(SYNTHETIC_CANDIDATE_ID, JOB_ID);
  assert.equal(result.consentId, 'consent-1');
  assert.equal(fixture.consentStore.writes.length, 1);
  assert.equal(fixture.consentStore.writes[0]?.policyVersion, 'candidate-os-v1');
  assert.equal(fixture.interviewStore.created[0]?.consentId, 'consent-1');
  assert.match(result.turn.question, /situation concrète|réalisation pertinente/i);
});

test('interview answer is transient and is not copied into persisted feedback', async () => {
  const fixture = interviewFixture();
  await fixture.service.start(SYNTHETIC_CANDIDATE_ID, JOB_ID);
  const sensitiveAnswer = 'Réponse synthétique privée avec un détail qui ne doit pas être persisté.';
  const result = await fixture.service.respond(SYNTHETIC_CANDIDATE_ID, 'interview-1', sensitiveAnswer, 1);
  assert.match(result.turn.feedback ?? '', /faits précis|preuves/i);
  assert.equal(fixture.decisionStore.writes[0]?.decisionType, 'interview_score');
  assert.equal((fixture.decisionStore.writes[0]?.output as { artifactKind?: string }).artifactKind, 'candidate_interview_feedback_v1');
  assert.doesNotMatch(JSON.stringify(fixture.decisionStore.writes[0]?.output), new RegExp(sensitiveAnswer));
  assert.deepEqual(fixture.interviewStore.statuses, ['interview-1:evaluation_pending']);
});

class FakeReviewGate implements ReviewGateStore {
  constructor(private confirmed: boolean) {}
  async isConfirmedVariantReview() { return this.confirmed; }
}

class FakeApplicationStore implements ApplicationStore {
  creates: Array<{ candidateId: string; jobId: string }> = [];
  current = { id: 'application-1', candidateId: SYNTHETIC_CANDIDATE_ID, jobId: JOB_ID, status: 'started' };
  async createStarted(input: { candidateId: string; jobId: string }) { this.creates.push(input); return this.current; }
  async findOwned(id: string, candidateId: string) { return id === this.current.id && candidateId === this.current.candidateId ? this.current : null; }
}

class FakeEventStore implements ApplicationEventStore {
  events: Array<{ applicationId: string; currentStatus: string; actorUserId: string; reportedOutcome: string }> = [];
  async recordUnconfirmedOutcome(input: { applicationId: string; currentStatus: string; actorUserId: string; reportedOutcome: string }) { this.events.push(input); return 'event-1'; }
}

function applicationFixture(reviewConfirmed: boolean) {
  const applicationStore = new FakeApplicationStore();
  const eventStore = new FakeEventStore();
  const service = new ApplicationService({
    candidateRepository: new FixtureCandidateRepository(),
    jobRepository: new FakeJobRepository(),
    reviewGateStore: new FakeReviewGate(reviewConfirmed),
    applicationStore,
    eventStore,
  });
  return { service, applicationStore, eventStore };
}

test('application package cannot be created before a confirmed human review', async () => {
  const fixture = applicationFixture(false);
  await assert.rejects(
    () => fixture.service.createPackage(SYNTHETIC_CANDIDATE_ID, JOB_ID, 'decision-variants'),
    /confirmed human review required/i,
  );
  assert.equal(fixture.applicationStore.creates.length, 0);
});

test('application package starts locally and has no auto-submit semantics', async () => {
  const payload = buildStartedApplicationInsert(SYNTHETIC_CANDIDATE_ID, JOB_ID);
  assert.deepEqual(payload, {
    candidate_id: SYNTHETIC_CANDIDATE_ID,
    job_id: JOB_ID,
    source: 'candidate',
    status: 'started',
    applied_at: null,
  });
  const fixture = applicationFixture(true);
  const result = await fixture.service.createPackage(SYNTHETIC_CANDIDATE_ID, JOB_ID, 'decision-variants');
  assert.equal(result.application.status, 'started');
  assert.equal('submit' in fixture.service, false);
});

test('candidate-reported outcome is stored unconfirmed without changing canonical application status', async () => {
  const fixture = applicationFixture(true);
  const result = await fixture.service.recordCandidateOutcome(SYNTHETIC_CANDIDATE_ID, USER_ID, 'application-1', 'interview');
  assert.equal(result.confirmationStatus, 'unconfirmed');
  assert.equal(result.canonicalStatus, 'started');
  assert.deepEqual(fixture.eventStore.events[0], {
    applicationId: 'application-1',
    currentStatus: 'started',
    actorUserId: USER_ID,
    reportedOutcome: 'interview',
  });
});
