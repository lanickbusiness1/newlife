-- V4-DEC-016 — live convergence for column-level state-machine mutability.
-- The original append-only migration is also corrected for clean installs; this additive migration
-- removes broad UPDATE privileges from already-migrated environments.

begin;

revoke update on genesis_capitalization.capitalization_plans from service_role;
revoke update on genesis_capitalization.capitalization_targets from service_role;

grant update (status, reme_status, blockers)
  on genesis_capitalization.capitalization_plans to service_role;
grant update (status, updated_at)
  on genesis_capitalization.capitalization_targets to service_role;

commit;
