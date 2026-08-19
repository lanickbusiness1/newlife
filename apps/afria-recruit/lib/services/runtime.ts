import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAuthenticatedCandidate, createLiveAuthBoundaryDependencies } from '../auth/authenticated-user.js';
import { createUserTokenClient } from '../supabase/user-client.js';
import type { Database } from '../supabase/database.types.js';
import { getCandidateRepository } from '../repositories/index.js';
import { getCandidateAiAdapter } from '../ai/index.js';
import { OFFICIAL_CAREER_OPPORTUNITIES } from '../fixtures/career-opportunities.js';
import { CandidateOptimizerService } from './candidate-optimizer-service.js';
import { CareerPathwayService } from './career-pathway-service.js';
import { LiveDecisionStore, LiveHumanReviewStore, LiveJobRepository } from './live-stores.js';
import { createCandidateE2ERuntime, isCandidateE2ERequest } from '../testing/e2e-runtime.js';
import { InterviewService } from './interview-service.js';
import { ApplicationService } from './application-service.js';
import {
  LiveApplicationEventStore,
  LiveApplicationStore,
  LiveConsentStore,
  LiveExternalProcessingConsentStore,
  LiveInterviewStore,
  LiveReviewGateStore,
} from './candidate-loop-stores.js';

export async function createCandidateRuntime(request: Request) {
  if (isCandidateE2ERequest(request)) return createCandidateE2ERuntime();
  const auth = await requireAuthenticatedCandidate(request, createLiveAuthBoundaryDependencies());
  const admin = auth.adminClient as SupabaseClient<Database>;
  const userClient = createUserTokenClient(auth.accessToken);
  const candidateRepository = getCandidateRepository(userClient);
  const jobRepository = new LiveJobRepository(userClient);
  const aiAdapter = getCandidateAiAdapter();
  const modelId = aiAdapter.providerName === 'openai'
    ? (process.env.AFRIA_RECRUIT_OPENAI_MODEL?.trim() || 'openai-config-missing')
    : 'candidate-os-deterministic-v1';
  const decisionStore = new LiveDecisionStore(admin);
  const service = new CandidateOptimizerService({
    candidateRepository,
    jobRepository,
    aiAdapter,
    decisionStore,
    reviewStore: new LiveHumanReviewStore(admin),
    externalProcessingConsentStore: new LiveExternalProcessingConsentStore(admin),
    modelId,
    modelProvider: aiAdapter.providerName,
  });
  const interviewService = new InterviewService({
    candidateRepository,
    jobRepository,
    aiAdapter,
    decisionStore,
    consentStore: new LiveConsentStore(admin),
    interviewStore: new LiveInterviewStore(admin),
    modelId,
    modelProvider: aiAdapter.providerName,
  });
  const applicationService = new ApplicationService({
    candidateRepository,
    jobRepository,
    reviewGateStore: new LiveReviewGateStore(admin),
    applicationStore: new LiveApplicationStore(admin),
    eventStore: new LiveApplicationEventStore(admin),
  });
  const careerPathwayService = new CareerPathwayService({
    candidateRepository,
    opportunities: OFFICIAL_CAREER_OPPORTUNITIES,
  });
  return { auth, service, interviewService, applicationService, careerPathwayService };
}
