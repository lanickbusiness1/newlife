create table if not exists local_content_module_controls (
  tenant_id uuid primary key references workforce_tenants(id),
  module_enabled boolean not null default true,
  emergency_stop boolean not null default false,
  stop_reason text,
  stopped_by_identity_id uuid,
  stopped_at timestamptz,
  resumed_by_identity_id uuid,
  resumed_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (stopped_by_identity_id, tenant_id)
    references workforce_identities (id, tenant_id),
  foreign key (resumed_by_identity_id, tenant_id)
    references workforce_identities (id, tenant_id),
  check (
    (emergency_stop = false)
    or (stop_reason is not null and stopped_by_identity_id is not null and stopped_at is not null)
  ),
  check (resumed_at is null or stopped_at is null or resumed_at >= stopped_at)
);

create table if not exists local_content_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  actor_identity_id uuid not null,
  actor_kind text not null check (actor_kind in ('HUMAN','AGENT','SERVICE')),
  action text not null,
  aggregate_id text not null,
  correlation_id text not null,
  payload jsonb not null default '{}'::jsonb,
  previous_hash text check (previous_hash is null or previous_hash ~ '^[0-9A-Fa-f]{64}$'),
  event_hash text not null check (event_hash ~ '^[0-9A-Fa-f]{64}$'),
  occurred_at timestamptz not null default now(),
  foreign key (project_id, tenant_id)
    references mining_projects (id, tenant_id),
  foreign key (actor_identity_id, tenant_id)
    references workforce_identities (id, tenant_id),
  check (jsonb_typeof(payload) = 'object')
);

create table if not exists local_content_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  actor_identity_id uuid not null,
  http_method text not null check (http_method in ('POST','PUT','PATCH','DELETE')),
  route text not null,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9._:-]{8,200}$'),
  request_sha256 text not null check (request_sha256 ~ '^[0-9A-Fa-f]{64}$'),
  response_status integer not null check (response_status between 200 and 299),
  response_headers jsonb not null default '{}'::jsonb,
  response_body text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  foreign key (actor_identity_id, tenant_id)
    references workforce_identities (id, tenant_id),
  unique (tenant_id, actor_identity_id, http_method, route, idempotency_key),
  check (jsonb_typeof(response_headers) = 'object'),
  check (expires_at > created_at)
);

create index if not exists local_content_audit_tenant_project_time_idx
  on local_content_audit_events (tenant_id, project_id, occurred_at desc);
create index if not exists local_content_audit_tenant_action_idx
  on local_content_audit_events (tenant_id, action, occurred_at desc);
create index if not exists local_content_idempotency_expiry_idx
  on local_content_idempotency_keys (tenant_id, expires_at);
create index if not exists local_content_controls_stop_idx
  on local_content_module_controls (emergency_stop, updated_at desc);

create or replace function reject_local_content_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'local_content_audit_events is append-only'
    using errcode = '23000';
end;
$$;

drop trigger if exists local_content_audit_append_only on local_content_audit_events;
create trigger local_content_audit_append_only
before update or delete on local_content_audit_events
for each row execute function reject_local_content_audit_mutation();

alter table local_content_module_controls enable row level security;
alter table local_content_audit_events enable row level security;
alter table local_content_idempotency_keys enable row level security;

alter table local_content_module_controls force row level security;
alter table local_content_audit_events force row level security;
alter table local_content_idempotency_keys force row level security;

drop policy if exists tenant_isolation_local_content_controls on local_content_module_controls;
create policy tenant_isolation_local_content_controls on local_content_module_controls
for all
using (tenant_id::text = current_setting('app.tenant_id', true))
with check (tenant_id::text = current_setting('app.tenant_id', true));

drop policy if exists tenant_isolation_local_content_audit on local_content_audit_events;
create policy tenant_isolation_local_content_audit on local_content_audit_events
for all
using (tenant_id::text = current_setting('app.tenant_id', true))
with check (tenant_id::text = current_setting('app.tenant_id', true));

drop policy if exists tenant_isolation_local_content_idempotency on local_content_idempotency_keys;
create policy tenant_isolation_local_content_idempotency on local_content_idempotency_keys
for all
using (tenant_id::text = current_setting('app.tenant_id', true))
with check (tenant_id::text = current_setting('app.tenant_id', true));

alter table workforce_identities force row level security;
alter table workforce_employees force row level security;
alter table workforce_evidence force row level security;
alter table workforce_events force row level security;

drop policy if exists tenant_isolation_identities on workforce_identities;
create policy tenant_isolation_identities on workforce_identities
for all
using (tenant_id::text = current_setting('app.tenant_id', true))
with check (tenant_id::text = current_setting('app.tenant_id', true));

drop policy if exists tenant_isolation_employees on workforce_employees;
create policy tenant_isolation_employees on workforce_employees
for all
using (tenant_id::text = current_setting('app.tenant_id', true))
with check (tenant_id::text = current_setting('app.tenant_id', true));

drop policy if exists tenant_isolation_evidence on workforce_evidence;
create policy tenant_isolation_evidence on workforce_evidence
for all
using (tenant_id::text = current_setting('app.tenant_id', true))
with check (tenant_id::text = current_setting('app.tenant_id', true));

drop policy if exists tenant_isolation_events on workforce_events;
create policy tenant_isolation_events on workforce_events
for all
using (tenant_id::text = current_setting('app.tenant_id', true))
with check (tenant_id::text = current_setting('app.tenant_id', true));
