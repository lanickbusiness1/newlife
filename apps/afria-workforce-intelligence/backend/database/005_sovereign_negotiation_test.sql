\set ON_ERROR_STOP on

-- Required persistence contract for B8 Sovereign Negotiation Kernel.
do $$
declare
  table_name text;
  required_tables text[] := array[
    'sovereign_evidence_artifacts',
    'sovereign_concessions',
    'sovereign_contract_clauses',
    'sovereign_corridor_nodes',
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

set role workforce_app;
select set_config('app.tenant_id', '11111111-1111-4111-8111-111111111111', false);

insert into sovereign_evidence_artifacts (
  id, tenant_id, project_id, external_id, source_uri, sha256, observed_at, truth_class
) values (
  '50000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'EV-A-1', 'synthetic://offer-a/concession', repeat('a', 64), now(), 'FACT'
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

insert into sovereign_corridor_nodes (
  id, tenant_id, project_id, external_id, node_type, name, operator_id, dependency_ratio, evidence_ids
) values (
  '53000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'NODE-A-1', 'PORT_TERMINAL', 'Synthetic Terminal', 'operator-a', 0.85,
  array['50000000-0000-4000-8000-000000000001'::uuid]
);

insert into sovereign_national_interest_assessments (
  id, tenant_id, project_id, external_id, weights, weight_total, scores, weighted_score,
  decision, eliminatory_red_flags, evidence_count, evidence_ids
) values (
  '54000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'NIA-A-1',
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
  'Synthetic human decision record for test', null,
  array['50000000-0000-4000-8000-000000000001'::uuid]
);

-- Cross-tenant visibility must be blocked.
do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from sovereign_concessions;
  if visible_count <> 1 then
    raise exception 'RLS expected 1 visible concession, got %', visible_count;
  end if;
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
