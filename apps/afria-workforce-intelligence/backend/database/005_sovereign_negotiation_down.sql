-- Rollback B8 Sovereign Negotiation Kernel persistence.

drop trigger if exists sovereign_decision_append_only on sovereign_decision_records;
drop trigger if exists sovereign_decision_human_authority on sovereign_decision_records;
drop trigger if exists sovereign_scenario_simulation_evidence on sovereign_scenarios;

do $$
declare
  table_name text;
  lineage_tables text[] := array[
    'sovereign_resource_assets',
    'sovereign_concessions',
    'sovereign_contract_clauses',
    'sovereign_contract_obligations',
    'sovereign_corridor_nodes',
    'sovereign_operator_exposures',
    'sovereign_scenarios',
    'sovereign_national_interest_assessments',
    'sovereign_decision_records'
  ];
begin
  foreach table_name in array lineage_tables loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists %I on %I', 'validate_evidence_lineage_' || table_name, table_name);
    end if;
  end loop;
end
$$;

drop table if exists sovereign_decision_records;
drop table if exists sovereign_national_interest_assessments;
drop table if exists sovereign_scenarios;
drop table if exists sovereign_operator_exposures;
drop table if exists sovereign_corridor_nodes;
drop table if exists sovereign_contract_obligations;
drop table if exists sovereign_contract_clauses;
drop table if exists sovereign_concessions;
drop table if exists sovereign_resource_assets;
drop table if exists sovereign_evidence_artifacts;

drop function if exists sovereign_validate_scenario_evidence();
drop function if exists sovereign_validate_evidence_lineage();
drop function if exists sovereign_require_human_decision_authority();
drop function if exists sovereign_reject_decision_mutation();
