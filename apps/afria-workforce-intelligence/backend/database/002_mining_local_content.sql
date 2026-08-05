create table if not exists mining_projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_code text not null,
  name text not null,
  state text not null default 'ACTIVE' check (state in ('DRAFT','ACTIVE','SUSPENDED','CLOSED')),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_code)
);

create table if not exists local_content_legal_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  source_key text not null,
  title text not null,
  source_url text not null check (source_url ~ '^https://'),
  jurisdiction text not null,
  source_version text not null,
  effective_from date not null,
  effective_to date,
  sha256 text not null,
  verification_state text not null default 'DRAFT'
    check (verification_state in ('DRAFT','VERIFIED','REVOKED')),
  verified_by_identity_id uuid references workforce_identities(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, source_key, source_version),
  check (effective_to is null or effective_to >= effective_from),
  check (
    (verification_state = 'VERIFIED' and verified_by_identity_id is not null and verified_at is not null)
    or verification_state <> 'VERIFIED'
  )
);

create table if not exists local_content_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null references mining_projects(id),
  legal_source_id uuid not null references local_content_legal_sources(id),
  workforce_category text not null
    check (workforce_category in ('ALL','UNSKILLED','SKILLED','MIDDLE_MANAGEMENT','SENIOR_MANAGEMENT')),
  threshold_percent numeric(5,2) not null check (threshold_percent between 0 and 100),
  state text not null default 'DRAFT' check (state in ('DRAFT','VALIDATED','RETIRED')),
  version integer not null default 1 check (version > 0),
  validated_by_identity_id uuid references workforce_identities(id),
  validation_evidence_id uuid references workforce_evidence(id),
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (state = 'VALIDATED' and validated_by_identity_id is not null and validation_evidence_id is not null and validated_at is not null)
    or state <> 'VALIDATED'
  )
);

create table if not exists mining_workforce_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null references mining_projects(id),
  employee_id uuid not null references workforce_employees(id),
  role_code text not null,
  workforce_category text not null
    check (workforce_category in ('UNSKILLED','SKILLED','MIDDLE_MANAGEMENT','SENIOR_MANAGEMENT')),
  nationality_status text not null check (nationality_status in ('NATIONAL','EXPATRIATE')),
  monthly_cost_usd numeric(14,2) not null default 0 check (monthly_cost_usd >= 0),
  state text not null default 'ACTIVE' check (state in ('DRAFT','ACTIVE','SUSPENDED','EXITED')),
  source_evidence_id uuid references workforce_evidence(id),
  valid_from date not null default current_date,
  valid_to date,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);

create table if not exists local_content_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null references mining_projects(id),
  rule_id uuid not null references local_content_rules(id),
  status text not null check (status in ('COMPLIANT','NON_COMPLIANT','NO_DATA')),
  assessment_type text not null default 'ADVISORY' check (assessment_type = 'ADVISORY'),
  national_count integer not null check (national_count >= 0),
  expatriate_count integer not null check (expatriate_count >= 0),
  total_count integer not null check (total_count >= 0),
  ratio_percent numeric(5,2),
  threshold_percent numeric(5,2) not null check (threshold_percent between 0 and 100),
  gap_percent numeric(5,2),
  evidence_coverage_percent numeric(5,2) not null check (evidence_coverage_percent between 0 and 100),
  evaluated_by_identity_id uuid references workforce_identities(id),
  evaluated_at timestamptz not null default now(),
  check (total_count = national_count + expatriate_count),
  check (
    (status = 'NO_DATA' and ratio_percent is null and gap_percent is null)
    or (status <> 'NO_DATA' and ratio_percent is not null and gap_percent is not null)
  )
);

create table if not exists succession_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null references mining_projects(id),
  expatriate_workforce_record_id uuid not null references mining_workforce_records(id),
  national_candidate_employee_id uuid not null references workforce_employees(id),
  required_skills jsonb not null default '[]'::jsonb,
  candidate_skills jsonb not null default '[]'::jsonb,
  readiness_percent numeric(5,2) not null default 0 check (readiness_percent between 0 and 100),
  target_date date not null,
  state text not null default 'DRAFT'
    check (state in ('DRAFT','APPROVED','IN_PROGRESS','COMPLETED','CANCELLED')),
  version integer not null default 1 check (version > 0),
  approved_by_identity_id uuid references workforce_identities(id),
  approval_evidence_id uuid references workforce_evidence(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(required_skills) = 'array'),
  check (jsonb_array_length(required_skills) > 0),
  check (jsonb_typeof(candidate_skills) = 'array'),
  check (
    (state in ('APPROVED','IN_PROGRESS','COMPLETED') and approved_by_identity_id is not null and approval_evidence_id is not null and approved_at is not null)
    or state in ('DRAFT','CANCELLED')
  )
);

create index if not exists mining_projects_tenant_state_idx
  on mining_projects (tenant_id, state);
create index if not exists local_content_sources_tenant_jurisdiction_idx
  on local_content_legal_sources (tenant_id, jurisdiction, verification_state);
create index if not exists local_content_rules_project_category_idx
  on local_content_rules (tenant_id, project_id, workforce_category, state);
create index if not exists mining_workforce_project_category_idx
  on mining_workforce_records (tenant_id, project_id, workforce_category, nationality_status, state);
create index if not exists local_content_assessments_history_idx
  on local_content_assessments (tenant_id, project_id, rule_id, evaluated_at desc);
create index if not exists succession_plans_project_state_idx
  on succession_plans (tenant_id, project_id, state, target_date);

alter table mining_projects enable row level security;
alter table local_content_legal_sources enable row level security;
alter table local_content_rules enable row level security;
alter table mining_workforce_records enable row level security;
alter table local_content_assessments enable row level security;
alter table succession_plans enable row level security;

create policy tenant_isolation_mining_projects on mining_projects
using (tenant_id::text = current_setting('app.tenant_id', true));
create policy tenant_isolation_local_content_sources on local_content_legal_sources
using (tenant_id::text = current_setting('app.tenant_id', true));
create policy tenant_isolation_local_content_rules on local_content_rules
using (tenant_id::text = current_setting('app.tenant_id', true));
create policy tenant_isolation_mining_workforce_records on mining_workforce_records
using (tenant_id::text = current_setting('app.tenant_id', true));
create policy tenant_isolation_local_content_assessments on local_content_assessments
using (tenant_id::text = current_setting('app.tenant_id', true));
create policy tenant_isolation_succession_plans on succession_plans
using (tenant_id::text = current_setting('app.tenant_id', true));
