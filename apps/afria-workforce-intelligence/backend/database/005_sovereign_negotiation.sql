-- B8 Sovereign Negotiation Kernel — synthetic sandbox persistence layer.
-- No real concession, legal opinion, national score weighting or sovereign decision is defaulted here.

create table if not exists sovereign_evidence_artifacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  external_id text not null,
  source_uri text not null,
  sha256 text not null check (sha256 ~ '^[A-Fa-f0-9]{64}$'),
  observed_at timestamptz not null,
  truth_class text not null check (truth_class in ('FACT','HYPOTHESIS','SIMULATION')),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id),
  unique (id, tenant_id, project_id),
  foreign key (project_id, tenant_id) references mining_projects (id, tenant_id)
);

create table if not exists sovereign_concessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  external_id text not null,
  name text not null,
  operator_id text not null,
  effective_from date not null,
  effective_to date not null,
  evidence_ids uuid[] not null check (cardinality(evidence_ids) > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id),
  unique (id, tenant_id, project_id),
  foreign key (project_id, tenant_id) references mining_projects (id, tenant_id),
  check (effective_to >= effective_from)
);

create table if not exists sovereign_contract_clauses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  concession_id uuid not null,
  external_id text not null,
  clause_type text not null,
  clause_text text not null,
  legal_status text not null check (legal_status in ('ADVISORY_EXTRACTED','HUMAN_VALIDATED','REJECTED')),
  validated_by_identity_id uuid,
  validated_at timestamptz,
  evidence_ids uuid[] not null check (cardinality(evidence_ids) > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id),
  unique (id, tenant_id, project_id),
  foreign key (concession_id, tenant_id, project_id) references sovereign_concessions (id, tenant_id, project_id),
  foreign key (validated_by_identity_id, tenant_id) references workforce_identities (id, tenant_id),
  check (
    (legal_status = 'HUMAN_VALIDATED' and validated_by_identity_id is not null and validated_at is not null)
    or legal_status <> 'HUMAN_VALIDATED'
  )
);

create table if not exists sovereign_corridor_nodes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  external_id text not null,
  node_type text not null check (node_type in ('MINE','RAIL','ROAD','PORT_TERMINAL','BERTH','WAREHOUSE','MARKET')),
  name text not null,
  operator_id text not null,
  dependency_ratio numeric(7,6) not null check (dependency_ratio between 0 and 1),
  evidence_ids uuid[] not null check (cardinality(evidence_ids) > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id),
  unique (id, tenant_id, project_id),
  foreign key (project_id, tenant_id) references mining_projects (id, tenant_id)
);

create table if not exists sovereign_national_interest_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  external_id text not null,
  methodology_version text not null default 'B8-v1',
  weights jsonb not null check (jsonb_typeof(weights) = 'object'),
  weight_total numeric(8,4) not null check (weight_total = 100),
  scores jsonb not null check (jsonb_typeof(scores) = 'object'),
  weighted_score numeric(7,4) check (weighted_score between 0 and 100),
  decision text not null check (decision in ('GO','HOLD','NO_GO','INSUFFICIENT_EVIDENCE')),
  eliminatory_red_flags text[] not null default '{}',
  evidence_count integer not null check (evidence_count >= 0),
  evidence_ids uuid[] not null default '{}',
  assessed_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id, methodology_version),
  unique (id, tenant_id, project_id),
  foreign key (project_id, tenant_id) references mining_projects (id, tenant_id),
  check (
    (decision = 'INSUFFICIENT_EVIDENCE' and weighted_score is null and evidence_count = 0 and cardinality(evidence_ids) = 0)
    or
    (decision <> 'INSUFFICIENT_EVIDENCE' and weighted_score is not null and evidence_count > 0 and cardinality(evidence_ids) > 0)
  ),
  check (decision = 'NO_GO' or cardinality(eliminatory_red_flags) = 0)
);

