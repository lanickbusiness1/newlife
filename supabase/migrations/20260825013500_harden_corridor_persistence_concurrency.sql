alter function public.persist_corridor_assessment_v1(text, text, text, uuid, text, jsonb, jsonb)
  rename to persist_corridor_assessment_v1_unlocked;

revoke all on function public.persist_corridor_assessment_v1_unlocked(text, text, text, uuid, text, jsonb, jsonb) from public;
revoke all on function public.persist_corridor_assessment_v1_unlocked(text, text, text, uuid, text, jsonb, jsonb) from anon;
revoke all on function public.persist_corridor_assessment_v1_unlocked(text, text, text, uuid, text, jsonb, jsonb) from authenticated;
revoke all on function public.persist_corridor_assessment_v1_unlocked(text, text, text, uuid, text, jsonb, jsonb) from service_role;

create function public.persist_corridor_assessment_v1(
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
  v_lock_key bigint;
begin
  v_lock_key := hashtextextended(
    concat_ws(
      '|',
      coalesce(p_tenant_id, ''),
      coalesce(p_input ->> 'corridorId', ''),
      coalesce(p_assessment #>> '{anchor,version}', ''),
      coalesce(p_input_hash, '')
    ),
    0
  );

  perform pg_advisory_xact_lock(v_lock_key);

  return public.persist_corridor_assessment_v1_unlocked(
    p_tenant_id,
    p_actor_id,
    p_agent_id,
    p_correlation_id,
    p_input_hash,
    p_input,
    p_assessment
  );
end;
$$;

revoke all on function public.persist_corridor_assessment_v1(text, text, text, uuid, text, jsonb, jsonb) from public;
revoke all on function public.persist_corridor_assessment_v1(text, text, text, uuid, text, jsonb, jsonb) from anon;
revoke all on function public.persist_corridor_assessment_v1(text, text, text, uuid, text, jsonb, jsonb) from authenticated;
grant execute on function public.persist_corridor_assessment_v1(text, text, text, uuid, text, jsonb, jsonb) to service_role;

comment on function public.persist_corridor_assessment_v1_unlocked(text, text, text, uuid, text, jsonb, jsonb)
is 'V4-DEC-017 internal persistence core. Direct API execution revoked; invoke only through persist_corridor_assessment_v1 concurrency gate.';

comment on function public.persist_corridor_assessment_v1(text, text, text, uuid, text, jsonb, jsonb)
is 'V4-DEC-017 service-role-only concurrency-safe persistence gate. Serializes identical tenant/corridor/engine/input-hash keys before executing the atomic evidence-backed persistence core.';
