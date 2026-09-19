create schema if not exists genesis_guinea_state;

revoke all on schema genesis_guinea_state from public;
revoke all on schema genesis_guinea_state from anon;
revoke all on schema genesis_guinea_state from authenticated;
grant usage on schema genesis_guinea_state to service_role;

create table genesis_guinea_state.government_events (
  event_id text primary key,
  source_system text not null,
  institution_id text not null,
  service_id text not null,
  actor_type text not null check (actor_type in ('citizen','business','agent','system')),
  occurred_at timestamptz not null,
  country_code text not null default 'GN' check (country_code = 'GN'),
  correlation_id text not null,
  classification text not null,
  legal_basis text not null,
  data_residency text not null default 'GN' check (data_residency = 'GN'),
  evidence_hash text not null,
  payload jsonb not null default '{}'::jsonb,
  ingested_at timestamptz not null default now()
);

create table genesis_guinea_state.service_assessments (
  assessment_id uuid primary key default gen_random_uuid(),
  service_id text not null,
  correlation_id text not null,
  score integer not null check (score between 0 and 100),
  state text not null check (state in ('HEALTHY','WATCH','CRITICAL')),
  breaches text[] not null default '{}',
  metrics jsonb not null default '{}'::jsonb,
  evidence_refs text[] not null default '{}',
  assessed_at timestamptz not null default now()
);

create table genesis_guinea_state.xroad_observations (
  observation_id uuid primary key default gen_random_uuid(),
  service_id text not null,
  correlation_id text not null,
  status text not null check (status in ('success','failure')),
  latency_ms integer not null check (latency_ms >= 0),
  evidence_ref text not null,
  event_id text references genesis_guinea_state.government_events(event_id) on delete restrict,
  observed_at timestamptz not null default now()
);

create table genesis_guinea_state.procurement_assessments (
  assessment_id uuid primary key default gen_random_uuid(),
  procurement_id text not null,
  correlation_id text not null,
  bidder_count integer not null check (bidder_count >= 0),
  estimated_value numeric not null check (estimated_value >= 0),
  awarded_value numeric not null check (awarded_value >= 0),
  procurement_method text not null,
  risk_score integer not null check (risk_score between 0 and 100),
  risk_band text not null check (risk_band in ('LOW','MEDIUM','HIGH')),
  flags text[] not null default '{}',
  interpretation text not null check (interpretation = 'risk_signal_only_human_review_required'),
  evidence_refs text[] not null default '{}',
  event_id text references genesis_guinea_state.government_events(event_id) on delete restrict,
  assessed_at timestamptz not null default now()
);

create table genesis_guinea_state.audit_ledger (
  ledger_id uuid primary key default gen_random_uuid(),
  record_type text not null,
  record_id text not null,
  correlation_id text,
  payload_hash text not null,
  record_payload jsonb not null,
  recorded_at timestamptz not null default now()
);

create index government_events_correlation_idx on genesis_guinea_state.government_events(correlation_id);
create index government_events_service_time_idx on genesis_guinea_state.government_events(service_id, occurred_at desc);
create index service_assessments_service_time_idx on genesis_guinea_state.service_assessments(service_id, assessed_at desc);
create index xroad_observations_service_time_idx on genesis_guinea_state.xroad_observations(service_id, observed_at desc);
create index xroad_observations_event_idx on genesis_guinea_state.xroad_observations(event_id) where event_id is not null;
create index procurement_assessments_procurement_time_idx on genesis_guinea_state.procurement_assessments(procurement_id, assessed_at desc);
create index procurement_assessments_event_idx on genesis_guinea_state.procurement_assessments(event_id) where event_id is not null;
create index audit_ledger_record_idx on genesis_guinea_state.audit_ledger(record_type, record_id, recorded_at desc);
create index audit_ledger_correlation_idx on genesis_guinea_state.audit_ledger(correlation_id, recorded_at desc) where correlation_id is not null;

alter table genesis_guinea_state.government_events enable row level security;
alter table genesis_guinea_state.service_assessments enable row level security;
alter table genesis_guinea_state.xroad_observations enable row level security;
alter table genesis_guinea_state.procurement_assessments enable row level security;
alter table genesis_guinea_state.audit_ledger enable row level security;

revoke all on all tables in schema genesis_guinea_state from public, anon, authenticated;
grant select, insert on all tables in schema genesis_guinea_state to service_role;

create or replace function genesis_guinea_state.deny_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, genesis_guinea_state
as $$
begin
  raise exception 'GENESIS_GN_APPEND_ONLY';
end;
$$;

create or replace function genesis_guinea_state.append_audit_ledger()
returns trigger
language plpgsql
set search_path = pg_catalog, genesis_guinea_state, extensions
as $$
declare
  row_json jsonb := to_jsonb(new);
  record_identifier text;
  correlation_identifier text;
begin
  record_identifier := coalesce(
    row_json ->> 'event_id',
    row_json ->> 'assessment_id',
    row_json ->> 'observation_id',
    'unknown'
  );
  correlation_identifier := row_json ->> 'correlation_id';

  insert into genesis_guinea_state.audit_ledger(
    record_type,
    record_id,
    correlation_id,
    payload_hash,
    record_payload
  ) values (
    tg_table_name,
    record_identifier,
    correlation_identifier,
    encode(digest(convert_to(row_json::text, 'UTF8'), 'sha256'), 'hex'),
    row_json
  );
  return new;
end;
$$;

revoke all on function genesis_guinea_state.deny_mutation() from public, anon, authenticated;
revoke all on function genesis_guinea_state.append_audit_ledger() from public, anon, authenticated;
grant execute on function genesis_guinea_state.deny_mutation() to service_role;
grant execute on function genesis_guinea_state.append_audit_ledger() to service_role;

create trigger government_events_immutable
before update or delete on genesis_guinea_state.government_events
for each row execute function genesis_guinea_state.deny_mutation();
create trigger service_assessments_immutable
before update or delete on genesis_guinea_state.service_assessments
for each row execute function genesis_guinea_state.deny_mutation();
create trigger xroad_observations_immutable
before update or delete on genesis_guinea_state.xroad_observations
for each row execute function genesis_guinea_state.deny_mutation();
create trigger procurement_assessments_immutable
before update or delete on genesis_guinea_state.procurement_assessments
for each row execute function genesis_guinea_state.deny_mutation();
create trigger audit_ledger_immutable
before update or delete on genesis_guinea_state.audit_ledger
for each row execute function genesis_guinea_state.deny_mutation();

create trigger government_events_audit
after insert on genesis_guinea_state.government_events
for each row execute function genesis_guinea_state.append_audit_ledger();
create trigger service_assessments_audit
after insert on genesis_guinea_state.service_assessments
for each row execute function genesis_guinea_state.append_audit_ledger();
create trigger xroad_observations_audit
after insert on genesis_guinea_state.xroad_observations
for each row execute function genesis_guinea_state.append_audit_ledger();
create trigger procurement_assessments_audit
after insert on genesis_guinea_state.procurement_assessments
for each row execute function genesis_guinea_state.append_audit_ledger();
