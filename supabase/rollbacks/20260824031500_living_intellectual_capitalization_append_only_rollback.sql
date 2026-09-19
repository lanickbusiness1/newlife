-- Controlled rollback for append-only privilege hardening.
-- Re-enables UPDATE on all six ledger tables; use only if rollback is explicitly authorized.

begin;

grant update on genesis_capitalization.chat_signals to service_role;
grant update on genesis_capitalization.editorial_gate_evaluations to service_role;
grant update on genesis_capitalization.execution_receipts to service_role;
grant update on genesis_capitalization.proof_chains to service_role;
grant update on genesis_capitalization.capitalization_plans to service_role;
grant update on genesis_capitalization.capitalization_targets to service_role;

alter default privileges in schema genesis_capitalization
  grant update on tables to service_role;

commit;
