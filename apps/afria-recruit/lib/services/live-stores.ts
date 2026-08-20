import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/database.types.js';
import { persistValidatedDecision, type ValidatedDecisionInput } from '../ai/persist-decision.js';
import type { JobSpec } from '../domain/types.js';
import type { DecisionStore, HumanReviewStore, JobRepository, OwnedDecision } from './candidate-optimizer-service.js';

export class LiveDecisionStore implements DecisionStore {
  constructor(private readonly admin: SupabaseClient<Database>) {}
  persist(input: ValidatedDecisionInput) { return persistValidatedDecision(this.admin, input); }
  async findOwned(id: string, candidateId: string): Promise<OwnedDecision | null> {
    const { data, error } = await this.admin.from('ai_decisions').select('id,candidate_id,job_id,decision_type,output').eq('id', id).eq('candidate_id', candidateId).maybeSingle();
    if (error) throw new Error('Decision lookup failed safely');
    if (!data || !data.candidate_id) return null;
    return { id: data.id, candidateId: data.candidate_id, jobId: data.job_id, decisionType: data.decision_type, output: data.output };
  }
}

export class LiveHumanReviewStore implements HumanReviewStore {
  constructor(private readonly admin: SupabaseClient<Database>) {}
  async persist(input: { decisionId: string; reviewerId: string; outcome: 'approved' | 'rejected'; rationale: string }): Promise<string> {
    const databaseOutcome = input.outcome === 'approved' ? 'confirm' : 'invalidate';
    const { data, error } = await this.admin.from('human_reviews').insert({ ai_decision_id: input.decisionId, reviewer_id: input.reviewerId, outcome: databaseOutcome, rationale: input.rationale }).select('id').single();
    if (error || !data) throw new Error('Human review persistence failed safely');
    return data.id;
  }
}

export class LiveJobRepository implements JobRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async listOpen(): Promise<JobSpec[]> {
    const { data, error } = await this.client.from('jobs').select('id').eq('status', 'open').order('published_at', { ascending: false }).limit(25);
    if (error) throw new Error('Job listing failed safely');
    const specs = await Promise.all((data ?? []).map((row) => this.getJobSpec(row.id)));
    return specs.filter((value): value is JobSpec => value !== null);
  }

  async getJobSpec(id: string): Promise<JobSpec | null> {
    const [jobResult, skillsResult, languagesResult, locationsResult] = await Promise.all([
      this.client.from('jobs').select('id,title,status').eq('id', id).eq('status', 'open').maybeSingle(),
      this.client.from('job_skills').select('*').eq('job_id', id),
      this.client.from('job_languages').select('*').eq('job_id', id),
      this.client.from('job_locations').select('*').eq('job_id', id),
    ]);
    if (jobResult.error || skillsResult.error || languagesResult.error || locationsResult.error) throw new Error('Job context read failed safely');
    if (!jobResult.data) return null;

    const skillRows = skillsResult.data ?? [];
    const names = new Map<string, string>();
    if (skillRows.length) {
      const { data, error } = await this.client.from('skills').select('id,name_fr,name_en').in('id', skillRows.map((row) => row.skill_id));
      if (error) throw new Error('Job skill catalog read failed safely');
      for (const skill of data ?? []) names.set(skill.id, skill.name_fr || skill.name_en);
    }
    const locations = locationsResult.data ?? [];
    const primaryLocation = locations.find((location) => location.is_primary) ?? locations[0];
    return {
      id: jobResult.data.id,
      title: jobResult.data.title,
      countryCode: primaryLocation?.country_code ?? null,
      requirements: [
        ...skillRows.map((row) => ({ id: `skill:${row.skill_id}`, kind: 'skill' as const, label: names.get(row.skill_id) ?? 'Compétence requise', required: row.required, skillId: row.skill_id, minimumYears: row.minimum_years ?? undefined })),
        ...(languagesResult.data ?? []).map((row) => ({ id: `language:${row.language_code}`, kind: 'language' as const, label: `${row.language_code.toUpperCase()} ${row.minimum_level}`, required: row.required, languageCode: row.language_code, minimumLevel: row.minimum_level })),
      ],
    };
  }
}
