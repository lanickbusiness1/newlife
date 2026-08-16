import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAuthenticatedCandidate, createLiveAuthBoundaryDependencies } from '../auth/authenticated-user.js';
import { createUserTokenClient } from '../supabase/user-client.js';
import type { Database } from '../supabase/database.types.js';
import { getCandidateRepository } from '../repositories/index.js';
import { getCandidateAiAdapter } from '../ai/index.js';
import { CandidateOptimizerService } from './candidate-optimizer-service.js';
import { LiveDecisionStore, LiveHumanReviewStore, LiveJobRepository } from './live-stores.js';

export async function createCandidateRuntime(request: Request) {
  const auth = await requireAuthenticatedCandidate(request, createLiveAuthBoundaryDependencies());
  const admin = auth.adminClient as SupabaseClient<Database>;
  const userClient = createUserTokenClient(auth.accessToken);
  const aiAdapter = getCandidateAiAdapter();
  const modelId = aiAdapter.providerName === 'openai' ? (process.env.AFRIA_RECRUIT_OPENAI_MODEL?.trim() || 'openai-config-missing') : 'candidate-os-deterministic-v1';
  const service = new CandidateOptimizerService({
    candidateRepository: getCandidateRepository(userClient),
    jobRepository: new LiveJobRepository(userClient),
    aiAdapter,
    decisionStore: new LiveDecisionStore(admin),
    reviewStore: new LiveHumanReviewStore(admin),
    modelId,
    modelProvider: aiAdapter.providerName,
  });
  return { auth, service };
}
