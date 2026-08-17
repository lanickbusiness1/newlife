-- Simandou Value Capture — synthetic sandbox persistence layer.
-- No fiscal rate or Guinean legal obligation is defaulted by this migration.

create table if not exists simandou_ore_lots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  external_id text not null,
  tonnage numeric(18,3) not null check (tonnage >= 0),
  grade_fe_percent numeric(5,2) not null check (grade_fe_percent between 0 and 100),
  extracted_at date not null,
  truth_class text not null check (truth_class in ('FACT','HYPOTHESIS','SIMULATION')),
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs) = 'array' and jsonb_array_length(evidence_refs) > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id),
  unique (id, tenant_id, project_id),
  foreign key (project_id, tenant_id) references mining_projects (id, tenant_id)
);

create table if not exists simandou_grade_certificates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  ore_lot_id uuid not null,
  grade_fe_percent numeric(5,2) not null check (grade_fe_percent between 0 and 100),
  moisture_percent numeric(5,2) not null check (moisture_percent between 0 and 100),
  certified_at date not null,
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs) = 'array' and jsonb_array_length(evidence_refs) > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (id, tenant_id, project_id),
  foreign key (ore_lot_id, tenant_id, project_id) references simandou_ore_lots (id, tenant_id, project_id)
);

create table if not exists simandou_shipments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  ore_lot_id uuid not null,
  external_id text not null,
  tonnage numeric(18,3) not null check (tonnage >= 0),
  grade_fe_percent numeric(5,2) not null check (grade_fe_percent between 0 and 100),
  loaded_at date not null,
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs) = 'array' and jsonb_array_length(evidence_refs) > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id),
  unique (id, tenant_id, project_id),
  foreign key (ore_lot_id, tenant_id, project_id) references simandou_ore_lots (id, tenant_id, project_id)
);

create table if not exists simandou_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  shipment_id uuid not null,
  external_id text not null,
  buyer_name text not null,
  gross_sale_value numeric(20,2) not null check (gross_sale_value >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  contract_date date not null,
  truth_class text not null check (truth_class in ('FACT','HYPOTHESIS','SIMULATION')),
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs) = 'array' and jsonb_array_length(evidence_refs) > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id),
  unique (id, tenant_id, project_id),
  foreign key (shipment_id, tenant_id, project_id) references simandou_shipments (id, tenant_id, project_id)
);

create table if not exists simandou_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  sale_id uuid not null,
  external_id text not null,
  amount numeric(20,2) not null check (amount >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  issued_at date not null,
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs) = 'array' and jsonb_array_length(evidence_refs) > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id),
  unique (id, tenant_id, project_id),
  foreign key (sale_id, tenant_id, project_id) references simandou_sales (id, tenant_id, project_id)
);

create table if not exists simandou_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  invoice_id uuid not null,
  external_id text not null,
  amount numeric(20,2) not null check (amount >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  paid_at date not null,
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs) = 'array' and jsonb_array_length(evidence_refs) > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id),
  unique (id, tenant_id, project_id),
  foreign key (invoice_id, tenant_id, project_id) references simandou_invoices (id, tenant_id, project_id)
);

create table if not exists simandou_fiscal_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  external_id text not null,
  source_id text not null,
  source_version text not null,
  jurisdiction text not null,
  effective_from date not null,
  effective_to date,
  formula_kind text not null check (formula_kind = 'AD_VALOREM_PERCENT'),
  rate_percent numeric(8,4) not null check (rate_percent between 0 and 100),
  formula_base text not null check (formula_base = 'GROSS_SALE_VALUE'),
  state text not null default 'DRAFT' check (state in ('DRAFT','VALIDATED','RETIRED')),
  validated_by_identity_id uuid,
  validation_evidence_id uuid,
  validated_at timestamptz,
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs) = 'array' and jsonb_array_length(evidence_refs) > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id, source_version),
  unique (id, tenant_id, project_id),
  foreign key (project_id, tenant_id) references mining_projects (id, tenant_id),
  foreign key (validated_by_identity_id, tenant_id) references workforce_identities (id, tenant_id),
  foreign key (validation_evidence_id, tenant_id) references workforce_evidence (id, tenant_id),
  check (effective_to is null or effective_to >= effective_from),
  check ((state = 'VALIDATED' and validated_by_identity_id is not null and validation_evidence_id is not null and validated_at is not null) or state <> 'VALIDATED')
);

