import { createHash } from 'node:crypto';
import type { CandidateAiAdapter } from '../ai/contracts.js';
import type { Json } from '../supabase/database.types.js';
import type { CandidateRepository } from '../repositories/candidate-context.js';
import type { DecisionStore, JobRepository } from './candidate-optimizer-service.js';
import { CandidateHttpError } from '../http/errors.js';

export interface ConsentStore {
  createProcessingConsent(input: { candidateId: string; jobId: string; policyVersion: string }): Promise<string>;
}

export interface InterviewRecord {
  id: string;
  candidateId: string;
  jobId: string;
  status: string;
}

export interface InterviewStore {
  create(input: { candidateId: string; jobId: string; consentId: string; modelProvider: string; modelId: string; promptVersion: string }): Promise<string>;
  findOwned(id: string, candidateId: string): Promise<InterviewRecord | null>;
  markEvaluationPending(id: string): Promise<void>;
}

export interface InterviewServiceDependencies {
  candidateRepository: CandidateRepository;
  jobRepository: JobRepository;
  aiAdapter: CandidateAiAdapter;
  decisionStore: DecisionStore;
  consentStore: ConsentStore;
  interviewStore: InterviewStore;
  modelId: string;
  modelProvider: string;
}

function sha256(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export class InterviewService {
  constructor(private readonly deps: InterviewServiceDependencies) {}

  async start(candidateId: string, jobId: string) {
    const [context, jobSpec] = await Promise.all([
      this.deps.candidateRepository.loadContext(candidateId),
      this.deps.jobRepository.getJobSpec(jobId),
    ]);
    if (!jobSpec) throw new CandidateHttpError(404, 'Job not found');

    const consentId = await this.deps.consentStore.createProcessingConsent({
      candidateId,
      jobId,
      policyVersion: 'candidate-os-v1',
    });
    const interviewId = await this.deps.interviewStore.create({
      candidateId,
      jobId,
      consentId,
      modelProvider: this.deps.modelProvider,
      modelId: this.deps.modelId,
      promptVersion: 'candidate-interview-coach-v1',
    });
    const turn = await this.deps.aiAdapter.interviewTurn({ context, jobSpec, turn: 1 });
    return { interviewId, consentId, turn, rawAnswerStored: false as const };
  }

  async respond(candidateId: string, interviewId: string, candidateAnswer: string, turnNumber: number) {
    const answer = candidateAnswer.trim();
    if (!answer || answer.length > 6000) throw new CandidateHttpError(400, 'Invalid interview answer');
    if (!Number.isInteger(turnNumber) || turnNumber < 1 || turnNumber > 50) throw new CandidateHttpError(400, 'Invalid interview turn');

    const [context, interview] = await Promise.all([
      this.deps.candidateRepository.loadContext(candidateId),
      this.deps.interviewStore.findOwned(interviewId, candidateId),
    ]);
    if (!interview) throw new CandidateHttpError(404, 'Interview not found');
    if (interview.status !== 'in_progress' && interview.status !== 'scheduled') throw new CandidateHttpError(409, 'Interview is not active');
    const jobSpec = await this.deps.jobRepository.getJobSpec(interview.jobId);
    if (!jobSpec) throw new CandidateHttpError(404, 'Job not found');

    const turn = await this.deps.aiAdapter.interviewTurn({ context, jobSpec, turn: turnNumber, candidateAnswer: answer });
    const safeOutput = {
      artifactKind: 'candidate_interview_feedback_v1',
      interviewId,
      turn: turnNumber,
      question: turn.question,
      feedback: turn.feedback,
      focusRequirementIds: turn.focusRequirementIds,
      evidenceRefs: turn.evidenceRefs,
      rawAnswerStored: false,
    };
    const decisionId = await this.deps.decisionStore.persist({
      candidateId,
      jobId: interview.jobId,
      decisionType: 'interview_score',
      inputHash: sha256({ interviewId, turnNumber, candidateAnswer: answer }),
      output: asJson(safeOutput),
      promptVersion: 'candidate-interview-coach-v1',
      modelId: this.deps.modelId,
      modelProvider: this.deps.modelProvider,
    });
    await this.deps.interviewStore.markEvaluationPending(interviewId);
    return { decisionId, turn, rawAnswerStored: false as const };
  }
}
