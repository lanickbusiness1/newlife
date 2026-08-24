-- V4-DEC-016 performance hardening: cover the plan → Editorial Signal Gate™ foreign key.

create index if not exists idx_genesis_capitalization_plan_gate
  on genesis_capitalization.capitalization_plans (editorial_gate_evaluation_id);
