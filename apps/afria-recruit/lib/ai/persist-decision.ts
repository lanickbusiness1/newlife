import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../supabase/database.types.js';

export type CanonicalDecisionType =
  | 'cv_parse'
  | 'assessment_score'
  | 'interview_score'
  | 'match_recommendation'
  | 'eligibility_gate';

const allowedDecisionTypes = new Set<CanonicalDecisionType>([
  'cv_parse',
  'assessment_score',
  'interview_score',
  'match_recommendation',
  'eligibility_gate',
]);

export interface ValidatedDecisionInput {
  candidateId: string;
  jobId?: string | null;
  decisionType: CanonicalDecisionType;
  inputHash: string;
  output: Json;
  promptVersion: string;
  modelId: string;
  modelProvider: string;
}

export type AiDecisionInsert = Database['public']['Tables']['ai_decisions']['Insert'];

export function buildDecisionInsert(input: ValidatedDecisionInput): AiDecisionInsert {
  if (!allowedDecisionTypes.has(input.decisionType)) throw new Error('Unsupported decision type');
  if (!/^[a-f0-9]{64}$/i.test(input.inputHash)) throw new Error('Input hash must be SHA-256');
  if (!input.modelId.trim()) throw new Error('Model id is required');
  if (!input.modelProvider.trim()) throw new Error('Model provider is required');

  return {
    candidate_id: input.candidateId,
    job_id: input.jobId ?? null,
    decision_type: input.decisionType,
    input_hash: input.inputHash,
    output: input.output,
    prompt_version: input.promptVersion,
    model_id: input.modelId,
    model_provider: input.modelProvider,
    human_review_required: true,
  };
}

export async function persistValidatedDecision(
  client: SupabaseClient<Database>,
  input: ValidatedDecisionInput,
): Promise<string> {
  const payload = buildDecisionInsert(input);
  const { data, error } = await client
    .from('ai_decisions')
    .insert(payload)
    .select('id')
    .single();
  if (error || !data) throw new Error('Decision persistence failed safely');
  return data.id;
}
