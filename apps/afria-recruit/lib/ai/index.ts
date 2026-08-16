import type { Environment } from '../supabase/config.js';
import type { CandidateAiAdapter } from './contracts.js';
import { DeterministicCandidateAiAdapter } from './deterministic-adapter.js';
import { OpenAICandidateAiAdapter } from './openai-adapter.js';

export function getCandidateAiAdapter(env: Environment = process.env): CandidateAiAdapter {
  if (env.AFRIA_RECRUIT_AI_PROVIDER?.toLowerCase() !== 'openai') {
    return new DeterministicCandidateAiAdapter();
  }
  const apiKey = env.OPENAI_API_KEY?.trim();
  const model = env.AFRIA_RECRUIT_OPENAI_MODEL?.trim();
  if (!apiKey || !model) return new DeterministicCandidateAiAdapter();
  return new OpenAICandidateAiAdapter(apiKey, model);
}

export * from './contracts.js';
