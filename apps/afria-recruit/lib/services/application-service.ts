import type { CandidateRepository } from '../repositories/candidate-context.js';
import type { JobRepository } from './candidate-optimizer-service.js';
import { CandidateHttpError } from '../http/errors.js';

export type CandidateReportedOutcome = 'interview' | 'offer' | 'hired' | 'rejected';

export interface ApplicationRecord {
  id: string;
  candidateId: string;
  jobId: string;
  status: string;
}

export interface ReviewGateStore {
  isConfirmedVariantReview(decisionId: string, candidateId: string, jobId: string): Promise<boolean>;
}

export interface ApplicationStore {
  createStarted(input: { candidateId: string; jobId: string }): Promise<ApplicationRecord>;
  findOwned(id: string, candidateId: string): Promise<ApplicationRecord | null>;
}

export interface ApplicationEventStore {
  recordUnconfirmedOutcome(input: { applicationId: string; currentStatus: string; actorUserId: string; reportedOutcome: string }): Promise<string>;
}

export interface ApplicationServiceDependencies {
  candidateRepository: CandidateRepository;
  jobRepository: JobRepository;
  reviewGateStore: ReviewGateStore;
  applicationStore: ApplicationStore;
  eventStore: ApplicationEventStore;
}

export function buildStartedApplicationInsert(candidateId: string, jobId: string) {
  return {
    candidate_id: candidateId,
    job_id: jobId,
    source: 'candidate' as const,
    status: 'started' as const,
    applied_at: null,
  };
}

export class ApplicationService {
  constructor(private readonly deps: ApplicationServiceDependencies) {}

  async createPackage(candidateId: string, jobId: string, variantsDecisionId: string) {
    const [, jobSpec, confirmed] = await Promise.all([
      this.deps.candidateRepository.loadContext(candidateId),
      this.deps.jobRepository.getJobSpec(jobId),
      this.deps.reviewGateStore.isConfirmedVariantReview(variantsDecisionId, candidateId, jobId),
    ]);
    if (!jobSpec) throw new CandidateHttpError(404, 'Job not found');
    if (!confirmed) throw new CandidateHttpError(409, 'Confirmed human review required before application package');
    const application = await this.deps.applicationStore.createStarted({ candidateId, jobId });
    return { application, submitted: false as const, appliedAt: null };
  }

  async recordCandidateOutcome(candidateId: string, actorUserId: string, applicationId: string, reportedOutcome: CandidateReportedOutcome) {
    const allowed = new Set<CandidateReportedOutcome>(['interview', 'offer', 'hired', 'rejected']);
    if (!allowed.has(reportedOutcome)) throw new CandidateHttpError(400, 'Invalid outcome');
    const application = await this.deps.applicationStore.findOwned(applicationId, candidateId);
    if (!application) throw new CandidateHttpError(404, 'Application not found');
    const eventId = await this.deps.eventStore.recordUnconfirmedOutcome({
      applicationId,
      currentStatus: application.status,
      actorUserId,
      reportedOutcome,
    });
    return {
      eventId,
      reportedOutcome,
      confirmationStatus: 'unconfirmed' as const,
      canonicalStatus: application.status,
    };
  }
}
