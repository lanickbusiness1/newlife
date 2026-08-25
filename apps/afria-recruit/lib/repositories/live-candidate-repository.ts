import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/database.types.js';
import type { CandidateContext, CandidateRepository } from './candidate-context.js';
import { parseCandidateAtsProfile } from './readiness-source-parser.js';

function assertOk<T>(result: { data: T | null; error: unknown }, label: string): T {
  if (result.error || result.data === null) throw new Error(`Candidate repository read failed: ${label}`);
  return result.data;
}

export class LiveCandidateRepository implements CandidateRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async loadContext(candidateId: string): Promise<CandidateContext> {
    const candidateResult = await this.client
      .from('candidates')
      .select('id,user_id,public_code,professional_title,summary,current_country_code,home_country_code,years_experience,verification_summary_status')
      .eq('id', candidateId)
      .single();
    const candidate = assertOk(candidateResult, 'candidate');

    const [experiencesResult, educationsResult, skillsResult, languagesResult, certificationsResult, preferencesResult, verificationsResult, documentsResult] = await Promise.all([
      this.client.from('candidate_experiences').select('*').eq('candidate_id', candidateId),
      this.client.from('candidate_educations').select('*').eq('candidate_id', candidateId),
      this.client.from('candidate_skills').select('*').eq('candidate_id', candidateId),
      this.client.from('candidate_languages').select('*').eq('candidate_id', candidateId),
      this.client.from('candidate_certifications').select('*').eq('candidate_id', candidateId),
      this.client.from('candidate_preferences').select('*').eq('candidate_id', candidateId).maybeSingle(),
      this.client.from('verifications').select('*').eq('candidate_id', candidateId),
      this.client.from('candidate_documents').select('id,document_type,mime_type,parsing_status,parsed_claim_status,uploaded_at,candidate_id,parsed_data,sha256,storage_bucket,storage_path').eq('candidate_id', candidateId),
    ]);

    const experiences = assertOk(experiencesResult, 'experiences');
    const educations = assertOk(educationsResult, 'educations');
    const candidateSkills = assertOk(skillsResult, 'skills');
    const languages = assertOk(languagesResult, 'languages');
    const certifications = assertOk(certificationsResult, 'certifications');
    const verifications = assertOk(verificationsResult, 'verifications');
    const documents = assertOk(documentsResult, 'documents');
    if (preferencesResult.error) throw new Error('Candidate repository read failed: preferences');

    const skillIds = candidateSkills.map((row) => row.skill_id);
    const skillNames = new Map<string, string>();
    if (skillIds.length) {
      const catalogResult = await this.client.from('skills').select('id,name_fr,name_en').in('id', skillIds);
      const catalog = assertOk(catalogResult, 'skill catalog');
      for (const skill of catalog) skillNames.set(skill.id, skill.name_fr || skill.name_en);
    }

    return {
      candidate: {
        id: candidate.id,
        userId: candidate.user_id,
        publicCode: candidate.public_code,
        professionalTitle: candidate.professional_title,
        summary: candidate.summary,
        currentCountry: candidate.current_country_code,
        homeCountry: candidate.home_country_code,
        yearsExperience: candidate.years_experience,
        verificationStatus: candidate.verification_summary_status,
      },
      experiences: experiences.map((row) => ({
        id: row.id,
        organization: row.organization_name,
        title: row.title,
        country: row.country_code,
        startDate: row.start_date,
        endDate: row.end_date,
        isCurrent: row.is_current,
        description: row.description,
        evidenceStatus: row.claim_status,
        sourceDocumentId: row.source_document_id,
      })),
      educations: educations.map((row) => ({
        id: row.id,
        institution: row.institution_name,
        qualification: row.qualification,
        fieldOfStudy: row.field_of_study,
        country: row.country_code,
        startDate: row.start_date,
        completionDate: row.completion_date,
        evidenceStatus: row.claim_status,
        sourceDocumentId: row.source_document_id,
      })),
      skills: candidateSkills.map((row) => ({
        skillId: row.skill_id,
        name: skillNames.get(row.skill_id) ?? null,
        proficiency: row.proficiency,
        yearsExperience: row.years_experience,
        lastUsedYear: row.last_used_year,
        evidenceStatus: row.evidence_status,
      })),
      languages: languages.map((row) => ({ code: row.language_code, level: row.level, evidenceStatus: row.evidence_status })),
      certifications: certifications.map((row) => ({
        id: row.id,
        name: row.name,
        issuer: row.issuer,
        issuedAt: row.issued_at,
        expiresAt: row.expires_at,
        evidenceStatus: row.claim_status,
        sourceDocumentId: row.source_document_id,
      })),
      preferences: preferencesResult.data ? {
        availableFrom: preferencesResult.data.available_from,
        contractTypes: preferencesResult.data.contract_types,
        preferredCountries: preferencesResult.data.preferred_country_codes,
        preferredWorkModes: preferencesResult.data.preferred_work_modes,
        willingToRelocate: preferencesResult.data.willing_to_relocate,
        willingFieldRotation: preferencesResult.data.willing_field_rotation,
        workAuthorizationSummary: preferencesResult.data.work_authorization_summary,
      } : null,
      verifications: verifications.map((row) => ({
        id: row.id,
        claimType: row.claim_type,
        claimReference: row.claim_reference,
        status: row.status,
        verifiedAt: row.verified_at,
        expiresAt: row.expires_at,
        hasEvidenceHash: Boolean(row.evidence_hash),
      })),
      documents: documents.map((row) => ({
        id: row.id,
        documentType: row.document_type,
        mimeType: row.mime_type,
        parsingStatus: row.parsing_status,
        parsedClaimStatus: row.parsed_claim_status,
        uploadedAt: row.uploaded_at,
        synthetic: false,
        atsProfile: parseCandidateAtsProfile(row.parsed_data),
      })),
    };
  }
}
