\set ON_ERROR_STOP on

-- Required persistence contract for B8 Sovereign Negotiation Kernel.
do $$
declare
  table_name text;
  required_tables text[] := array[
    'sovereign_evidence_artifacts',
    'sovereign_resource_assets',
    'sovereign_concessions',
    'sovereign_contract_clauses',
    'sovereign_contract_obligations',
    'sovereign_corridor_nodes',
    'sovereign_operator_exposures',
    'sovereign_scenarios',
    'sovereign_national_interest_methodologies',
    'sovereign_national_interest_assessments',
    'sovereign_decision_records'
  ];
begin
  foreach table_name in array required_tables loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'required sovereign negotiation table missing: %', table_name;
    end if;
  end loop;
end
$$;

-- All B8 tables must force RLS.
do $$
declare
  bad_count integer;
begin
  select count(*) into bad_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname like 'sovereign_%'
    and c.relkind = 'r'
    and (not c.relrowsecurity or not c.relforcerowsecurity);
  if bad_count <> 0 then
    raise exception '% sovereign negotiation tables are missing forced RLS', bad_count;
  end if;
end
$$;

begin;

insert into workforce_tenants (id, slug, name, jurisdiction) values
  ('11111111-1111-4111-8111-111111111111', 'sovereign-test-a', 'Sovereign Test A', 'GN'),
  ('22222222-2222-4222-8222-222222222222', 'sovereign-test-b', 'Sovereign Test B', 'GN')
on conflict (id) do nothing;

insert into mining_projects (id, tenant_id, project_code, name, state) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'SOV-A', 'Sovereign A', 'ACTIVE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'SOV-B', 'Sovereign B', 'ACTIVE')
on conflict (id) do nothing;

insert into workforce_identities (id, tenant_id, kind, display_name, roles) values
  (
    '56000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'HUMAN',
    'Synthetic Sovereign Approver',
    '["SOVEREIGN_DECISION_APPROVER","SOVEREIGN_METHODOLOGY_APPROVER"]'::jsonb
  ),
  (
    '56000000-0000-4000-8000-000000000002',
    '11111111-1111-4111-8111-111111111111',
    'AGENT',
    'Synthetic Negotiation Agent',
    '["NEGOTIATION_ADVISOR","SOVEREIGN_METHODOLOGY_APPROVER"]'::jsonb
  )
on conflict (id) do nothing;

set role workforce_app;
select set_config('app.tenant_id', '11111111-1111-4111-8111-111111111111', false);

insert into sovereign_evidence_artifacts (
  id, tenant_id, project_id, external_id, source_uri, sha256, observed_at, truth_class
) values
  (
    '50000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'EV-A-1', 'synthetic://offer-a/concession', repeat('a', 64), now(), 'FACT'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'EV-SIM-1', 'synthetic://scenario/counter-proposal', repeat('b', 64), now(), 'SIMULATION'
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'EV-METHOD-APPROVAL', 'synthetic://methodology/approval', repeat('c', 64), now(), 'FACT'
  );

insert into sovereign_resource_assets (
  id, tenant_id, project_id, external_id, resource_type, name, reserve_quantity, reserve_unit, evidence_ids
) values (
  '50500000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'ASSET-A-1', 'IRON_ORE', 'Synthetic Simandou Block', 1500000000, 'TONNE',
  array['50000000-0000-4000-8000-000000000001'::uuid]
);

insert into sovereign_concessions (
  id, tenant_id, project_id, external_id, name, operator_id, effective_from, effective_to, evidence_ids
) values (
  '51000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'CON-A-1', 'Synthetic Port Concession', 'operator-a', '2027-01-01', '2052-12-31',
  array['50000000-0000-4000-8000-000000000001'::uuid]
);

insert into sovereign_contract_clauses (
  id, tenant_id, project_id, concession_id, external_id, clause_type, clause_text, legal_status, evidence_ids
) values (
  '52000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '51000000-0000-4000-8000-000000000001',
  'CLAUSE-A-1', 'STEP_IN_RIGHTS', 'Synthetic step-in clause', 'ADVISORY_EXTRACTED',
  array['50000000-0000-4000-8000-000000000001'::uuid]
);

