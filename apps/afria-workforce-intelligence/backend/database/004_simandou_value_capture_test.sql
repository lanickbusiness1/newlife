\set ON_ERROR_STOP on

-- Contract presence: migration 004 must materialize the entire sovereign chain.
do $$
declare
  table_name text;
  required_tables text[] := array[
    'simandou_ore_lots',
    'simandou_grade_certificates',
    'simandou_shipments',
    'simandou_sales',
    'simandou_invoices',
    'simandou_payments',
    'simandou_fiscal_rules',
    'simandou_fiscal_obligations',
    'simandou_government_receipts',
    'simandou_state_equity_interests',
    'simandou_dividend_events',
    'simandou_fx_events',
    'simandou_value_capture_methodologies',
    'simandou_value_capture_components',
    'simandou_reconciliation_exceptions'
  ];
begin
  foreach table_name in array required_tables loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'required Simandou table missing: %', table_name;
    end if;
  end loop;
end
$$;

-- Every Simandou table is RLS-enabled and forced.
do $$
declare
  bad_count integer;
begin
  select count(*) into bad_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname like 'simandou_%'
    and c.relkind = 'r'
    and (not c.relrowsecurity or not c.relforcerowsecurity);
  if bad_count <> 0 then
    raise exception '% Simandou tables are missing forced RLS', bad_count;
  end if;
end
$$;

-- Anti-double-counting must have a unique non-FX source index.
do $$
begin
  if to_regclass('public.simandou_value_components_economic_source_uidx') is null then
    raise exception 'anti-double-counting economic source unique index missing';
  end if;
end
$$;

begin;

insert into workforce_tenants (id, slug, name, jurisdiction) values
  ('11111111-1111-4111-8111-111111111111', 'sim-test-a', 'Sim Test A', 'GN'),
  ('22222222-2222-4222-8222-222222222222', 'sim-test-b', 'Sim Test B', 'GN')
on conflict (id) do nothing;

insert into mining_projects (id, tenant_id, project_code, name, state) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'SIM-A', 'Simandou A', 'ACTIVE'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'SIM-B', 'Simandou B', 'ACTIVE')
on conflict (id) do nothing;

set role workforce_app;
select set_config('app.tenant_id', '11111111-1111-4111-8111-111111111111', false);

insert into simandou_ore_lots (
  id, tenant_id, project_id, external_id, tonnage, grade_fe_percent, extracted_at,
  truth_class, evidence_refs
) values (
  '10000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'LOT-A-1', 100, 65, '2026-08-17', 'FACT',
  '[{"evidenceId":"e1","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]'::jsonb
);

-- Tenant B must be invisible under tenant A context.
do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from simandou_ore_lots;
  if visible_count <> 1 then
    raise exception 'RLS expected 1 visible lot, got %', visible_count;
  end if;
end
$$;

-- Cross-tenant write is denied by forced RLS.
do $$
begin
  begin
    insert into simandou_ore_lots (
      id, tenant_id, project_id, external_id, tonnage, grade_fe_percent, extracted_at,
      truth_class, evidence_refs
    ) values (
      '20000000-0000-4000-8000-000000000001',
      '22222222-2222-4222-8222-222222222222',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'LOT-B-1', 100, 65, '2026-08-17', 'FACT', '[]'::jsonb
    );
    raise exception 'cross-tenant insert unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

reset role;
rollback;