create table if not exists simandou_fiscal_obligations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  fiscal_rule_id uuid not null,
  sale_id uuid not null,
  external_id text not null,
  expected_amount numeric(20,2) not null check (expected_amount >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  due_date date not null,
  truth_class text not null check (truth_class in ('FACT','HYPOTHESIS','SIMULATION')),
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs) = 'array' and jsonb_array_length(evidence_refs) > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id),
  unique (id, tenant_id, project_id),
  foreign key (fiscal_rule_id, tenant_id, project_id) references simandou_fiscal_rules (id, tenant_id, project_id),
  foreign key (sale_id, tenant_id, project_id) references simandou_sales (id, tenant_id, project_id)
);

create table if not exists simandou_government_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  obligation_id uuid not null,
  external_id text not null,
  amount numeric(20,2) not null check (amount >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  received_at date not null,
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs) = 'array' and jsonb_array_length(evidence_refs) > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id),
  unique (id, tenant_id, project_id),
  foreign key (obligation_id, tenant_id, project_id) references simandou_fiscal_obligations (id, tenant_id, project_id)
);

create table if not exists simandou_state_equity_interests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  external_id text not null,
  stake_percent numeric(8,4) not null check (stake_percent between 0 and 100),
  effective_from date not null,
  truth_class text not null check (truth_class in ('FACT','HYPOTHESIS','SIMULATION')),
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs) = 'array' and jsonb_array_length(evidence_refs) > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id),
  unique (id, tenant_id, project_id),
  foreign key (project_id, tenant_id) references mining_projects (id, tenant_id)
);

create table if not exists simandou_dividend_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  state_equity_interest_id uuid not null,
  external_id text not null,
  amount numeric(20,2) not null check (amount >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  declared_at date not null,
  truth_class text not null check (truth_class in ('FACT','HYPOTHESIS','SIMULATION')),
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs) = 'array' and jsonb_array_length(evidence_refs) > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id),
  unique (id, tenant_id, project_id),
  foreign key (state_equity_interest_id, tenant_id, project_id) references simandou_state_equity_interests (id, tenant_id, project_id)
);

create table if not exists simandou_fx_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  payment_id uuid not null,
  external_id text not null,
  generated_amount numeric(20,2) not null check (generated_amount >= 0),
  repatriated_amount numeric(20,2) not null check (repatriated_amount >= 0 and repatriated_amount <= generated_amount),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  observed_at date not null,
  truth_class text not null check (truth_class in ('FACT','HYPOTHESIS','SIMULATION')),
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs) = 'array' and jsonb_array_length(evidence_refs) > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id),
  unique (id, tenant_id, project_id),
  foreign key (payment_id, tenant_id, project_id) references simandou_payments (id, tenant_id, project_id)
);

create table if not exists simandou_value_capture_methodologies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  external_id text not null,
  methodology_version text not null,
  included_buckets text[] not null check (array_length(included_buckets, 1) > 0),
  state text not null default 'DRAFT' check (state in ('DRAFT','VALIDATED','RETIRED')),
  validated_by_identity_id uuid,
  validation_evidence_id uuid,
  validated_at timestamptz,
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs) = 'array' and jsonb_array_length(evidence_refs) > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, external_id, methodology_version),
  unique (id, tenant_id, project_id),
  foreign key (project_id, tenant_id) references mining_projects (id, tenant_id),
  foreign key (validated_by_identity_id, tenant_id) references workforce_identities (id, tenant_id),
  foreign key (validation_evidence_id, tenant_id) references workforce_evidence (id, tenant_id),
  check (not ('FX_RETENTION' = any(included_buckets))),
  check ((state = 'VALIDATED' and validated_by_identity_id is not null and validation_evidence_id is not null and validated_at is not null) or state <> 'VALIDATED')
);