insert into sovereign_contract_obligations (
  id, tenant_id, project_id, concession_id, clause_id, external_id, responsible_party,
  obligation_type, due_date, threshold_description, performance_status, evidence_ids
) values (
  '52500000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '51000000-0000-4000-8000-000000000001',
  '52000000-0000-4000-8000-000000000001',
  'OBL-A-1', 'operator-a', 'CAPEX_COMMITMENT', '2030-12-31', 'USD 500m cumulative investment',
  'POTENTIAL_BREACH', array['50000000-0000-4000-8000-000000000001'::uuid]
);

insert into sovereign_corridor_nodes (
  id, tenant_id, project_id, external_id, node_type, name, operator_id, dependency_ratio, evidence_ids
) values (
  '53000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'NODE-A-1', 'PORT_TERMINAL', 'Synthetic Terminal', 'operator-a', 0.85,
  array['50000000-0000-4000-8000-000000000001'::uuid]
);

insert into sovereign_operator_exposures (
  id, tenant_id, project_id, external_id, operator_id, controlled_capacity_ratio, critical_node_count, evidence_ids
) values (
  '53500000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'EXP-A-1', 'operator-a', 0.60, 3,
  array['50000000-0000-4000-8000-000000000001'::uuid]
);

insert into sovereign_scenarios (
  id, tenant_id, project_id, external_id, scenario_type, sovereign_npv, fiscal_take,
  fx_retention, local_value_capture, dependency_score, truth_class, evidence_ids
) values (
  '53800000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'SCENARIO-A-1', 'COUNTER_PROPOSAL', 1450, 540, 0.62, 0.51, 0.45, 'SIMULATION',
  array['50000000-0000-4000-8000-000000000002'::uuid]
);

insert into sovereign_national_interest_methodologies (
  id, tenant_id, project_id, external_id, methodology_version, weights, weight_total,
  go_threshold, hold_threshold, state, validated_by_identity_id, validated_at, evidence_ids, version
) values (
  '53900000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'METHOD-A-1', 'B8-v1',
  '{"nationalValueCapture":20,"fiscalFx":10,"infrastructureSpillover":10,"industrialization":10,"localContentSkills":10,"logisticsControl":10,"concentrationDependency":5,"debtGuarantees":5,"esgCommunity":5,"dataGovernance":5,"reversibility":5,"longTermResilience":5}'::jsonb,
  100, 75, 55, 'VALIDATED',
  '56000000-0000-4000-8000-000000000001', now(),
  array[
    '50000000-0000-4000-8000-000000000001'::uuid,
    '50000000-0000-4000-8000-000000000003'::uuid
  ],
  2
);

-- Agents may advise, but cannot validate the sovereign scoring methodology.
do $$
begin
  begin
    insert into sovereign_national_interest_methodologies (
      id, tenant_id, project_id, external_id, methodology_version, weights, weight_total,
      go_threshold, hold_threshold, state, validated_by_identity_id, validated_at, evidence_ids, version
    ) values (
      '53900000-0000-4000-8000-000000000002',
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'METHOD-A-AGENT', 'B8-agent-invalid',
      '{"nationalValueCapture":20,"fiscalFx":10,"infrastructureSpillover":10,"industrialization":10,"localContentSkills":10,"logisticsControl":10,"concentrationDependency":5,"debtGuarantees":5,"esgCommunity":5,"dataGovernance":5,"reversibility":5,"longTermResilience":5}'::jsonb,
      100, 75, 55, 'VALIDATED',
      '56000000-0000-4000-8000-000000000002', now(),
      array[
        '50000000-0000-4000-8000-000000000001'::uuid,
        '50000000-0000-4000-8000-000000000003'::uuid
      ],
      2
    );
    raise exception 'agent-validated methodology unexpectedly succeeded';
  exception
    when raise_exception then
      if sqlerrm = 'agent-validated methodology unexpectedly succeeded' then raise; end if;
    when others then null;
  end;
