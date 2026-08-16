import type { SupabaseClient } from '@supabase/supabase-js';

const allowedDecisionTypes = new Set([
  'candidate_cv_diagnostic_v1',
  'candidate_job_gap_analysis_v1',
  'candidate_achievement_rewrite_v1',
  'candidate_cv_variants_v1',
  'candidate_interview_feedback_v1',
]);

export interface ValidatedDecisionInput {
  candidateId: string;
  decisionType: string;
  inputHash: string;
  output: unknown;
  promptVersion: string;
  modelName: string;
  modelVersion?: string | null;
}

export async function persistValidatedDecision(client: SupabaseClient, input: ValidatedDecisionInput): Promise<string> {
  if (!allowedDecisionTypes.has(input.decisionType)) throw new Error('Unsupported decision type');
  if (!/^[a-f0-9]{64}$/i.test(input.inputHash)) throw new Error('Input hash must be SHA-256');
  const { data, error } = await client
    .from('ai_decisions')
    .insert({
      subject_type: 'candidate',
      subject_id: input.candidateId,
      decision_type: input.decisionType,
      input_hash: input.inputHash,
      output: input.output,
      prompt_version: input.promptVersion,
      model_name: input.modelName,
      model_version: input.modelVersion ?? null,
      human_review_required: true,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error('Decision persistence failed safely');
  return String(data.id);
}
