create schema if not exists genesis_corridor;

revoke all on schema genesis_corridor from public;
revoke all on schema genesis_corridor from anon;
revoke all on schema genesis_corridor from authenticated;
grant usage on schema genesis_corridor to service_role;

create table if not exists genesis_corridor.corridors (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  corridor_key text not null,
  name text not null,
  asset_class text not null check (asset_class in ('pipeline','port','refinery','terminal','rail','road','multimodal','energy_hub','industrial_corridor','other')),
  countries text[] not null check (cardinality(countries) > 0),
  status text not null default 'active' check (status in ('planned','active','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, corridor_key)
);

create table if not exists genesis_corridor.evidence_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  evidence_ref text not null,
  source_uri text not null,
  source_type text not null check (source_type in ('official','government','regulator','company','multilateral','news','research','other')),
  title text,
  publisher text,
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  authority_tier smallint not null default 3 check (authority_tier between 1 and 5),
  content_hash text,
  verification_status text not null default 'registered' check (verification_status in ('registered','verified','contradicted','superseded')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, evidence_ref)
);

create table if not exists genesis_corridor.corridor_evidence (
  corridor_id uuid not null references genesis_corridor.corridors(id) on delete restrict,
  evidence_id uuid not null references genesis_corridor.evidence_sources(id) on delete restrict,
  relation_type text not null default 'supports' check (relation_type in ('supports','contradicts','context','supersedes')),
  created_at timestamptz not null default now(),
  primary key (corridor_id, evidence_id, relation_type)
);

create table if not exists genesis_corridor.assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  corridor_id uuid not null references genesis_corridor.corridors(id) on delete restrict,
  engine_asset_id text not null default 'GEN-V4-CORRIDOR-VALUE-CAPTURE-001',
  engine_version text not null,
  as_of timestamptz not null,
  input_hash text not null,
  currency varchar(3) not null check (currency = upper(currency)),
  total_economic_value numeric(24,6) not null check (total_economic_value > 0),
  classified_value numeric(24,6) not null check (classified_value >= 0),
  unclassified_value numeric(24,6) not null check (unclassified_value >= 0),
  local_retained_value numeric(24,6) not null check (local_retained_value >= 0),
  value_coverage_ratio numeric(9,6) not null check (value_coverage_ratio between 0 and 100),
  sovereign_value_capture_ratio numeric(9,6) not null check (sovereign_value_capture_ratio between 0 and 100),
  sovereignty_gap numeric(9,6) not null check (sovereignty_gap between 0 and 100),
  corridor_control numeric(9,6) not null check (corridor_control between 0 and 100),
  feedstock_security numeric(9,6) not null check (feedstock_security between 0 and 100),
  infrastructure_readiness numeric(9,6) not null check (infrastructure_readiness between 0 and 100),
  market_reach numeric(9,6) not null check (market_reach between 0 and 100),
  local_industrialization numeric(9,6) not null check (local_industrialization between 0 and 100),
  governance_risk numeric(9,6) not null check (governance_risk between 0 and 100),
  buyer_access numeric(9,6) not null check (buyer_access between 0 and 100),
  procurement_readiness numeric(9,6) not null check (procurement_readiness between 0 and 100),
  strategic_readiness_score numeric(9,6) not null check (strategic_readiness_score between 0 and 100),
  afriagenesis_opportunity_score numeric(9,6) not null check (afriagenesis_opportunity_score between 0 and 100),
  decision text not null check (decision in ('GO','HOLD','NO_GO')),
  decision_reasons text[] not null default '{}'::text[],
  blockers text[] not null default '{}'::text[],
  opportunity_lanes text[] not null default '{}'::text[],
  score_evidence_snapshot jsonb not null,
  input_payload jsonb not null,
  assessment_payload jsonb not null,
  actor_id text,
  correlation_id uuid,
  audit_id uuid,
  created_at timestamptz not null default now(),
  unique (tenant_id, corridor_id, engine_version, input_hash),
  check (classified_value <= total_economic_value),
  check (local_retained_value <= classified_value),
  check (abs((sovereignty_gap + sovereign_value_capture_ratio) - 100) <= 0.001)
);

