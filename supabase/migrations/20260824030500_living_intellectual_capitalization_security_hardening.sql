-- V4-DEC-016 — security hardening for the Living Intellectual Capitalization Loop™.
-- Additive migration: preserves the first real proof chain while making all future lineage tenant-bound.

begin;

-- Runtime binding fields. Existing bootstrap evidence is retained but explicitly marked legacy.
alter table genesis_capitalization.chat_signals
  add column if not exists binding_hash text;

update genesis_capitalization.chat_signals
set binding_hash = coalesce(binding_hash, 'legacy-unverified:' || chat_signal_id::text)
where binding_hash is null;

alter table genesis_capitalization.chat_signals
  alter column binding_hash set not null;

alter table genesis_capitalization.editorial_gate_evaluations
  add column if not exists signal_fingerprint text,
  add column if not exists signal_binding_hash text;

update genesis_capitalization.editorial_gate_evaluations e
set signal_fingerprint = coalesce(e.signal_fingerprint, s.fingerprint),
    signal_binding_hash = coalesce(e.signal_binding_hash, s.binding_hash)
from genesis_capitalization.chat_signals s
where e.chat_signal_id = s.chat_signal_id
  and e.tenant_id = s.tenant_id
  and (e.signal_fingerprint is null or e.signal_binding_hash is null);

alter table genesis_capitalization.editorial_gate_evaluations
  alter column signal_fingerprint set not null,
  alter column signal_binding_hash set not null;

alter table genesis_capitalization.capitalization_plans
  add column if not exists signal_binding_hash text;

update genesis_capitalization.capitalization_plans p
set signal_binding_hash = coalesce(p.signal_binding_hash, s.binding_hash)
from genesis_capitalization.chat_signals s
where p.chat_signal_id = s.chat_signal_id
  and p.tenant_id = s.tenant_id
  and p.signal_binding_hash is null;

alter table genesis_capitalization.capitalization_plans
  alter column signal_binding_hash set not null;

-- Execution contracts now carry connector allowlists and issued nonces.
alter table genesis_capitalization.capitalization_targets
  add column if not exists execution_nonce text,
  add column if not exists allowed_connector_ids jsonb;

update genesis_capitalization.capitalization_targets
set execution_nonce = coalesce(execution_nonce, 'legacy:' || capitalization_target_id::text),
    allowed_connector_ids = coalesce(
      allowed_connector_ids,
      case
        when target_type = 'product_execution' then '["github","deploybot"]'::jsonb
        else '["notion"]'::jsonb
      end
    )
where execution_nonce is null or allowed_connector_ids is null;

alter table genesis_capitalization.capitalization_targets
  alter column execution_nonce set not null,
  alter column allowed_connector_ids set not null;

alter table genesis_capitalization.capitalization_targets
  drop constraint if exists capitalization_targets_allowed_connector_ids_check;
alter table genesis_capitalization.capitalization_targets
  add constraint capitalization_targets_allowed_connector_ids_check
  check (jsonb_typeof(allowed_connector_ids) = 'array' and jsonb_array_length(allowed_connector_ids) > 0);

-- Preserve bootstrap receipts but make their pre-hardening trust state explicit.
alter table genesis_capitalization.execution_receipts
  add column if not exists connector_id text,
  add column if not exists nonce text,
  add column if not exists attestation text,
  add column if not exists attestation_alg text,
  add column if not exists trust_status text;

update genesis_capitalization.execution_receipts
set connector_id = coalesce(connector_id, 'legacy'),
    nonce = coalesce(nonce, 'legacy:' || execution_receipt_id::text),
    attestation = coalesce(attestation, 'legacy-unverified:' || execution_receipt_id::text),
    attestation_alg = coalesce(attestation_alg, 'legacy-none'),
    trust_status = coalesce(trust_status, 'legacy_unverified'),
    metadata = metadata || jsonb_build_object('legacy_pre_hardening_receipt', true)
where connector_id is null
   or nonce is null
   or attestation is null
   or attestation_alg is null
   or trust_status is null;

alter table genesis_capitalization.execution_receipts
  alter column connector_id set not null,
  alter column nonce set not null,
  alter column attestation set not null,
  alter column attestation_alg set not null,
  alter column trust_status set not null;

alter table genesis_capitalization.execution_receipts
  drop constraint if exists execution_receipts_trust_status_check;
alter table genesis_capitalization.execution_receipts
  add constraint execution_receipts_trust_status_check
  check (trust_status in ('legacy_unverified', 'verified'));

alter table genesis_capitalization.execution_receipts
  drop constraint if exists execution_receipts_verified_attestation_check;
alter table genesis_capitalization.execution_receipts
  add constraint execution_receipts_verified_attestation_check
  check (
    trust_status <> 'verified'
    or (
      attestation_alg = 'HMAC-SHA256'
      and connector_id <> 'legacy'
      and attestation ~ '^[0-9a-f]{64}$'
      and length(btrim(nonce)) > 0
    )
  );

