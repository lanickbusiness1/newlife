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

insert into roles (code, name, scope)
values
  ('APPLICANT', 'Demandeur', 'APPLICANT'),
  ('RECEPTION_OFFICER', 'Agent de réception', 'APDP_INTERNAL'),
  ('INSTRUCTOR', 'Agent instructeur', 'APDP_INTERNAL'),
  ('SUPERVISOR', 'Superviseur', 'APDP_INTERNAL'),
  ('DECISION_AUTHORITY', 'Autorité décisionnaire', 'APDP_INTERNAL'),
  ('AUDITOR', 'Auditeur', 'APDP_INTERNAL'),
  ('SYSTEM_ADMIN', 'Administrateur système', 'SYSTEM')
on conflict (code) do update set name = excluded.name, scope = excluded.scope;

insert into permissions (code, description)
values
  ('DOSSIER_CREATE', 'Créer un dossier'),
  ('DOSSIER_READ_OWN', 'Lire ses propres dossiers'),
  ('DOSSIER_READ_ALL', 'Lire tous les dossiers'),
  ('DOSSIER_UPDATE_OWN', 'Modifier ses dossiers brouillons'),
  ('DOSSIER_TRANSITION', 'Exécuter une transition de workflow autorisée'),
  ('DOSSIER_ASSIGN', 'Affecter un dossier'),
  ('ASSIGNMENT_READ', 'Consulter les affectations'),
  ('DOCUMENT_CREATE', 'Ajouter un document'),
  ('DOCUMENT_READ', 'Lire les documents'),
  ('DECISION_PREPARE', 'Préparer une décision'),
  ('DECISION_READ', 'Consulter les décisions'),
  ('DECISION_VALIDATE', 'Valider une décision finale'),
  ('AUDIT_READ', 'Consulter le journal d audit'),
  ('STATISTICS_READ', 'Consulter les statistiques institutionnelles')
on conflict (code) do update set description = excluded.description;

with grants(role_code, permission_code) as (
  values
    ('APPLICANT','DOSSIER_CREATE'),
    ('APPLICANT','DOSSIER_READ_OWN'),
    ('APPLICANT','DOSSIER_UPDATE_OWN'),
    ('APPLICANT','DOCUMENT_CREATE'),
    ('APPLICANT','DOCUMENT_READ'),
    ('RECEPTION_OFFICER','DOSSIER_READ_ALL'),
    ('RECEPTION_OFFICER','DOSSIER_TRANSITION'),
    ('RECEPTION_OFFICER','DOCUMENT_READ'),
    ('RECEPTION_OFFICER','ASSIGNMENT_READ'),
    ('INSTRUCTOR','DOSSIER_READ_ALL'),
    ('INSTRUCTOR','DOSSIER_TRANSITION'),
    ('INSTRUCTOR','DOCUMENT_READ'),
    ('INSTRUCTOR','DECISION_PREPARE'),
    ('INSTRUCTOR','DECISION_READ'),
    ('SUPERVISOR','DOSSIER_READ_ALL'),
    ('SUPERVISOR','DOSSIER_TRANSITION'),
    ('SUPERVISOR','DOSSIER_ASSIGN'),
    ('SUPERVISOR','ASSIGNMENT_READ'),
    ('SUPERVISOR','DOCUMENT_READ'),
    ('SUPERVISOR','DECISION_PREPARE'),
    ('SUPERVISOR','DECISION_READ'),
    ('SUPERVISOR','AUDIT_READ'),
    ('SUPERVISOR','STATISTICS_READ'),
    ('DECISION_AUTHORITY','DOSSIER_READ_ALL'),
    ('DECISION_AUTHORITY','DOCUMENT_READ'),
    ('DECISION_AUTHORITY','DECISION_READ'),
    ('DECISION_AUTHORITY','DECISION_VALIDATE'),
    ('DECISION_AUTHORITY','AUDIT_READ'),
    ('DECISION_AUTHORITY','STATISTICS_READ'),
    ('AUDITOR','DOSSIER_READ_ALL'),
    ('AUDITOR','DOCUMENT_READ'),
    ('AUDITOR','ASSIGNMENT_READ'),
    ('AUDITOR','DECISION_READ'),
    ('AUDITOR','AUDIT_READ'),
    ('AUDITOR','STATISTICS_READ')
)
insert into role_permissions(role_id, permission_id)
select r.id, p.id
from grants g
join roles r on r.code = g.role_code
join permissions p on p.code = g.permission_code
on conflict do nothing;

insert into role_permissions(role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.code = 'SYSTEM_ADMIN'
on conflict do nothing;
