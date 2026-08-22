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

create table if not exists sovereign_resource_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  external_id text not null,
  resource_type text not null check (resource_type in ('IRON_ORE','BAUXITE','GOLD','LITHIUM','COBALT','COPPER','OTHER')),
  name text not null,
  reserve_quantity numeric(24,6) not null check (reserve_quantity >= 0),
  reserve_unit text not null check (reserve_unit in ('TONNE','KILOGRAM','BARREL','CUBIC_METER')),
  evidence_ids uuid[] not null check (cardinality(evidence_ids) > 0),
  version integer not null default 1 check (version > 0),
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

create table if not exists sovereign_contract_obligations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  concession_id uuid not null,
  clause_id uuid not null,
  external_id text not null,
  responsible_party text not null,
  obligation_type text not null,
  due_date date not null,
  threshold_description text not null,
  performance_status text not null check (performance_status in ('PENDING','DUE','EVIDENCE_SATISFIED','POTENTIAL_BREACH','WAIVED_BY_AUTHORITY')),
  waived_by_identity_id uuid,
  waived_at timestamptz,
  evidence_ids uuid[] not null check (cardinality(evidence_ids) > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id),
  unique (id, tenant_id, project_id),
  foreign key (concession_id, tenant_id, project_id) references sovereign_concessions (id, tenant_id, project_id),
  foreign key (clause_id, tenant_id, project_id) references sovereign_contract_clauses (id, tenant_id, project_id),
  foreign key (waived_by_identity_id, tenant_id) references workforce_identities (id, tenant_id),
  check (
    (performance_status = 'WAIVED_BY_AUTHORITY' and waived_by_identity_id is not null and waived_at is not null)
    or performance_status <> 'WAIVED_BY_AUTHORITY'
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

create table if not exists sovereign_operator_exposures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  external_id text not null,
  operator_id text not null,
  controlled_capacity_ratio numeric(7,6) not null check (controlled_capacity_ratio between 0 and 1),
  critical_node_count integer not null check (critical_node_count >= 0),
  evidence_ids uuid[] not null check (cardinality(evidence_ids) > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id),
  unique (id, tenant_id, project_id),
  foreign key (project_id, tenant_id) references mining_projects (id, tenant_id)
);

create table if not exists sovereign_scenarios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  external_id text not null,
  scenario_type text not null check (scenario_type in ('BASE_CASE','OFFER_A','OFFER_B','COUNTER_PROPOSAL','WALK_AWAY')),
  sovereign_npv numeric(24,4) not null,
  fiscal_take numeric(24,4) not null,
  fx_retention numeric(7,6) not null check (fx_retention between 0 and 1),
  local_value_capture numeric(7,6) not null check (local_value_capture between 0 and 1),
  dependency_score numeric(7,6) not null check (dependency_score between 0 and 1),
  truth_class text not null default 'SIMULATION' check (truth_class = 'SIMULATION'),
  evidence_ids uuid[] not null check (cardinality(evidence_ids) > 0),
  methodology_version text not null default 'B8-v1',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id, methodology_version),
  unique (id, tenant_id, project_id),
  foreign key (project_id, tenant_id) references mining_projects (id, tenant_id)
);

create table if not exists sovereign_national_interest_methodologies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  external_id text not null,
  methodology_version text not null,
  weights jsonb not null check (jsonb_typeof(weights) = 'object'),
  weight_total numeric(8,4) not null check (weight_total = 100),
  go_threshold numeric(7,4) not null check (go_threshold between 0 and 100),
  hold_threshold numeric(7,4) not null check (hold_threshold between 0 and 100),
  state text not null check (state in ('DRAFT','VALIDATED','RETIRED')),
  validated_by_identity_id uuid,
  validated_at timestamptz,
  evidence_ids uuid[] not null check (cardinality(evidence_ids) > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id),
  unique (tenant_id, project_id, methodology_version),
  unique (id, tenant_id, project_id),
  foreign key (project_id, tenant_id) references mining_projects (id, tenant_id),
  foreign key (validated_by_identity_id, tenant_id) references workforce_identities (id, tenant_id),
  check (go_threshold > hold_threshold),
  check (
    (state = 'VALIDATED'
      and validated_by_identity_id is not null
      and validated_at is not null
      and cardinality(evidence_ids) >= 2)
    or state <> 'VALIDATED'
  )
);

