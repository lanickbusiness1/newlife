import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/database.types.js';
import type { Environment } from '../supabase/config.js';
import type { CandidateRepository } from './candidate-context.js';
import { FixtureCandidateRepository } from './fixture-candidate-repository.js';
import { LiveCandidateRepository } from './live-candidate-repository.js';

export function getCandidateRepository(
  client: SupabaseClient<Database>,
  env: Environment = process.env,
): CandidateRepository {
  if (env.AFRIA_RECRUIT_E2E_MODE === '1') {
    if (env.CI !== 'true') throw new Error('Synthetic fixture mode is restricted to CI');
    return new FixtureCandidateRepository();
  }
  return new LiveCandidateRepository(client);
}
