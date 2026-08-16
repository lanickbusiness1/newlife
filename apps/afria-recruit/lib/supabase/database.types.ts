// Candidate OS schema snapshot generated from the canonical AfrIA Recruit Supabase project on 2026-08-16.
// It is intentionally scoped to the tables consumed by apps/afria-recruit in this vertical slice.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type CandidateRow = {
  created_at: string;
  current_country_code: string | null;
  embedding_model: string | null;
  home_country_code: string | null;
  id: string;
  professional_title: string | null;
  profile_embedding: string | null;
  profile_status: string;
  public_code: string;
  scope: string;
  source_channel: string;
  summary: string | null;
  updated_at: string;
  user_id: string;
  verification_summary_status: string;
  visibility: string;
  years_experience: number | null;
};

type ExperienceRow = {
  candidate_id: string;
  claim_status: string;
  country_code: string | null;
  created_at: string;
  description: string | null;
  end_date: string | null;
  id: string;
  is_current: boolean;
  occupation_id: string | null;
  organization_name: string;
  sector_id: string | null;
  source_document_id: string | null;
  start_date: string | null;
  title: string;
};

type EducationRow = {
  candidate_id: string;
  claim_status: string;
  completion_date: string | null;
  country_code: string | null;
  created_at: string;
  field_of_study: string | null;
  id: string;
  institution_name: string;
  qualification: string;
  source_document_id: string | null;
  start_date: string | null;
};

type SkillRow = {
  candidate_id: string;
  created_at: string;
  evidence_status: string;
  last_used_year: number | null;
  proficiency: string;
  skill_id: string;
  years_experience: number | null;
};

type LanguageRow = {
  candidate_id: string;
  evidence_status: string;
  language_code: string;
  level: string;
};

type CertificationRow = {
  candidate_id: string;
  claim_status: string;
  created_at: string;
  credential_reference: string | null;
  expires_at: string | null;
  id: string;
  issued_at: string | null;
  issuer: string | null;
  name: string;
  source_document_id: string | null;
};

type PreferencesRow = {
  available_from: string | null;
  candidate_id: string;
  compensation_currency: string | null;
  contract_types: string[];
  minimum_compensation: number | null;
  preferred_country_codes: string[];
  preferred_work_modes: string[];
  updated_at: string;
  willing_field_rotation: boolean;
  willing_to_relocate: boolean;
  work_authorization_summary: string | null;
};

type VerificationRow = {
  candidate_id: string;
  claim_reference: string | null;
  claim_type: string;
  created_at: string;
  evidence_hash: string | null;
  expires_at: string | null;
  id: string;
  notes: string | null;
  source_type: string | null;
  source_uri: string | null;
  status: string;
  updated_at: string;
  verified_at: string | null;
  verified_by: string | null;
};

type DocumentRow = {
  candidate_id: string;
  document_type: string;
  id: string;
  mime_type: string | null;
  parsed_claim_status: string;
  parsed_data: Json;
  parsing_status: string;
  sha256: string | null;
  storage_bucket: string;
  storage_path: string;
  uploaded_at: string;
};

type SkillCatalogRow = {
  active: boolean;
  category: string;
  code: string;
  created_at: string;
  embedding: string | null;
  embedding_model: string | null;
  id: string;
  name_en: string;
  name_fr: string;
};

type TableDef<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      candidates: TableDef<CandidateRow>;
      candidate_experiences: TableDef<ExperienceRow>;
      candidate_educations: TableDef<EducationRow>;
      candidate_skills: TableDef<SkillRow>;
      candidate_languages: TableDef<LanguageRow>;
      candidate_certifications: TableDef<CertificationRow>;
      candidate_preferences: TableDef<PreferencesRow>;
      verifications: TableDef<VerificationRow>;
      candidate_documents: TableDef<DocumentRow>;
      skills: TableDef<SkillCatalogRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type CandidateDbRow = CandidateRow;
export type CandidateExperienceDbRow = ExperienceRow;
export type CandidateEducationDbRow = EducationRow;
export type CandidateSkillDbRow = SkillRow;
export type CandidateLanguageDbRow = LanguageRow;
export type CandidateCertificationDbRow = CertificationRow;
export type CandidatePreferencesDbRow = PreferencesRow;
export type CandidateVerificationDbRow = VerificationRow;
export type CandidateDocumentDbRow = DocumentRow;