create table if not exists sovereign_national_interest_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  external_id text not null,
  methodology_id uuid not null,
  methodology_version text not null,
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
  foreign key (methodology_id, tenant_id, project_id)
    references sovereign_national_interest_methodologies (id, tenant_id, project_id),
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
  decided_by_identity_id uuid not null,
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
create index if not exists sovereign_resource_assets_type_idx
  on sovereign_resource_assets (tenant_id, project_id, resource_type);
create index if not exists sovereign_concessions_operator_idx
  on sovereign_concessions (tenant_id, project_id, operator_id);
create index if not exists sovereign_contract_clauses_type_idx
  on sovereign_contract_clauses (tenant_id, project_id, clause_type, legal_status);
create index if not exists sovereign_contract_obligations_status_idx
  on sovereign_contract_obligations (tenant_id, project_id, performance_status, due_date);
create index if not exists sovereign_corridor_nodes_operator_idx
  on sovereign_corridor_nodes (tenant_id, project_id, operator_id, dependency_ratio desc);
create index if not exists sovereign_operator_exposures_operator_idx
  on sovereign_operator_exposures (tenant_id, project_id, operator_id, controlled_capacity_ratio desc);
create index if not exists sovereign_scenarios_type_idx
  on sovereign_scenarios (tenant_id, project_id, scenario_type, methodology_version);
create index if not exists sovereign_national_interest_methodology_state_idx
  on sovereign_national_interest_methodologies (tenant_id, project_id, state, methodology_version);
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

create or replace function sovereign_require_human_decision_authority()
returns trigger
language plpgsql
as $$
declare
  authority_kind text;
  authority_roles jsonb;
begin
  select identity.kind, identity.roles
    into authority_kind, authority_roles
  from workforce_identities identity
  where identity.id = new.decided_by_identity_id
    and identity.tenant_id = new.tenant_id;

  if authority_kind is distinct from 'HUMAN' then
    raise exception 'sovereign decisions require a human decision authority';
  end if;
  if not (coalesce(authority_roles, '[]'::jsonb) ? 'SOVEREIGN_DECISION_APPROVER') then
    raise exception 'human decision authority lacks SOVEREIGN_DECISION_APPROVER role';
  end if;
  return new;
end
$$;

drop trigger if exists sovereign_decision_human_authority on sovereign_decision_records;
create trigger sovereign_decision_human_authority
before insert on sovereign_decision_records
for each row execute function sovereign_require_human_decision_authority();

create or replace function sovereign_require_human_methodology_approver()
returns trigger
language plpgsql
as $$
declare
  authority_kind text;
  authority_roles jsonb;
begin
  if new.state <> 'VALIDATED' then
    return new;
  end if;

  select identity.kind, identity.roles
    into authority_kind, authority_roles
  from workforce_identities identity
  where identity.id = new.validated_by_identity_id
    and identity.tenant_id = new.tenant_id;

  if authority_kind is distinct from 'HUMAN' then
    raise exception 'validated sovereign methodology requires a human methodology approver';
  end if;
  if not (coalesce(authority_roles, '[]'::jsonb) ? 'SOVEREIGN_METHODOLOGY_APPROVER') then
    raise exception 'human methodology approver lacks SOVEREIGN_METHODOLOGY_APPROVER role';
  end if;
  return new;
end
$$;

drop trigger if exists sovereign_methodology_human_authority on sovereign_national_interest_methodologies;
create trigger sovereign_methodology_human_authority
before insert or update on sovereign_national_interest_methodologies
for each row execute function sovereign_require_human_methodology_approver();

create or replace function sovereign_reject_validated_methodology_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.state = 'VALIDATED' then
    raise exception 'validated sovereign methodology is immutable; create a new methodology version';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