create table if not exists genesis_corridor.economic_components (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references genesis_corridor.assessments(id) on delete restrict,
  component_name text not null,
  gross_value numeric(24,6) not null check (gross_value >= 0),
  local_share numeric(9,8) not null check (local_share between 0 and 1),
  evidence_id uuid not null references genesis_corridor.evidence_sources(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (assessment_id, component_name, evidence_id)
);

create table if not exists genesis_corridor.strategic_score_evidence (
  assessment_id uuid not null references genesis_corridor.assessments(id) on delete restrict,
  score_key text not null check (score_key in ('corridorControl','feedstockSecurity','infrastructureReadiness','marketReach','localIndustrialization','governanceRisk','buyerAccess','procurementReadiness')),
  score_value numeric(9,6) not null check (score_value between 0 and 100),
  evidence_id uuid not null references genesis_corridor.evidence_sources(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (assessment_id, score_key, evidence_id)
);

create table if not exists genesis_corridor.reme_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  assessment_id uuid not null references genesis_corridor.assessments(id) on delete restrict,
  event_type text not null,
  event_value text,
  payload jsonb not null default '{}'::jsonb,
  emitted_at timestamptz not null,
  persisted_at timestamptz not null default now()
);

create table if not exists genesis_corridor.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  corridor_id uuid references genesis_corridor.corridors(id) on delete restrict,
  source_uri text not null,
  ingestion_method text not null check (ingestion_method in ('manual','web','api','connector','agent')),
  status text not null check (status in ('started','completed','failed','partial')),
  records_seen integer not null default 0 check (records_seen >= 0),
  records_created integer not null default 0 check (records_created >= 0),
  records_updated integer not null default 0 check (records_updated >= 0),
  content_hash text,
  error_summary text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists corridors_tenant_key_idx on genesis_corridor.corridors (tenant_id, corridor_key);
create index if not exists evidence_sources_tenant_ref_idx on genesis_corridor.evidence_sources (tenant_id, evidence_ref);
create index if not exists corridor_evidence_corridor_idx on genesis_corridor.corridor_evidence (corridor_id);
create index if not exists assessments_corridor_created_idx on genesis_corridor.assessments (corridor_id, created_at desc);
create index if not exists assessments_tenant_decision_idx on genesis_corridor.assessments (tenant_id, decision, created_at desc);
create index if not exists economic_components_assessment_idx on genesis_corridor.economic_components (assessment_id);
create index if not exists strategic_score_evidence_assessment_idx on genesis_corridor.strategic_score_evidence (assessment_id, score_key);
create index if not exists reme_events_assessment_idx on genesis_corridor.reme_events (assessment_id, emitted_at);
create index if not exists ingestion_runs_corridor_started_idx on genesis_corridor.ingestion_runs (corridor_id, started_at desc);

alter table genesis_corridor.corridors enable row level security;
alter table genesis_corridor.evidence_sources enable row level security;
alter table genesis_corridor.corridor_evidence enable row level security;
alter table genesis_corridor.assessments enable row level security;
alter table genesis_corridor.economic_components enable row level security;
alter table genesis_corridor.strategic_score_evidence enable row level security;
alter table genesis_corridor.reme_events enable row level security;
alter table genesis_corridor.ingestion_runs enable row level security;

revoke all on all tables in schema genesis_corridor from public;
revoke all on all tables in schema genesis_corridor from anon;
revoke all on all tables in schema genesis_corridor from authenticated;
grant select, insert on all tables in schema genesis_corridor to service_role;
grant update on genesis_corridor.corridors to service_role;
grant update on genesis_corridor.evidence_sources to service_role;
grant update on genesis_corridor.ingestion_runs to service_role;

alter default privileges in schema genesis_corridor revoke all on tables from public;
alter default privileges in schema genesis_corridor revoke all on tables from anon;
alter default privileges in schema genesis_corridor revoke all on tables from authenticated;

comment on schema genesis_corridor is 'GENESIS V4 V4-DEC-017 private persistence for corridor sovereignty and resource value capture.';
comment on table genesis_corridor.assessments is 'Append-first immutable corridor value-capture assessments produced by GEN-V4-CORRIDOR-VALUE-CAPTURE-001.';
comment on table genesis_corridor.strategic_score_evidence is 'Normalized evidence lineage for each of the eight strategic score dimensions.';
comment on table genesis_corridor.reme_events is 'R.E.M.E-ready events emitted from persisted corridor assessments.';
