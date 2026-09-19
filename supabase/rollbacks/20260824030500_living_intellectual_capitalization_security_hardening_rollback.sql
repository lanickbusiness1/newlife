-- Emergency rollback for 20260824030500_living_intellectual_capitalization_security_hardening.sql
-- WARNING: removes post-hardening attestation/binding columns. Use only for controlled rollback.

begin;

alter table genesis_capitalization.editorial_gate_evaluations
  drop constraint if exists fk_genesis_capitalization_gate_signal;
alter table genesis_capitalization.capitalization_plans
  drop constraint if exists fk_genesis_capitalization_plan_signal;
alter table genesis_capitalization.capitalization_plans
  drop constraint if exists fk_genesis_capitalization_plan_gate;
alter table genesis_capitalization.capitalization_targets
  drop constraint if exists fk_genesis_capitalization_target_plan;
alter table genesis_capitalization.execution_receipts
  drop constraint if exists fk_genesis_capitalization_receipt_target;
alter table genesis_capitalization.proof_chains
  drop constraint if exists fk_genesis_capitalization_proof_plan;

alter table genesis_capitalization.editorial_gate_evaluations
  add constraint fk_genesis_capitalization_gate_signal
  foreign key (chat_signal_id)
  references genesis_capitalization.chat_signals (chat_signal_id)
  on update restrict on delete restrict;

alter table genesis_capitalization.capitalization_plans
  add constraint fk_genesis_capitalization_plan_signal
  foreign key (chat_signal_id)
  references genesis_capitalization.chat_signals (chat_signal_id)
  on update restrict on delete restrict;

alter table genesis_capitalization.capitalization_plans
  add constraint fk_genesis_capitalization_plan_gate
  foreign key (editorial_gate_evaluation_id)
  references genesis_capitalization.editorial_gate_evaluations (editorial_gate_evaluation_id)
  on update restrict on delete restrict;

alter table genesis_capitalization.capitalization_targets
  add constraint fk_genesis_capitalization_target_plan
  foreign key (capitalization_plan_id)
  references genesis_capitalization.capitalization_plans (capitalization_plan_id)
  on update restrict on delete restrict;

alter table genesis_capitalization.execution_receipts
  add constraint fk_genesis_capitalization_receipt_target
  foreign key (capitalization_target_id)
  references genesis_capitalization.capitalization_targets (capitalization_target_id)
  on update restrict on delete restrict;

alter table genesis_capitalization.proof_chains
  add constraint fk_genesis_capitalization_proof_plan
  foreign key (capitalization_plan_id)
  references genesis_capitalization.capitalization_plans (capitalization_plan_id)
  on update restrict on delete restrict;

alter table genesis_capitalization.chat_signals
  drop constraint if exists uq_genesis_capitalization_chat_tenant_id;
alter table genesis_capitalization.editorial_gate_evaluations
  drop constraint if exists uq_genesis_capitalization_gate_tenant_id_signal;
alter table genesis_capitalization.capitalization_plans
  drop constraint if exists uq_genesis_capitalization_plan_tenant_id;
alter table genesis_capitalization.capitalization_targets
  drop constraint if exists uq_genesis_capitalization_target_tenant_id;

alter table genesis_capitalization.capitalization_targets
  drop constraint if exists capitalization_targets_allowed_connector_ids_check;
alter table genesis_capitalization.execution_receipts
  drop constraint if exists execution_receipts_trust_status_check;
alter table genesis_capitalization.execution_receipts
  drop constraint if exists execution_receipts_verified_attestation_check;

alter table genesis_capitalization.execution_receipts
  drop column if exists connector_id,
  drop column if exists nonce,
  drop column if exists attestation,
  drop column if exists attestation_alg,
  drop column if exists trust_status;

alter table genesis_capitalization.capitalization_targets
  drop column if exists execution_nonce,
  drop column if exists allowed_connector_ids;

alter table genesis_capitalization.capitalization_plans
  drop column if exists signal_binding_hash;
alter table genesis_capitalization.editorial_gate_evaluations
  drop column if exists signal_fingerprint,
  drop column if exists signal_binding_hash;
alter table genesis_capitalization.chat_signals
  drop column if exists binding_hash;

commit;