drop trigger if exists sovereign_methodology_immutable on sovereign_national_interest_methodologies;
create trigger sovereign_methodology_immutable
before update or delete on sovereign_national_interest_methodologies
for each row execute function sovereign_reject_validated_methodology_mutation();

-- Evidence IDs are arrays because one sovereign object can depend on many heterogeneous artifacts.
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

create or replace function sovereign_validate_methodology_evidence()
returns trigger
language plpgsql
as $$
declare
  bad_count integer;
begin
  if new.state <> 'VALIDATED' then
    return new;
  end if;

  select count(*) into bad_count
  from unnest(new.evidence_ids) evidence_id
  left join sovereign_evidence_artifacts evidence
    on evidence.id = evidence_id
   and evidence.tenant_id = new.tenant_id
   and evidence.project_id = new.project_id
  where evidence.id is null or evidence.truth_class <> 'FACT';

  if bad_count <> 0 then
    raise exception 'validated sovereign methodology requires FACT evidence only';
  end if;
  return new;
end
$$;

create or replace function sovereign_validate_assessment_methodology()
returns trigger
language plpgsql
as $$
declare
  methodology_state text;
  persisted_version text;
  persisted_weights jsonb;
begin
  select methodology.state, methodology.methodology_version, methodology.weights
    into methodology_state, persisted_version, persisted_weights
  from sovereign_national_interest_methodologies methodology
  where methodology.id = new.methodology_id
    and methodology.tenant_id = new.tenant_id
    and methodology.project_id = new.project_id;

  if methodology_state is distinct from 'VALIDATED' then
    raise exception 'National Interest assessment requires a validated methodology';
  end if;
  if persisted_version is distinct from new.methodology_version then
    raise exception 'National Interest assessment methodology version mismatch';
  end if;
  if persisted_weights is distinct from new.weights then
    raise exception 'National Interest assessment weights differ from approved methodology';
  end if;
  return new;
end
$$;

drop trigger if exists sovereign_assessment_methodology_gate on sovereign_national_interest_assessments;
create trigger sovereign_assessment_methodology_gate
before insert or update on sovereign_national_interest_assessments
for each row execute function sovereign_validate_assessment_methodology();

create or replace function sovereign_validate_scenario_evidence()
returns trigger
language plpgsql
as $$
declare
  bad_count integer;
begin
  select count(*) into bad_count
  from unnest(new.evidence_ids) evidence_id
  left join sovereign_evidence_artifacts evidence
    on evidence.id = evidence_id
   and evidence.tenant_id = new.tenant_id
   and evidence.project_id = new.project_id
  where evidence.id is null or evidence.truth_class <> 'SIMULATION';

  if bad_count <> 0 then
    raise exception 'sovereign scenarios require SIMULATION evidence only';
  end if;
  return new;
end
$$;

do $$
declare
  table_name text;
  lineage_tables text[] := array[
    'sovereign_resource_assets',
    'sovereign_concessions',
    'sovereign_contract_clauses',
    'sovereign_contract_obligations',
    'sovereign_corridor_nodes',
    'sovereign_operator_exposures',
    'sovereign_scenarios',
    'sovereign_national_interest_methodologies',
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

drop trigger if exists sovereign_methodology_fact_evidence on sovereign_national_interest_methodologies;
create trigger sovereign_methodology_fact_evidence
before insert or update on sovereign_national_interest_methodologies
for each row execute function sovereign_validate_methodology_evidence();

drop trigger if exists sovereign_scenario_simulation_evidence on sovereign_scenarios;
create trigger sovereign_scenario_simulation_evidence
before insert or update on sovereign_scenarios
for each row execute function sovereign_validate_scenario_evidence();

-- Forced tenant isolation on every B8 table.
do $$
declare
  table_name text;
  tables text[] := array[
    'sovereign_evidence_artifacts',
    'sovereign_resource_assets',
    'sovereign_concessions',
    'sovereign_contract_clauses',
    'sovereign_contract_obligations',
    'sovereign_corridor_nodes',
    'sovereign_operator_exposures',
    'sovereign_scenarios',
    'sovereign_national_interest_methodologies',
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
