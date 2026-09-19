-- V4-DEC-016 — append-only proof lineage hardening.
-- Immutable evidence rows may be selected/inserted by service_role but not rewritten.

begin;

revoke update on genesis_capitalization.chat_signals from service_role;
revoke update on genesis_capitalization.editorial_gate_evaluations from service_role;
revoke update on genesis_capitalization.execution_receipts from service_role;
revoke update on genesis_capitalization.proof_chains from service_role;

-- Plans and targets are state machines, but their execution contract fields are immutable.
-- Remove the table-wide UPDATE inherited from the base schema grant before granting only state columns.
revoke update on genesis_capitalization.capitalization_plans from service_role;
revoke update on genesis_capitalization.capitalization_targets from service_role;
grant update (status, reme_status, blockers)
  on genesis_capitalization.capitalization_plans to service_role;
grant update (status, updated_at)
  on genesis_capitalization.capitalization_targets to service_role;

-- Future ledger tables are append/read by default; UPDATE must be explicitly granted per mutable state machine.
alter default privileges in schema genesis_capitalization
  revoke update on tables from service_role;

commit;
