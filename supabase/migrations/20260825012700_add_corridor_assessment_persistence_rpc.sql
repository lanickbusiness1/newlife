alter table genesis_corridor.assessments
  add column if not exists agent_id text;

create or replace function public.persist_corridor_assessment_v1(
  p_tenant_id text,
  p_actor_id text,
  p_agent_id text,
  p_correlation_id uuid,
  p_input_hash text,
  p_input jsonb,
  p_assessment jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, genesis_corridor
as $$
declare
  v_corridor_id uuid;
  v_assessment_id uuid;
  v_evidence_id uuid;
  v_engine_version text;
  v_expected_evidence_count integer;
  v_registered_evidence_count integer;
  v_reme_event_count integer := 0;
  v_component jsonb;
  v_score record;
  v_evidence_ref text;
  v_event text;
begin
  if p_tenant_id is null or btrim(p_tenant_id) = '' then
    raise exception 'CORRIDOR_PERSISTENCE_TENANT_REQUIRED';
  end if;
  if p_actor_id is null or btrim(p_actor_id) = '' then
    raise exception 'CORRIDOR_PERSISTENCE_ACTOR_REQUIRED';
  end if;
  if p_agent_id is null or btrim(p_agent_id) = '' then
    raise exception 'CORRIDOR_PERSISTENCE_AGENT_REQUIRED';
  end if;
  if p_correlation_id is null then
    raise exception 'CORRIDOR_PERSISTENCE_CORRELATION_REQUIRED';
  end if;
  if p_input_hash is null or p_input_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'CORRIDOR_PERSISTENCE_INVALID_INPUT_HASH';
  end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'CORRIDOR_PERSISTENCE_INPUT_REQUIRED';
  end if;
  if p_assessment is null or jsonb_typeof(p_assessment) <> 'object' then
    raise exception 'CORRIDOR_PERSISTENCE_ASSESSMENT_REQUIRED';
  end if;

  v_engine_version := p_assessment #>> '{anchor,version}';
  if coalesce(v_engine_version, '') = '' then
    raise exception 'CORRIDOR_PERSISTENCE_ENGINE_VERSION_REQUIRED';
  end if;
  if p_assessment #>> '{anchor,assetId}' <> 'GEN-V4-CORRIDOR-VALUE-CAPTURE-001' then
    raise exception 'CORRIDOR_PERSISTENCE_ENGINE_ANCHOR_MISMATCH';
  end if;
  if p_assessment ->> 'corridorId' is distinct from p_input ->> 'corridorId' then
    raise exception 'CORRIDOR_PERSISTENCE_CORRIDOR_MISMATCH';
  end if;

  insert into genesis_corridor.corridors (
    tenant_id,
    corridor_key,
    name,
    asset_class,
    countries,
    status,
    metadata
  ) values (
    btrim(p_tenant_id),
    p_input ->> 'corridorId',
    p_input ->> 'corridorName',
    p_input ->> 'assetClass',
    array(select jsonb_array_elements_text(p_input -> 'countries')),
    'active',
    jsonb_build_object('last_agent_id', btrim(p_agent_id), 'last_correlation_id', p_correlation_id)
  )
  on conflict (tenant_id, corridor_key) do update
    set name = excluded.name,
        asset_class = excluded.asset_class,
        countries = excluded.countries,
        metadata = genesis_corridor.corridors.metadata || excluded.metadata,
        updated_at = now()
  returning id into v_corridor_id;

  select count(distinct ref)::integer
    into v_expected_evidence_count
  from jsonb_array_elements_text(coalesce(p_input -> 'evidenceRefs', '[]'::jsonb)) as evidence(ref);

  select count(*)::integer
    into v_registered_evidence_count
  from genesis_corridor.evidence_sources source
  where source.tenant_id = btrim(p_tenant_id)
    and source.evidence_ref in (
      select distinct ref
      from jsonb_array_elements_text(coalesce(p_input -> 'evidenceRefs', '[]'::jsonb)) as evidence(ref)
    );

  if v_expected_evidence_count = 0 or v_registered_evidence_count <> v_expected_evidence_count then
    raise exception 'CORRIDOR_PERSISTENCE_EVIDENCE_NOT_REGISTERED';
  end if;

  insert into genesis_corridor.corridor_evidence (corridor_id, evidence_id, relation_type)
  select v_corridor_id, source.id, 'supports'
  from genesis_corridor.evidence_sources source
  where source.tenant_id = btrim(p_tenant_id)
    and source.evidence_ref in (
      select distinct ref
      from jsonb_array_elements_text(p_input -> 'evidenceRefs') as evidence(ref)
    )
  on conflict do nothing;

  select existing.id
    into v_assessment_id
  from genesis_corridor.assessments existing
  where existing.tenant_id = btrim(p_tenant_id)
    and existing.corridor_id = v_corridor_id
    and existing.engine_version = v_engine_version
    and existing.input_hash = p_input_hash
  limit 1;

  if v_assessment_id is not null then
    select count(*)::integer into v_reme_event_count
    from genesis_corridor.reme_events event
    where event.assessment_id = v_assessment_id;

    return jsonb_build_object(
      'corridor_uuid', v_corridor_id,
      'assessment_uuid', v_assessment_id,
      'input_hash', p_input_hash,
      'idempotent', true,
      'reme_event_count', v_reme_event_count
    );
  end if;

  insert into genesis_corridor.assessments (
    tenant_id,
    corridor_id,
    engine_asset_id,
    engine_version,
    as_of,
    input_hash,
    currency,
    total_economic_value,
    classified_value,
    unclassified_value,
    local_retained_value,
    value_coverage_ratio,
    sovereign_value_capture_ratio,
    sovereignty_gap,
    corridor_control,
    feedstock_security,
    infrastructure_readiness,
    market_reach,
    local_industrialization,
    governance_risk,
    buyer_access,
    procurement_readiness,
    strategic_readiness_score,
    afriagenesis_opportunity_score,
    decision,
    decision_reasons,
    blockers,
    opportunity_lanes,
    score_evidence_snapshot,
    input_payload,
    assessment_payload,
    actor_id,
    agent_id,
    correlation_id,
    audit_id
  ) values (
    btrim(p_tenant_id),
    v_corridor_id,
    p_assessment #>> '{anchor,assetId}',
    v_engine_version,
    (p_assessment ->> 'asOf')::timestamptz,
    p_input_hash,
    upper(p_assessment ->> 'currency'),
    (p_assessment ->> 'totalEconomicValue')::numeric,
    (p_assessment ->> 'classifiedValue')::numeric,
    (p_assessment ->> 'unclassifiedValue')::numeric,
    (p_assessment ->> 'localRetainedValue')::numeric,
    (p_assessment ->> 'valueCoverageRatio')::numeric,
    (p_assessment ->> 'sovereignValueCaptureRatio')::numeric,
    (p_assessment ->> 'sovereigntyGap')::numeric,
    (p_assessment ->> 'corridorControl')::numeric,
    (p_assessment ->> 'feedstockSecurity')::numeric,
    (p_assessment ->> 'infrastructureReadiness')::numeric,
    (p_assessment ->> 'marketReach')::numeric,
    (p_assessment ->> 'localIndustrialization')::numeric,
    (p_assessment ->> 'governanceRisk')::numeric,
    (p_assessment ->> 'buyerAccess')::numeric,
    (p_assessment ->> 'procurementReadiness')::numeric,
    (p_assessment ->> 'strategicReadinessScore')::numeric,
    (p_assessment ->> 'afriagenesisOpportunityScore')::numeric,
    p_assessment ->> 'decision',
    array(select jsonb_array_elements_text(coalesce(p_assessment -> 'decisionReasons', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(p_assessment -> 'blockers', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(p_assessment -> 'opportunityLanes', '[]'::jsonb))),
    p_assessment -> 'scoreEvidenceRefs',
    p_input,
    p_assessment,
    btrim(p_actor_id),
    btrim(p_agent_id),
    p_correlation_id,
    gen_random_uuid()
  )
  returning id into v_assessment_id;

  for v_component in
    select value
    from jsonb_array_elements(coalesce(p_input #> '{economicValue,valueComponents}', '[]'::jsonb))
  loop
    select source.id into v_evidence_id
    from genesis_corridor.evidence_sources source
    where source.tenant_id = btrim(p_tenant_id)
      and source.evidence_ref = v_component ->> 'evidenceRef';

    if v_evidence_id is null then
      raise exception 'CORRIDOR_PERSISTENCE_EVIDENCE_NOT_REGISTERED';
    end if;

    insert into genesis_corridor.economic_components (
      assessment_id,
      component_name,
      gross_value,
      local_share,
      evidence_id
    ) values (
      v_assessment_id,
      v_component ->> 'name',
      (v_component ->> 'grossValue')::numeric,
      (v_component ->> 'localShare')::numeric,
      v_evidence_id
    );
  end loop;

  for v_score in
    select key, value
    from jsonb_each(coalesce(p_assessment -> 'scoreEvidenceRefs', '{}'::jsonb))
  loop
    for v_evidence_ref in
      select value
      from jsonb_array_elements_text(v_score.value)
    loop
      select source.id into v_evidence_id
      from genesis_corridor.evidence_sources source
      where source.tenant_id = btrim(p_tenant_id)
        and source.evidence_ref = v_evidence_ref;

      if v_evidence_id is null then
        raise exception 'CORRIDOR_PERSISTENCE_EVIDENCE_NOT_REGISTERED';
      end if;

      insert into genesis_corridor.strategic_score_evidence (
        assessment_id,
        score_key,
        score_value,
        evidence_id
      ) values (
        v_assessment_id,
        v_score.key,
        (p_assessment ->> v_score.key)::numeric,
        v_evidence_id
      );
    end loop;
  end loop;

  for v_event in
    select value
    from jsonb_array_elements_text(coalesce(p_assessment -> 'remeEvents', '[]'::jsonb))
  loop
    insert into genesis_corridor.reme_events (
      tenant_id,
      assessment_id,
      event_type,
      event_value,
      payload,
      emitted_at
    ) values (
      btrim(p_tenant_id),
      v_assessment_id,
      case when position(':' in v_event) > 0 then split_part(v_event, ':', 1) else v_event end,
      case when position(':' in v_event) > 0 then substring(v_event from position(':' in v_event) + 1) else null end,
      jsonb_build_object('raw_event', v_event, 'correlation_id', p_correlation_id, 'agent_id', btrim(p_agent_id)),
      now()
    );
    v_reme_event_count := v_reme_event_count + 1;
  end loop;

  return jsonb_build_object(
    'corridor_uuid', v_corridor_id,
    'assessment_uuid', v_assessment_id,
    'input_hash', p_input_hash,
    'idempotent', false,
    'reme_event_count', v_reme_event_count
  );
end;
$$;

revoke all on function public.persist_corridor_assessment_v1(text, text, text, uuid, text, jsonb, jsonb) from public;
revoke all on function public.persist_corridor_assessment_v1(text, text, text, uuid, text, jsonb, jsonb) from anon;
revoke all on function public.persist_corridor_assessment_v1(text, text, text, uuid, text, jsonb, jsonb) from authenticated;
grant execute on function public.persist_corridor_assessment_v1(text, text, text, uuid, text, jsonb, jsonb) to service_role;

comment on function public.persist_corridor_assessment_v1(text, text, text, uuid, text, jsonb, jsonb)
is 'V4-DEC-017 service-role-only atomic persistence gate for evidence-backed corridor assessments. Fails closed when referenced evidence is not registered.';
