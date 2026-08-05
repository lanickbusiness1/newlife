insert into workforce_tenants (id, slug, name, jurisdiction)
values
  ('11111111-1111-4111-8111-111111111111', 'test-gn', 'Test Guinea Tenant', 'GN'),
  ('22222222-2222-4222-8222-222222222222', 'test-rw', 'Test Rwanda Tenant', 'RW')
on conflict (id) do nothing;

insert into workforce_identities (id, tenant_id, kind, display_name, roles)
values
  ('11111111-1111-4111-8111-111111111112', '11111111-1111-4111-8111-111111111111', 'HUMAN', 'Test Auditor', '["AUDITOR"]'::jsonb),
  ('22222222-2222-4222-8222-222222222223', '22222222-2222-4222-8222-222222222222', 'HUMAN', 'Test Operator', '["OPERATOR"]'::jsonb)
on conflict (id) do nothing;

insert into mining_projects (id, tenant_id, project_code, name)
values ('11111111-1111-4111-8111-111111111113', '11111111-1111-4111-8111-111111111111', 'SIM-TEST', 'Synthetic Mining Project')
on conflict (id) do nothing;

insert into local_content_module_controls (
  tenant_id,
  module_enabled,
  emergency_stop,
  stop_reason,
  stopped_by_identity_id,
  stopped_at
)
values (
  '11111111-1111-4111-8111-111111111111',
  true,
  true,
  'SECURITY_TEST',
  '11111111-1111-4111-8111-111111111112',
  '2026-08-05T12:00:00Z'
);

insert into local_content_audit_events (
  id,
  tenant_id,
  project_id,
  actor_identity_id,
  actor_kind,
  action,
  aggregate_id,
  correlation_id,
  payload,
  event_hash,
  occurred_at
)
values (
  '11111111-1111-4111-8111-111111111114',
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111113',
  '11111111-1111-4111-8111-111111111112',
  'HUMAN',
  'SECURITY_TEST_EVENT',
  'aggregate-1',
  'correlation-1',
  '{"result":"created"}'::jsonb,
  repeat('a', 64),
  '2026-08-05T12:00:00Z'
);

insert into local_content_idempotency_keys (
  id,
  tenant_id,
  actor_identity_id,
  http_method,
  route,
  idempotency_key,
  request_sha256,
  response_status,
  response_headers,
  response_body,
  created_at,
  expires_at
)
values (
  '11111111-1111-4111-8111-111111111115',
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111112',
  'POST',
  '/v1/rules',
  'idem-test-001',
  repeat('b', 64),
  201,
  '{"content-type":"application/json"}'::jsonb,
  '{"id":"rule-test"}',
  '2026-08-05T12:00:00Z',
  '2026-08-05T13:00:00Z'
);

DO $$
declare
  blocked boolean := false;
begin
  begin
    update local_content_audit_events
      set payload = '{"result":"tampered"}'::jsonb
      where id = '11111111-1111-4111-8111-111111111114';
  exception when others then
    if position('append-only' in sqlerrm) > 0 then
      blocked := true;
    else
      raise;
    end if;
  end;
  if not blocked then
    raise exception 'append-only audit mutation was not blocked';
  end if;
end;
$$;

DO $$
declare
  blocked boolean := false;
begin
  begin
    insert into local_content_idempotency_keys (
      tenant_id,
      actor_identity_id,
      http_method,
      route,
      idempotency_key,
      request_sha256,
      response_status,
      response_body,
      expires_at
    )
    values (
      '11111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111112',
      'POST',
      '/v1/rules',
      'idem-test-001',
      repeat('c', 64),
      201,
      '{}',
      now() + interval '1 hour'
    );
  exception when unique_violation then
    blocked := true;
  end;
  if not blocked then
    raise exception 'duplicate idempotency key was not blocked';
  end if;
end;
$$;

DO $$
declare
  blocked boolean := false;
begin
  begin
    insert into local_content_module_controls (
      tenant_id,
      module_enabled,
      emergency_stop
    )
    values (
      '22222222-2222-4222-8222-222222222222',
      true,
      true
    );
  exception when check_violation then
    blocked := true;
  end;
  if not blocked then
    raise exception 'invalid emergency stop record was not blocked';
  end if;
end;
$$;

DO $$
begin
  if (select count(*) from local_content_audit_events where tenant_id = '11111111-1111-4111-8111-111111111111') <> 1 then
    raise exception 'audit event count is invalid';
  end if;
  if (select count(*) from local_content_idempotency_keys where tenant_id = '11111111-1111-4111-8111-111111111111') <> 1 then
    raise exception 'idempotency record count is invalid';
  end if;
end;
$$;
