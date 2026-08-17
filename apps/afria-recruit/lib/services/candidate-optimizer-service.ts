import { createHash } from 'node:crypto';
import type { CandidateAiAdapter } from '../ai/contracts.js';
import type { CanonicalDecisionType, ValidatedDecisionInput } from '../ai/persist-decision.js';
import type { Json } from '../supabase/database.types.js';
import type { CandidateContext, CandidateRepository } from '../repositories/candidate-context.js';
import type { JobSpec } from '../domain/types.js';
import { buildRecruiterLens } from '../domain/recruiter-lens.js';
import { findTruthConflicts } from '../domain/truth-consistency.js';
import { CandidateHttpError } from '../http/errors.js';

export interface OwnedDecision {
  id: string;
  candidateId: string;
  jobId: string | null;
  decisionType: string;
  output: unknown;
}

export interface DecisionStore {
  persist(input: ValidatedDecisionInput): Promise<string>;
  findOwned(id: string, candidateId: string): Promise<OwnedDecision | null>;
}

export interface HumanReviewStore {
  persist(input: { decisionId: string; reviewerId: string; outcome: 'approved' | 'rejected'; rationale: string }): Promise<string>;
}

export interface JobRepository {
  listOpen(): Promise<JobSpec[]>;
  getJobSpec(id: string): Promise<JobSpec | null>;
}

export interface ExternalProcessingConsentStore {
  createCvRewriteConsent(input: { candidateId: string; jobId: string; policyVersion: string }): Promise<string>;
}

export interface CandidateOptimizerDependencies {
  candidateRepository: CandidateRepository;
  jobRepository: JobRepository;
  aiAdapter: CandidateAiAdapter;
  decisionStore: DecisionStore;
  reviewStore: HumanReviewStore;
  externalProcessingConsentStore?: ExternalProcessingConsentStore;
  modelId: string;
  modelProvider: string;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, stableValue(nested)]));
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function sha256(value: unknown): string {
  return createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex');
}

function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function factsForVariants(context: CandidateContext) {
  return {
    candidate: {
      professionalTitle: context.candidate.professionalTitle,
      summary: context.candidate.summary,
      currentCountry: context.candidate.currentCountry,
      homeCountry: context.candidate.homeCountry,
      yearsExperience: context.candidate.yearsExperience,
    },
    experiences: context.experiences,
    educations: context.educations,
    skills: context.skills,
    languages: context.languages,
    certifications: context.certifications,
  };
}

export class CandidateOptimizerService {
  constructor(private readonly deps: CandidateOptimizerDependencies) {}

  async context(candidateId: string) {
    return this.deps.candidateRepository.loadContext(candidateId);
  }

  async listJobs() {
    return this.deps.jobRepository.listOpen();
  }

  private async persistArtifact(input: {
    candidateId: string;
    jobId?: string | null;
    decisionType: CanonicalDecisionType;
    artifactKind: string;
    payload: unknown;
    promptVersion: string;
    hashSource: unknown;
  }) {
    const output = asJson({ artifactKind: input.artifactKind, payload: input.payload });
    return this.deps.decisionStore.persist({
      candidateId: input.candidateId,
      jobId: input.jobId,
      decisionType: input.decisionType,
      inputHash: sha256(input.hashSource),
      output,
      promptVersion: input.promptVersion,
      modelId: this.deps.modelId,
      modelProvider: this.deps.modelProvider,
    });
  }

  async diagnose(candidateId: string) {
    const context = await this.deps.candidateRepository.loadContext(candidateId);
    const diagnostic = await this.deps.aiAdapter.diagnose({ context });
    const decisionId = await this.persistArtifact({
      candidateId,
      decisionType: 'assessment_score',
      artifactKind: 'candidate_cv_diagnostic_v1',
      payload: diagnostic,
      promptVersion: 'candidate-cv-diagnostic-v1',
      hashSource: { candidateId, context },
    });
    return { decisionId, diagnostic };
  }

  async analyzeJob(candidateId: string, jobId: string) {
    const [context, jobSpec] = await Promise.all([
      this.deps.candidateRepository.loadContext(candidateId),
      this.deps.jobRepository.getJobSpec(jobId),
    ]);
    if (!jobSpec) throw new CandidateHttpError(404, 'Job not found');
    const analysis = await this.deps.aiAdapter.analyzeJob({ context, jobSpec });
    const recruiterLens = buildRecruiterLens(jobSpec, analysis.requirements);
    const decisionId = await this.persistArtifact({
      candidateId,
      jobId,
      decisionType: 'match_recommendation',
      artifactKind: 'candidate_job_gap_analysis_v2',
      payload: { analysis, recruiterLens },
      promptVersion: 'candidate-job-gap-analysis-v2',
      hashSource: { candidateId, jobSpec, context, recruiterLens },
    });
    return { decisionId, jobSpec, analysis, recruiterLens };
  }