create table if not exists sovereign_decision_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  external_id text not null,
  assessment_id uuid not null,
  decision text not null check (decision in ('GO','HOLD','NO_GO','INSUFFICIENT_EVIDENCE')),
  rationale text not null,
  decided_by_identity_id uuid,
  evidence_ids uuid[] not null check (cardinality(evidence_ids) > 0),
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id),
  unique (id, tenant_id, project_id),
  foreign key (assessment_id, tenant_id, project_id) references sovereign_national_interest_assessments (id, tenant_id, project_id),
  foreign key (decided_by_identity_id, tenant_id) references workforce_identities (id, tenant_id)
);

create index if not exists sovereign_evidence_artifacts_project_idx
  on sovereign_evidence_artifacts (tenant_id, project_id, observed_at desc);
create index if not exists sovereign_concessions_operator_idx
  on sovereign_concessions (tenant_id, project_id, operator_id);
create index if not exists sovereign_contract_clauses_type_idx
  on sovereign_contract_clauses (tenant_id, project_id, clause_type, legal_status);
create index if not exists sovereign_corridor_nodes_operator_idx
  on sovereign_corridor_nodes (tenant_id, project_id, operator_id, dependency_ratio desc);
create index if not exists sovereign_national_interest_decision_idx
  on sovereign_national_interest_assessments (tenant_id, project_id, decision, assessed_at desc);
create index if not exists sovereign_decision_records_assessment_idx
  on sovereign_decision_records (tenant_id, project_id, assessment_id, decided_at desc);

create or replace function sovereign_reject_decision_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'sovereign decision records are append-only';
end
$$;

drop trigger if exists sovereign_decision_append_only on sovereign_decision_records;
create trigger sovereign_decision_append_only
before update or delete on sovereign_decision_records
for each row execute function sovereign_reject_decision_mutation();

-- Evidence IDs are arrays because one assessment can depend on many heterogeneous artifacts.
-- Enforce that every referenced evidence UUID resolves inside the same tenant/project.
create or replace function sovereign_validate_evidence_lineage()
returns trigger
language plpgsql
as $$
declare
  evidence_id uuid;
begin
  foreach evidence_id in array new.evidence_ids loop
    if not exists (
      select 1
      from sovereign_evidence_artifacts evidence
      where evidence.id = evidence_id
        and evidence.tenant_id = new.tenant_id
        and evidence.project_id = new.project_id
    ) then
      raise exception 'sovereign evidence lineage violation for evidence %', evidence_id;
    end if;
  end loop;
  return new;
end
$$;

do $$
declare
  table_name text;
  lineage_tables text[] := array[
    'sovereign_concessions',
    'sovereign_contract_clauses',
    'sovereign_corridor_nodes',
    'sovereign_national_interest_assessments',
    'sovereign_decision_records'
  ];
begin
  foreach table_name in array lineage_tables loop
    execute format('drop trigger if exists %I on %I', 'validate_evidence_lineage_' || table_name, table_name);
    execute format(
      'create trigger %I before insert or update on %I for each row execute function sovereign_validate_evidence_lineage()',
      'validate_evidence_lineage_' || table_name,
      table_name
    );
  end loop;
end
$$;

-- Forced tenant isolation on every B8 table.
do $$
declare
  table_name text;
  tables text[] := array[
    'sovereign_evidence_artifacts',
    'sovereign_concessions',
    'sovereign_contract_clauses',
    'sovereign_corridor_nodes',
    'sovereign_national_interest_assessments',
    'sovereign_decision_records'
  ];
begin
  foreach table_name in array tables loop
    execute format('alter table %I enable row level security', table_name);
    execute format('alter table %I force row level security', table_name);
    execute format('drop policy if exists %I on %I', 'tenant_isolation_' || table_name, table_name);
    execute format(
      'create policy %I on %I for all using (tenant_id::text = current_setting(''app.tenant_id'', true)) with check (tenant_id::text = current_setting(''app.tenant_id'', true))',
      'tenant_isolation_' || table_name,
      table_name
    );
  end loop;
end
$$;