-- Composite parent keys required for tenant-aware foreign keys.
alter table genesis_capitalization.chat_signals
  add constraint uq_genesis_capitalization_chat_tenant_id unique (tenant_id, chat_signal_id);

alter table genesis_capitalization.editorial_gate_evaluations
  add constraint uq_genesis_capitalization_gate_tenant_id_signal
  unique (tenant_id, editorial_gate_evaluation_id, chat_signal_id);

alter table genesis_capitalization.capitalization_plans
  add constraint uq_genesis_capitalization_plan_tenant_id unique (tenant_id, capitalization_plan_id);

alter table genesis_capitalization.capitalization_targets
  add constraint uq_genesis_capitalization_target_tenant_id unique (tenant_id, capitalization_target_id);

-- Replace UUID-only lineage with tenant-bound lineage.
alter table genesis_capitalization.editorial_gate_evaluations
  drop constraint if exists fk_genesis_capitalization_gate_signal;
alter table genesis_capitalization.editorial_gate_evaluations
  add constraint fk_genesis_capitalization_gate_signal
  foreign key (tenant_id, chat_signal_id)
  references genesis_capitalization.chat_signals (tenant_id, chat_signal_id)
  on update restrict on delete restrict;

alter table genesis_capitalization.capitalization_plans
  drop constraint if exists fk_genesis_capitalization_plan_signal;
alter table genesis_capitalization.capitalization_plans
  add constraint fk_genesis_capitalization_plan_signal
  foreign key (tenant_id, chat_signal_id)
  references genesis_capitalization.chat_signals (tenant_id, chat_signal_id)
  on update restrict on delete restrict;

alter table genesis_capitalization.capitalization_plans
  drop constraint if exists fk_genesis_capitalization_plan_gate;
alter table genesis_capitalization.capitalization_plans
  add constraint fk_genesis_capitalization_plan_gate
  foreign key (tenant_id, editorial_gate_evaluation_id, chat_signal_id)
  references genesis_capitalization.editorial_gate_evaluations
    (tenant_id, editorial_gate_evaluation_id, chat_signal_id)
  on update restrict on delete restrict;

alter table genesis_capitalization.capitalization_targets
  drop constraint if exists fk_genesis_capitalization_target_plan;
alter table genesis_capitalization.capitalization_targets
  add constraint fk_genesis_capitalization_target_plan
  foreign key (tenant_id, capitalization_plan_id)
  references genesis_capitalization.capitalization_plans (tenant_id, capitalization_plan_id)
  on update restrict on delete restrict;

alter table genesis_capitalization.execution_receipts
  drop constraint if exists fk_genesis_capitalization_receipt_target;
alter table genesis_capitalization.execution_receipts
  add constraint fk_genesis_capitalization_receipt_target
  foreign key (tenant_id, capitalization_target_id)
  references genesis_capitalization.capitalization_targets (tenant_id, capitalization_target_id)
  on update restrict on delete restrict;

alter table genesis_capitalization.proof_chains
  drop constraint if exists fk_genesis_capitalization_proof_plan;
alter table genesis_capitalization.proof_chains
  add constraint fk_genesis_capitalization_proof_plan
  foreign key (tenant_id, capitalization_plan_id)
  references genesis_capitalization.capitalization_plans (tenant_id, capitalization_plan_id)
  on update restrict on delete restrict;

-- Cover every composite FK in tenant order.
create index if not exists idx_genesis_capitalization_gate_tenant_signal
  on genesis_capitalization.editorial_gate_evaluations (tenant_id, chat_signal_id);
create index if not exists idx_genesis_capitalization_plan_tenant_signal
  on genesis_capitalization.capitalization_plans (tenant_id, chat_signal_id);
create index if not exists idx_genesis_capitalization_plan_tenant_gate_signal
  on genesis_capitalization.capitalization_plans (tenant_id, editorial_gate_evaluation_id, chat_signal_id);
create index if not exists idx_genesis_capitalization_target_tenant_plan
  on genesis_capitalization.capitalization_targets (tenant_id, capitalization_plan_id);
create index if not exists idx_genesis_capitalization_receipt_tenant_target
  on genesis_capitalization.execution_receipts (tenant_id, capitalization_target_id);
create index if not exists idx_genesis_capitalization_proof_tenant_plan
  on genesis_capitalization.proof_chains (tenant_id, capitalization_plan_id);

-- Reassert private boundary after schema evolution.
alter table genesis_capitalization.chat_signals enable row level security;
alter table genesis_capitalization.editorial_gate_evaluations enable row level security;
alter table genesis_capitalization.capitalization_plans enable row level security;
alter table genesis_capitalization.capitalization_targets enable row level security;
alter table genesis_capitalization.execution_receipts enable row level security;
alter table genesis_capitalization.proof_chains enable row level security;
revoke all on all tables in schema genesis_capitalization from public, anon, authenticated;

commit;
