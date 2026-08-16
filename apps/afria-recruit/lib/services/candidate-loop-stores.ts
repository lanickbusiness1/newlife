import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../supabase/database.types.js';
import { buildStartedApplicationInsert, type ApplicationEventStore, type ApplicationRecord, type ApplicationStore, type ReviewGateStore } from './application-service.js';
import type { ExternalProcessingConsentStore } from './candidate-optimizer-service.js';
import type { ConsentStore, InterviewRecord, InterviewStore } from './interview-service.js';

export class LiveConsentStore implements ConsentStore {
  constructor(private readonly admin: SupabaseClient<Database>) {}
  async createProcessingConsent(input: { candidateId: string; jobId: string; policyVersion: string }) {
    const { data, error } = await this.admin.from('consents').insert({
      candidate_id: input.candidateId,
      job_id: input.jobId,
      purpose: 'platform_processing',
      data_categories: ['interview_practice_text'],
      policy_version: input.policyVersion,
      status: 'granted',
      evidence: { scope: 'interview_practice_only', raw_answer_retention: 'none' } as Json,
    }).select('id').single();
    if (error || !data) throw new Error('Consent persistence failed safely');
    return data.id;
  }
}

export class LiveExternalProcessingConsentStore implements ExternalProcessingConsentStore {
  constructor(private readonly admin: SupabaseClient<Database>) {}
  async createCvRewriteConsent(input: { candidateId: string; jobId: string; policyVersion: string }) {
    const { data, error } = await this.admin.from('consents').insert({
      candidate_id: input.candidateId,
      job_id: input.jobId,
      purpose: 'platform_processing',
      data_categories: ['cv_rewrite_text'],
      policy_version: input.policyVersion,
      status: 'granted',
      evidence: {
        scope: 'candidate_cv_rewrite_only',
        external_processing: true,
        provider_payload_retention: 'store_false',
      } as Json,
    }).select('id').single();
    if (error || !data) throw new Error('Consent persistence failed safely');
    return data.id;
  }
}

export class LiveInterviewStore implements InterviewStore {
  constructor(private readonly admin: SupabaseClient<Database>) {}
  async create(input: { candidateId: string; jobId: string; consentId: string; modelProvider: string; modelId: string; promptVersion: string }) {
    const { data, error } = await this.admin.from('ai_interviews').insert({
      candidate_id: input.candidateId,
      job_id: input.jobId,
      consent_id: input.consentId,
      status: 'in_progress',
      model_provider: input.modelProvider,
      model_id: input.modelId,
      prompt_version: input.promptVersion,
      started_at: new Date().toISOString(),
      evaluation_status: 'pending',
    }).select('id').single();
    if (error || !data) throw new Error('Interview persistence failed safely');
    return data.id;
  }
  async findOwned(id: string, candidateId: string): Promise<InterviewRecord | null> {
    const { data, error } = await this.admin.from('ai_interviews').select('id,candidate_id,job_id,status').eq('id', id).eq('candidate_id', candidateId).maybeSingle();
    if (error) throw new Error('Interview lookup failed safely');
    if (!data?.job_id) return null;
    return { id: data.id, candidateId: data.candidate_id, jobId: data.job_id, status: data.status };
  }
  async markEvaluationPending(id: string) {
    const { error } = await this.admin.from('ai_interviews').update({ status: 'evaluation_pending', evaluation_status: 'ai_scored' }).eq('id', id);
    if (error) throw new Error('Interview status update failed safely');
  }
}

function artifactKind(output: Json): string | null {
  return output && typeof output === 'object' && !Array.isArray(output) && typeof output.artifactKind === 'string' ? output.artifactKind : null;
}

export class LiveReviewGateStore implements ReviewGateStore {
  constructor(private readonly admin: SupabaseClient<Database>) {}
  async isConfirmedVariantReview(decisionId: string, candidateId: string, jobId: string) {
    const { data: decision, error: decisionError } = await this.admin.from('ai_decisions').select('id,candidate_id,job_id,output').eq('id', decisionId).eq('candidate_id', candidateId).eq('job_id', jobId).maybeSingle();
    if (decisionError) throw new Error('Review gate lookup failed safely');
    if (!decision || artifactKind(decision.output) !== 'candidate_cv_variants_v1') return false;
    const { data: review, error: reviewError } = await this.admin.from('human_reviews').select('id').eq('ai_decision_id', decisionId).eq('outcome', 'confirm').limit(1).maybeSingle();
    if (reviewError) throw new Error('Review gate lookup failed safely');
    return Boolean(review);
  }
}

export class LiveApplicationStore implements ApplicationStore {
  constructor(private readonly admin: SupabaseClient<Database>) {}
  async createStarted(input: { candidateId: string; jobId: string }): Promise<ApplicationRecord> {
    const { data: existing, error: existingError } = await this.admin.from('applications').select('id,candidate_id,job_id,status').eq('candidate_id', input.candidateId).eq('job_id', input.jobId).maybeSingle();
    if (existingError) throw new Error('Application lookup failed safely');
    if (existing) return { id: existing.id, candidateId: existing.candidate_id, jobId: existing.job_id, status: existing.status };
    const { data, error } = await this.admin.from('applications').insert(buildStartedApplicationInsert(input.candidateId, input.jobId)).select('id,candidate_id,job_id,status').single();
    if (error || !data) throw new Error('Application package persistence failed safely');
    return { id: data.id, candidateId: data.candidate_id, jobId: data.job_id, status: data.status };
  }
  async findOwned(id: string, candidateId: string): Promise<ApplicationRecord | null> {
    const { data, error } = await this.admin.from('applications').select('id,candidate_id,job_id,status').eq('id', id).eq('candidate_id', candidateId).maybeSingle();
    if (error) throw new Error('Application lookup failed safely');
    return data ? { id: data.id, candidateId: data.candidate_id, jobId: data.job_id, status: data.status } : null;
  }
}

export class LiveApplicationEventStore implements ApplicationEventStore {
  constructor(private readonly admin: SupabaseClient<Database>) {}
  async recordUnconfirmedOutcome(input: { applicationId: string; currentStatus: string; actorUserId: string; reportedOutcome: string }) {
    const { data, error } = await this.admin.from('application_events').insert({
      application_id: input.applicationId,
      from_status: input.currentStatus,
      to_status: input.currentStatus,
      actor_user_id: input.actorUserId,
      reason: 'candidate_reported_outcome',
      metadata: { reportedOutcome: input.reportedOutcome, confirmationStatus: 'unconfirmed', source: 'candidate' } as Json,
    }).select('id').single();
    if (error || !data) throw new Error('Application outcome persistence failed safely');
    return data.id;
  }
}