create table if not exists simandou_value_capture_components (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  bucket text not null check (bucket in ('PUBLIC_REVENUE','STATE_EQUITY','LOCAL_PAYROLL','LOCAL_PROCUREMENT','DOMESTIC_TRANSFORMATION','FX_RETENTION')),
  amount numeric(20,2) not null check (amount >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  source_transaction_id text not null,
  truth_class text not null check (truth_class in ('FACT','HYPOTHESIS','SIMULATION')),
  evidence_refs jsonb not null check (jsonb_typeof(evidence_refs) = 'array' and jsonb_array_length(evidence_refs) > 0),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (id, tenant_id, project_id),
  unique (tenant_id, project_id, bucket, source_transaction_id),
  foreign key (project_id, tenant_id) references mining_projects (id, tenant_id)
);

create unique index if not exists simandou_value_components_economic_source_uidx
  on simandou_value_capture_components (tenant_id, project_id, source_transaction_id)
  where bucket <> 'FX_RETENTION';

create table if not exists simandou_reconciliation_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workforce_tenants(id),
  project_id uuid not null,
  shipment_id uuid,
  code text not null,
  message text not null,
  source_object_ids jsonb not null check (jsonb_typeof(source_object_ids) = 'array' and jsonb_array_length(source_object_ids) > 0),
  evidence_ids jsonb not null check (jsonb_typeof(evidence_ids) = 'array'),
  state text not null default 'OPEN' check (state in ('OPEN','ACKNOWLEDGED','RESOLVED','DISMISSED')),
  resolved_by_identity_id uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, tenant_id, project_id),
  foreign key (project_id, tenant_id) references mining_projects (id, tenant_id),
  foreign key (shipment_id, tenant_id, project_id) references simandou_shipments (id, tenant_id, project_id),
  foreign key (resolved_by_identity_id, tenant_id) references workforce_identities (id, tenant_id),
  check ((state in ('RESOLVED','DISMISSED') and resolved_by_identity_id is not null and resolved_at is not null) or state in ('OPEN','ACKNOWLEDGED'))
);

create index if not exists simandou_ore_lots_project_date_idx on simandou_ore_lots (tenant_id, project_id, extracted_at desc);
create index if not exists simandou_shipments_project_date_idx on simandou_shipments (tenant_id, project_id, loaded_at desc);
create index if not exists simandou_sales_project_date_idx on simandou_sales (tenant_id, project_id, contract_date desc);
create index if not exists simandou_payments_project_date_idx on simandou_payments (tenant_id, project_id, paid_at desc);
create index if not exists simandou_obligations_project_due_idx on simandou_fiscal_obligations (tenant_id, project_id, due_date);
create index if not exists simandou_receipts_project_date_idx on simandou_government_receipts (tenant_id, project_id, received_at desc);
create index if not exists simandou_exceptions_project_state_idx on simandou_reconciliation_exceptions (tenant_id, project_id, state, created_at desc);

-- Tenant isolation is fail-closed and forced on every Simandou table.
do $$
declare
  table_name text;
  tables text[] := array[
    'simandou_ore_lots','simandou_grade_certificates','simandou_shipments','simandou_sales',
    'simandou_invoices','simandou_payments','simandou_fiscal_rules','simandou_fiscal_obligations',
    'simandou_government_receipts','simandou_state_equity_interests','simandou_dividend_events',
    'simandou_fx_events','simandou_value_capture_methodologies','simandou_value_capture_components',
    'simandou_reconciliation_exceptions'
  ];
begin
  foreach table_name in array tables loop
    execute format('alter table %I enable row level security', table_name);
    execute format('alter table %I force row level security', table_name);
    execute format('drop policy if exists %I on %I', 'tenant_isolation_' || table_name, table_name);
    execute format(
      'create policy %I on %I for all using (tenant_id::text = current_setting(''app.tenant_id'', true)) with check (tenant_id::text = current_setting(''app.tenant_id'', true))',
      'tenant_isolation_' || table_name,
      table_name
    );
  end loop;
end
$$;
