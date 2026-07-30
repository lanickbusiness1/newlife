alter table users
  add column if not exists password_hash text,
  add column if not exists is_active boolean not null default true,
  add column if not exists failed_login_count integer not null default 0,
  add column if not exists locked_until timestamptz,
  add column if not exists last_login_at timestamptz;

create table if not exists refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash char(64) not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by_ip inet,
  user_agent text
);

create index if not exists idx_refresh_tokens_user on refresh_tokens(user_id);
create index if not exists idx_refresh_tokens_active on refresh_tokens(expires_at) where revoked_at is null;

insert into roles (code, name)
values
  ('APPLICANT', 'Demandeur'),
  ('RECEPTION_OFFICER', 'Agent de réception'),
  ('INSTRUCTOR', 'Agent instructeur'),
  ('SUPERVISOR', 'Superviseur'),
  ('DECISION_AUTHORITY', 'Autorité décisionnaire'),
  ('AUDITOR', 'Auditeur'),
  ('SYSTEM_ADMIN', 'Administrateur système')
on conflict (code) do nothing;

insert into permissions (code, name)
values
  ('DOSSIER_CREATE', 'Créer un dossier'),
  ('DOSSIER_READ_OWN', 'Lire ses propres dossiers'),
  ('DOSSIER_READ_ALL', 'Lire tous les dossiers'),
  ('DOSSIER_UPDATE_OWN', 'Modifier ses dossiers brouillons'),
  ('DOSSIER_ASSIGN', 'Affecter un dossier'),
  ('DOCUMENT_CREATE', 'Ajouter un document'),
  ('DOCUMENT_READ', 'Lire les documents'),
  ('DECISION_PREPARE', 'Préparer une décision'),
  ('DECISION_VALIDATE', 'Valider une décision finale'),
  ('AUDIT_READ', 'Consulter le journal d audit')
on conflict (code) do nothing;