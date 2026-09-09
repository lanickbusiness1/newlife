-- V4-DEC-016 — GENESIS Living Intellectual Capitalization Loop™
-- Private persistence ledger for Chat/signal → canonical/book/product execution proof.
-- This schema is intentionally NOT part of Supabase Data API exposed schemas.

begin;

create extension if not exists pgcrypto with schema extensions;

create schema if not exists genesis_capitalization;
comment on schema genesis_capitalization is
  'Private V4-DEC-016 ledger for governed signal, editorial gate, capitalization plan, execution receipt and proof-chain persistence.';

-- Fail closed for browser/public roles. Server-side persistence is explicitly scoped to service_role.
revoke all on schema genesis_capitalization from public, anon, authenticated;
grant usage on schema genesis_capitalization to service_role;

create table if not exists genesis_capitalization.chat_signals (
  chat_signal_id uuid primary key default extensions.gen_random_uuid(),
  tenant_id text not null,
  signal_key text not null,
  conversation_id text not null,
  source_ref text not null,
  source_timestamp timestamptz not null,
  verification_status text not null check (verification_status in ('unverified', 'verified', 'decision_validated')),
  confidence numeric(5,4) not null check (confidence >= 0 and confidence <= 1),
  content text not null check (length(btrim(content)) > 0),
  normalized_content text not null check (length(btrim(normalized_content)) > 0),
  fingerprint text not null,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  canonical_decision_ref text,
  book_section_hint text,
  product_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(product_refs) = 'array'),
  tags jsonb not null default '[]'::jsonb check (jsonb_typeof(tags) = 'array'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint uq_genesis_capitalization_chat_signal_key unique (tenant_id, signal_key),
  constraint uq_genesis_capitalization_chat_fingerprint unique (tenant_id, fingerprint)
);

create table if not exists genesis_capitalization.editorial_gate_evaluations (
  editorial_gate_evaluation_id uuid primary key default extensions.gen_random_uuid(),
  tenant_id text not null,
  evaluation_key text not null,
  chat_signal_id uuid not null,
  status text not null check (status in ('APPROVED', 'REJECTED', 'DUPLICATE')),
  verification_score numeric(5,4) not null check (verification_score >= 0 and verification_score <= 1),
  durability_score numeric(5,4) not null check (durability_score >= 0 and durability_score <= 1),
  strategic_relevance_score numeric(5,4) not null check (strategic_relevance_score >= 0 and strategic_relevance_score <= 1),
  editorial_value_score numeric(5,4) not null check (editorial_value_score >= 0 and editorial_value_score <= 1),
  execution_relevance_score numeric(5,4) not null check (execution_relevance_score >= 0 and execution_relevance_score <= 1),
  total_score numeric(5,4) not null check (total_score >= 0 and total_score <= 1),
  book_candidate boolean not null default false,
  execution_candidate boolean not null default false,
  reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(reasons) = 'array'),
  required_gates jsonb not null default '[]'::jsonb check (jsonb_typeof(required_gates) = 'array'),
  evaluated_at timestamptz not null default now(),
  constraint fk_genesis_capitalization_gate_signal
    foreign key (chat_signal_id) references genesis_capitalization.chat_signals(chat_signal_id)
    on update restrict on delete restrict,
  constraint uq_genesis_capitalization_gate_key unique (tenant_id, evaluation_key)
);

create table if not exists genesis_capitalization.capitalization_plans (
  capitalization_plan_id uuid primary key default extensions.gen_random_uuid(),
  tenant_id text not null,
  plan_key text not null,
  chat_signal_id uuid not null,
  editorial_gate_evaluation_id uuid not null,
  status text not null check (status in ('READY', 'BLOCKED')),
  reme_status text not null check (reme_status in ('PENDING_EXECUTION_EVIDENCE', 'NOT_ELIGIBLE', 'CANDIDATE', 'PROMOTED')),
  blockers jsonb not null default '[]'::jsonb check (jsonb_typeof(blockers) = 'array'),
  created_at timestamptz not null default now(),
  constraint fk_genesis_capitalization_plan_signal
    foreign key (chat_signal_id) references genesis_capitalization.chat_signals(chat_signal_id)
    on update restrict on delete restrict,
  constraint fk_genesis_capitalization_plan_gate
    foreign key (editorial_gate_evaluation_id) references genesis_capitalization.editorial_gate_evaluations(editorial_gate_evaluation_id)
    on update restrict on delete restrict,
  constraint uq_genesis_capitalization_plan_key unique (tenant_id, plan_key)
);

