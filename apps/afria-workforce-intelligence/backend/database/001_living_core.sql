create extension if not exists pgcrypto;

create table if not exists workforce_tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  jurisdiction text not null,
  created_at timestamptz not null default now()
);

create table if not exists workforce_identities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  kind text not null check (kind in ('HUMAN','AGENT','SERVICE')),
  display_name text not null,
  roles jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists workforce_employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  identity_id uuid not null references workforce_identities(id),
  employee_number text not null,
  state text not null check (state in ('DRAFT','ACTIVE','SUSPENDED','EXITED')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  unique (tenant_id, employee_number)
);

create table if not exists workforce_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  kind text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  actor_identity_id uuid not null references workforce_identities(id),
  payload jsonb not null default '{}'::jsonb,
  sha256 text not null,
  created_at timestamptz not null default now()
);

create table if not exists workforce_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  actor_identity_id uuid not null references workforce_identities(id),
  evidence_id uuid references workforce_evidence(id),
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

alter table workforce_identities enable row level security;
alter table workforce_employees enable row level security;
alter table workforce_evidence enable row level security;
alter table workforce_events enable row level security;

create policy tenant_isolation_identities on workforce_identities
using (tenant_id::text = current_setting('app.tenant_id', true));
create policy tenant_isolation_employees on workforce_employees
using (tenant_id::text = current_setting('app.tenant_id', true));
create policy tenant_isolation_evidence on workforce_evidence
using (tenant_id::text = current_setting('app.tenant_id', true));
create policy tenant_isolation_events on workforce_events
using (tenant_id::text = current_setting('app.tenant_id', true));
