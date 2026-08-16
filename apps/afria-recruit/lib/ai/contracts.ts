import type { CandidateContext } from '../repositories/candidate-context.js';
import type { DiagnosticFinding, JobSpec, RequirementCoverage } from '../domain/types.js';
import type { RewriteAchievementInput, RewriteAchievementOutput } from '../domain/achievement-writer.js';

export interface DiagnosticInput {
  context: CandidateContext;
}

export interface DiagnosticOutput {
  findings: DiagnosticFinding[];
}

export interface JobAnalysisInput {
  context: CandidateContext;
  jobSpec: JobSpec;
}

export interface JobAnalysisOutput {
  requirements: RequirementCoverage[];
}

export type RewriteInput = RewriteAchievementInput;
export type RewriteOutput = RewriteAchievementOutput;

export interface InterviewTurnInput {
  context: CandidateContext;
  jobSpec: JobSpec;
  turn: number;
  candidateAnswer?: string;
}

export interface InterviewTurnOutput {
  question: string;
  feedback: string | null;
  focusRequirementIds: string[];
  evidenceRefs: string[];
}

export interface CandidateAiAdapter {
  readonly providerName: 'deterministic' | 'openai';
  diagnose(input: DiagnosticInput): Promise<DiagnosticOutput>;
  analyzeJob(input: JobAnalysisInput): Promise<JobAnalysisOutput>;
  rewrite(input: RewriteInput): Promise<RewriteOutput>;
  interviewTurn(input: InterviewTurnInput): Promise<InterviewTurnOutput>;
}
