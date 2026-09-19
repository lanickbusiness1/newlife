-- Emergency rollback for V4-DEC-016 column-level mutability hardening.
-- WARNING: this deliberately restores broad UPDATE privileges on plans/targets.

begin;

revoke update on genesis_capitalization.capitalization_plans from service_role;
revoke update on genesis_capitalization.capitalization_targets from service_role;

grant update on genesis_capitalization.capitalization_plans to service_role;
grant update on genesis_capitalization.capitalization_targets to service_role;

commit;