end
$$;

insert into sovereign_national_interest_assessments (
  id, tenant_id, project_id, external_id, methodology_id, methodology_version,
  weights, weight_total, scores, weighted_score,
  decision, eliminatory_red_flags, evidence_count, evidence_ids
) values (
  '54000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'NIA-A-1',
  '53900000-0000-4000-8000-000000000001', 'B8-v1',
  '{"nationalValueCapture":20,"fiscalFx":10,"infrastructureSpillover":10,"industrialization":10,"localContentSkills":10,"logisticsControl":10,"concentrationDependency":5,"debtGuarantees":5,"esgCommunity":5,"dataGovernance":5,"reversibility":5,"longTermResilience":5}'::jsonb,
  100,
  '{"nationalValueCapture":90,"fiscalFx":90,"infrastructureSpillover":90,"industrialization":90,"localContentSkills":90,"logisticsControl":90,"concentrationDependency":90,"debtGuarantees":90,"esgCommunity":90,"dataGovernance":90,"reversibility":90,"longTermResilience":90}'::jsonb,
  90, 'NO_GO', array['UNBOUNDED_SOVEREIGN_GUARANTEE'], 1,
  array['50000000-0000-4000-8000-000000000001'::uuid]
);

insert into sovereign_decision_records (
  id, tenant_id, project_id, external_id, assessment_id, decision, rationale, decided_by_identity_id, evidence_ids
) values (
  '55000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'DEC-A-1', '54000000-0000-4000-8000-000000000001', 'NO_GO',
  'Synthetic human decision record for test', '56000000-0000-4000-8000-000000000001',
  array['50000000-0000-4000-8000-000000000001'::uuid]
);

-- Agents may advise, but cannot author a sovereign decision record.
do $$
begin
  begin
    insert into sovereign_decision_records (
      id, tenant_id, project_id, external_id, assessment_id, decision, rationale, decided_by_identity_id, evidence_ids
    ) values (
      '55000000-0000-4000-8000-000000000002',
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'DEC-A-AGENT', '54000000-0000-4000-8000-000000000001', 'NO_GO',
      'Agent must not be allowed to author this record', '56000000-0000-4000-8000-000000000002',
      array['50000000-0000-4000-8000-000000000001'::uuid]
    );
    raise exception 'agent-authored sovereign decision unexpectedly succeeded';
  exception
    when raise_exception then
      if sqlerrm = 'agent-authored sovereign decision unexpectedly succeeded' then raise; end if;
    when others then null;
  end;
end
$$;

-- Cross-tenant visibility must be blocked.
do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from sovereign_concessions;
  if visible_count <> 1 then
    raise exception 'RLS expected 1 visible concession, got %', visible_count;
  end if;
  select count(*) into visible_count from sovereign_national_interest_methodologies;
  if visible_count <> 1 then
    raise exception 'RLS expected 1 visible methodology, got %', visible_count;
  end if;
end
$$;

-- Validated methodologies are immutable; a new semantic version is required for change.
do $$
begin
  begin
    update sovereign_national_interest_methodologies
       set go_threshold = 70
     where external_id = 'METHOD-A-1';
    raise exception 'validated methodology mutation unexpectedly succeeded';
  exception
    when raise_exception then
      if sqlerrm = 'validated methodology mutation unexpectedly succeeded' then raise; end if;
    when others then null;
  end;
end
$$;

-- Decision records are append-only.
do $$
begin
  begin
    update sovereign_decision_records set rationale = 'tampered' where external_id = 'DEC-A-1';
    raise exception 'append-only decision update unexpectedly succeeded';
  exception
    when raise_exception then
      if sqlerrm = 'append-only decision update unexpectedly succeeded' then raise; end if;
    when others then null;
  end;
end
$$;

reset role;
rollback;
