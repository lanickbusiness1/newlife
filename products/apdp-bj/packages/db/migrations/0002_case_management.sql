create table roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  scope text not null check (scope in ('APPLICANT','APDP_INTERNAL','SYSTEM')),
  created_at timestamptz not null default now()
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null,
  created_at timestamptz not null default now()
);

create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table user_roles (
  user_id uuid not null references users(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  primary key (user_id, role_id)
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  storage_key text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  sha256 char(64) not null,
  version integer not null default 1,
  uploaded_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers(id) on delete cascade,
  assigned_to uuid not null references users(id),
  assigned_by uuid not null references users(id),
  assigned_at timestamptz not null default now(),
  released_at timestamptz,
  reason text
);

create table decisions (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers(id) on delete cascade,
  decision_type text not null,
  status text not null check (status in ('DRAFT','PENDING_VALIDATION','VALIDATED','SIGNED','NOTIFIED')),
  reasoning text not null,
  conditions jsonb not null default '[]'::jsonb,
  prepared_by uuid not null references users(id),
  validated_by uuid references users(id),
  validated_at timestamptz,
  signed_hash char(64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status in ('VALIDATED','SIGNED','NOTIFIED') and validated_by is not null and validated_at is not null) or status in ('DRAFT','PENDING_VALIDATION'))
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id),
  actor_type text not null check (actor_type in ('APPLICANT','APDP_INTERNAL','AI_AGENT','SYSTEM')),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  dossier_id uuid references dossiers(id) on delete set null,
  request_id text,
  ip_address inet,
  user_agent text,
  before_data jsonb,
  after_data jsonb,
  evidence_hash char(64),
  created_at timestamptz not null default now()
);

create index idx_documents_dossier on documents(dossier_id, created_at);
create index idx_assignments_active on assignments(dossier_id) where released_at is null;
create index idx_decisions_dossier on decisions(dossier_id, created_at);
create index idx_audit_dossier_created on audit_log(dossier_id, created_at);
create index idx_audit_resource on audit_log(resource_type, resource_id);