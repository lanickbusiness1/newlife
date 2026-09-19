create extension if not exists pgcrypto;

create table organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  registration_number text,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  user_type text not null check (user_type in ('APPLICANT','APDP_INTERNAL')),
  created_at timestamptz not null default now()
);

create table dossiers (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  organization_id uuid references organizations(id),
  applicant_id uuid not null references users(id),
  assigned_to uuid references users(id),
  request_type text not null,
  status text not null default 'DRAFT',
  version integer not null default 1,
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table dossier_events (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers(id) on delete cascade,
  actor_id uuid references users(id),
  event_type text not null,
  from_status text,
  to_status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table evidence_ledger (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers(id) on delete cascade,
  evidence_type text not null,
  source_type text not null,
  source_id text,
  input_hash char(64),
  output_hash char(64),
  confidence numeric(5,4),
  human_validated boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_dossiers_status on dossiers(status);
create index idx_dossier_events_dossier_created on dossier_events(dossier_id, created_at);
create index idx_evidence_dossier on evidence_ledger(dossier_id);
