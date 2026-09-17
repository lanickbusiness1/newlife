begin;

create table if not exists public.wa_contacts (
  id text primary key,
  organization_id text not null,
  phone_e164 text not null,
  phone_redacted text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, phone_e164)
);

create table if not exists public.wa_conversations (
  id text primary key,
  organization_id text not null,
  contact_id text not null references public.wa_contacts(id) on delete restrict,
  state text not null default 'NEW',
  automated_followups_sent integer not null default 0 check (automated_followups_sent between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wa_messages_meta (
  id text primary key,
  organization_id text not null,
  conversation_id text not null references public.wa_conversations(id) on delete restrict,
  external_message_id text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  content_sha256 text not null,
  status text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, external_message_id)
);

create table if not exists public.wa_qualification_snapshots (
  id text primary key,
  organization_id text not null,
  conversation_id text not null references public.wa_conversations(id) on delete restrict,
  snapshot jsonb not null,
  score jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.wa_appointments (
  id text primary key,
  organization_id text not null,
  conversation_id text not null references public.wa_conversations(id) on delete restrict,
  window text not null,
  status text not null default 'proposed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wa_handoffs (
  id text primary key,
  organization_id text not null,
  conversation_id text not null references public.wa_conversations(id) on delete restrict,
  phone_redacted text not null,
  reason text not null,
  qualification jsonb not null,
  score jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.wa_opt_outs (
  id text primary key,
  organization_id text not null,
  contact_id text not null references public.wa_contacts(id) on delete restrict,
  source_message_id text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, contact_id)
);

create table if not exists public.wa_audit_events (
  id text primary key,
  organization_id text not null,
  event_type text not null,
  conversation_id text references public.wa_conversations(id) on delete restrict,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wa_contacts_org_idx on public.wa_contacts (organization_id);
create index if not exists wa_conversations_org_idx on public.wa_conversations (organization_id, state);
create index if not exists wa_messages_meta_conv_idx on public.wa_messages_meta (organization_id, conversation_id, created_at desc);
create index if not exists wa_qualification_conv_idx on public.wa_qualification_snapshots (organization_id, conversation_id, created_at desc);
create index if not exists wa_handoffs_org_idx on public.wa_handoffs (organization_id, created_at desc);
create index if not exists wa_audit_org_idx on public.wa_audit_events (organization_id, created_at desc);

alter table public.wa_contacts enable row level security;
alter table public.wa_conversations enable row level security;
alter table public.wa_messages_meta enable row level security;
alter table public.wa_qualification_snapshots enable row level security;
alter table public.wa_appointments enable row level security;
alter table public.wa_handoffs enable row level security;
alter table public.wa_opt_outs enable row level security;
alter table public.wa_audit_events enable row level security;

comment on table public.wa_messages_meta is 'Metadata-only message evidence; no full WhatsApp body is stored here.';
comment on table public.wa_audit_events is 'Append-only governance/evidence events at application contract level.';

commit;
