import { DeterministicCandidateAiAdapter } from '../ai/deterministic-adapter.js';
import type { ValidatedDecisionInput } from '../ai/persist-decision.js';
import type { JobSpec } from '../domain/types.js';
import { FixtureCandidateRepository, SYNTHETIC_CANDIDATE_ID } from '../repositories/fixture-candidate-repository.js';
import {
  CandidateOptimizerService,
  type DecisionStore,
  type HumanReviewStore,
  type JobRepository,
  type OwnedDecision,
} from '../services/candidate-optimizer-service.js';

export const E2E_ACCESS_TOKEN = 'e2e-synthetic-token';
export const E2E_USER_ID = '00000000-0000-4000-8000-000000000001';
export const E2E_JOB_ID = '00000000-0000-4000-8000-000000000202';

const syntheticJob: JobSpec = {
  id: E2E_JOB_ID,
  title: 'Responsable programmes régionaux',
  countryCode: 'SN',
  requirements: [
    {
      id: 'skill:skill-project',
      kind: 'skill',
      label: 'Gestion de projets',
      required: true,
      skillId: 'skill-project',
      minimumYears: 5,
    },
    {
      id: 'skill:skill-logistics',
      kind: 'skill',
      label: 'Logistique humanitaire',
      required: false,
      skillId: 'skill-logistics',
      minimumYears: 3,
    },
    {
      id: 'skill:skill-finance',
      kind: 'skill',
      label: 'Conformité financière',
      required: true,
      skillId: 'skill-finance',
      minimumYears: 2,
    },
    {
      id: 'language:en',
      kind: 'language',
      label: 'Anglais B2',
      required: true,
      languageCode: 'en',
      minimumLevel: 'B2',
    },
  ],
};

class FixtureJobRepository implements JobRepository {
  async listOpen() {
    return [structuredClone(syntheticJob)];
  }

  async getJobSpec(id: string) {
    return id === E2E_JOB_ID ? structuredClone(syntheticJob) : null;
  }
}

type E2EState = {
  decisions: Map<string, OwnedDecision>;
  reviews: Array<{ id: string; decisionId: string; reviewerId: string; outcome: 'approved' | 'rejected'; rationale: string }>;
  nextDecision: number;
  nextReview: number;
};

const globalState = globalThis as typeof globalThis & { __afriaRecruitE2EState?: E2EState };
const state: E2EState = globalState.__afriaRecruitE2EState ?? {
  decisions: new Map(),
  reviews: [],
  nextDecision: 1,
  nextReview: 1,
};
globalState.__afriaRecruitE2EState = state;

class MemoryDecisionStore implements DecisionStore {
  async persist(input: ValidatedDecisionInput) {
    const id = `e2e-decision-${state.nextDecision++}`;
    state.decisions.set(id, {
      id,
      candidateId: input.candidateId,
      jobId: input.jobId ?? null,
      decisionType: input.decisionType,
      output: input.output,
    });
    return id;
  }

  async findOwned(id: string, candidateId: string) {
    const decision = state.decisions.get(id);
    return decision?.candidateId === candidateId ? decision : null;
  }
}

class MemoryReviewStore implements HumanReviewStore {
  async persist(input: { decisionId: string; reviewerId: string; outcome: 'approved' | 'rejected'; rationale: string }) {
    const id = `e2e-review-${state.nextReview++}`;
    state.reviews.push({ id, ...input });
    return id;
  }
}

function e2eFlagsEnabled() {
  return process.env.CI === 'true'
    && process.env.GITHUB_ACTIONS === 'true'
    && process.env.AFRIA_RECRUIT_E2E_MODE === '1';
}

export function isCandidateE2ERequest(request: Request) {
  if (!e2eFlagsEnabled()) return false;
  return request.headers.get('authorization') === `Bearer ${E2E_ACCESS_TOKEN}`;
}

export function createCandidateE2ERuntime() {
  if (!e2eFlagsEnabled()) throw new Error('E2E runtime is disabled');
  const service = new CandidateOptimizerService({
    candidateRepository: new FixtureCandidateRepository(),
    jobRepository: new FixtureJobRepository(),
    aiAdapter: new DeterministicCandidateAiAdapter(),
    decisionStore: new MemoryDecisionStore(),
    reviewStore: new MemoryReviewStore(),
    modelId: 'candidate-os-deterministic-e2e-v1',
    modelProvider: 'deterministic',
  });
  return {
    auth: {
      accessToken: E2E_ACCESS_TOKEN,
      user: { id: E2E_USER_ID },
      candidate: { id: SYNTHETIC_CANDIDATE_ID, userId: E2E_USER_ID },
      adminClient: null,
    },
    service,
  };
}