create table if not exists genesis_capitalization.capitalization_targets (
  capitalization_target_id uuid primary key default extensions.gen_random_uuid(),
  tenant_id text not null,
  target_key text not null,
  capitalization_plan_id uuid not null,
  target_type text not null check (target_type in ('notion_canonical', 'genesis_v4', 'book_manuscript', 'product_execution', 'reme')),
  destination_ref text not null,
  action text not null check (action in ('append', 'link', 'create_execution_item', 'promote_candidate')),
  required_evidence_type text not null check (required_evidence_type in ('connector_receipt', 'repository_receipt', 'database_receipt')),
  idempotency_key text not null,
  status text not null default 'PLANNED' check (status in ('PLANNED', 'EXECUTED', 'FAILED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_genesis_capitalization_target_plan
    foreign key (capitalization_plan_id) references genesis_capitalization.capitalization_plans(capitalization_plan_id)
    on update restrict on delete restrict,
  constraint uq_genesis_capitalization_target_key unique (tenant_id, target_key),
  constraint uq_genesis_capitalization_idempotency unique (tenant_id, idempotency_key)
);

create table if not exists genesis_capitalization.execution_receipts (
  execution_receipt_id uuid primary key default extensions.gen_random_uuid(),
  tenant_id text not null,
  capitalization_target_id uuid not null,
  receipt_ref text not null,
  executed_at timestamptz not null,
  status text not null check (status in ('success', 'failed')),
  artifact_hash text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  recorded_at timestamptz not null default now(),
  constraint fk_genesis_capitalization_receipt_target
    foreign key (capitalization_target_id) references genesis_capitalization.capitalization_targets(capitalization_target_id)
    on update restrict on delete restrict,
  constraint uq_genesis_capitalization_receipt_ref unique (tenant_id, receipt_ref),
  constraint uq_genesis_capitalization_receipt_target unique (tenant_id, capitalization_target_id)
);

create table if not exists genesis_capitalization.proof_chains (
  proof_chain_id uuid primary key default extensions.gen_random_uuid(),
  tenant_id text not null,
  proof_key text not null,
  capitalization_plan_id uuid not null,
  status text not null check (status in ('COMPLETE', 'PARTIAL', 'FAILED')),
  next_gate text not null check (next_gate in ('REME_CANDIDATE', 'EXECUTION_REPAIR')),
  successful_target_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(successful_target_ids) = 'array'),
  failed_target_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(failed_target_ids) = 'array'),
  missing_target_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(missing_target_ids) = 'array'),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  closed_at timestamptz not null default now(),
  constraint fk_genesis_capitalization_proof_plan
    foreign key (capitalization_plan_id) references genesis_capitalization.capitalization_plans(capitalization_plan_id)
    on update restrict on delete restrict,
  constraint uq_genesis_capitalization_proof_key unique (tenant_id, proof_key)
);

create index if not exists idx_genesis_capitalization_chat_source_timestamp
  on genesis_capitalization.chat_signals (tenant_id, source_timestamp desc);
create index if not exists idx_genesis_capitalization_gate_signal
  on genesis_capitalization.editorial_gate_evaluations (chat_signal_id);
create index if not exists idx_genesis_capitalization_plan_signal
  on genesis_capitalization.capitalization_plans (chat_signal_id);
create index if not exists idx_genesis_capitalization_target_plan
  on genesis_capitalization.capitalization_targets (capitalization_plan_id);
create index if not exists idx_genesis_capitalization_receipt_target
  on genesis_capitalization.execution_receipts (capitalization_target_id);
create index if not exists idx_genesis_capitalization_proof_plan
  on genesis_capitalization.proof_chains (capitalization_plan_id);

alter table genesis_capitalization.chat_signals enable row level security;
alter table genesis_capitalization.editorial_gate_evaluations enable row level security;
alter table genesis_capitalization.capitalization_plans enable row level security;
alter table genesis_capitalization.capitalization_targets enable row level security;
alter table genesis_capitalization.execution_receipts enable row level security;
alter table genesis_capitalization.proof_chains enable row level security;

revoke all on all tables in schema genesis_capitalization from public, anon, authenticated;
grant select, insert, update on all tables in schema genesis_capitalization to service_role;

alter default privileges in schema genesis_capitalization
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema genesis_capitalization
  grant select, insert, update on tables to service_role;

commit;