  async rewrite(
    candidateId: string,
    jobId: string,
    sourceRef: string,
    sourceStatement: string,
    verifiedMetrics: Array<{ value: string; sourceRef: string }>,
    externalProcessingConsent: boolean,
  ) {
    if (!externalProcessingConsent) throw new CandidateHttpError(400, 'Explicit external processing consent required');
    const [context, jobSpec] = await Promise.all([
      this.deps.candidateRepository.loadContext(candidateId),
      this.deps.jobRepository.getJobSpec(jobId),
    ]);
    if (!jobSpec) throw new CandidateHttpError(404, 'Job not found');

    const experience = context.experiences.find((item) => `experience:${item.id}` === sourceRef || item.id === sourceRef);
    if (!experience) throw new CandidateHttpError(400, 'Unknown source reference');
    const sourceCorpus = [experience.title, experience.description ?? ''].join(' ');
    if (!sourceCorpus.includes(sourceStatement.trim())) throw new CandidateHttpError(400, 'Source statement is not supported by the selected experience');

    let consentId: string | null = null;
    if (this.deps.aiAdapter.providerName === 'openai') {
      const consentStore = this.deps.externalProcessingConsentStore;
      if (!consentStore) throw new CandidateHttpError(503, 'External processing is unavailable');
      consentId = await consentStore.createCvRewriteConsent({ candidateId, jobId, policyVersion: 'candidate-os-v1' });
    }

    const rewrite = await this.deps.aiAdapter.rewrite({
      sourceStatement,
      verifiedMetrics,
      externalProcessingConsentId: consentId ?? undefined,
    });
    const decisionId = await this.persistArtifact({
      candidateId,
      jobId,
      decisionType: 'assessment_score',
      artifactKind: 'candidate_achievement_rewrite_v1',
      payload: { sourceRef, rewrite, externalProcessingConsentId: consentId },
      promptVersion: 'candidate-achievement-rewrite-v1',
      hashSource: { candidateId, jobId, sourceRef, sourceStatement, verifiedMetrics, externalProcessingConsentId: consentId },
    });
    return { decisionId, rewrite, consentId };
  }

  async buildVariants(candidateId: string, jobId: string) {
    const [context, jobSpec] = await Promise.all([
      this.deps.candidateRepository.loadContext(candidateId),
      this.deps.jobRepository.getJobSpec(jobId),
    ]);
    if (!jobSpec) throw new CandidateHttpError(404, 'Job not found');
    const facts = factsForVariants(context);
    const factsCanonicalJson = canonicalJson(facts);
    const factsFingerprint = sha256(factsCanonicalJson);
    const sections = {
      headline: context.candidate.professionalTitle,
      summary: context.candidate.summary,
      experiences: context.experiences.map(({ title, organization, description, startDate, endDate, isCurrent, evidenceStatus }) => ({ title, organization, description, startDate, endDate, isCurrent, evidenceStatus })),
      education: context.educations.map(({ institution, qualification, fieldOfStudy, completionDate, evidenceStatus }) => ({ institution, qualification, fieldOfStudy, completionDate, evidenceStatus })),
      skills: context.skills.map(({ name, proficiency, evidenceStatus }) => ({ name, proficiency, evidenceStatus })),
      languages: context.languages,
    };
    const variants = {
      factsCanonicalJson,
      ats: { kind: 'ATS' as const, factsFingerprint, targetJob: jobSpec.title, sections },
      human: { kind: 'HUMAN' as const, factsFingerprint, targetJob: jobSpec.title, sections },
    };
    const decisionId = await this.persistArtifact({
      candidateId,
      jobId,
      decisionType: 'assessment_score',
      artifactKind: 'candidate_cv_variants_v1',
      payload: variants,
      promptVersion: 'candidate-cv-variants-v1',
      hashSource: { candidateId, jobSpec, factsFingerprint },
    });
    return { decisionId, variants };
  }

  async review(candidateId: string, reviewerId: string, decisionId: string, outcome: 'approved' | 'rejected', rationale: string) {
    const [context, decision] = await Promise.all([
      this.deps.candidateRepository.loadContext(candidateId),
      this.deps.decisionStore.findOwned(decisionId, candidateId),
    ]);
    if (!decision) throw new CandidateHttpError(404, 'Decision not found');
    if (outcome === 'approved') {
      const blockers = findTruthConflicts(context).filter((conflict) => conflict.blocking);
      if (blockers.length) throw new CandidateHttpError(409, 'Blocking truth conflict must be resolved before approval');
    }
    const reviewId = await this.deps.reviewStore.persist({ decisionId, reviewerId, outcome, rationale });
    return { reviewId, decisionId, outcome };
  }
}
