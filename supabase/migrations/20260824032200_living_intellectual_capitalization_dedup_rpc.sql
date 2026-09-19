-- V4-DEC-016 — authoritative tenant deduplication read surface.
-- PostgREST-visible RPC is SECURITY INVOKER and executable only by service_role.

begin;

create or replace function public.genesis_capitalization_known_fingerprints(p_tenant_id text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select coalesce(jsonb_agg(s.fingerprint order by s.fingerprint), '[]'::jsonb)
  from genesis_capitalization.chat_signals as s
  where s.tenant_id = p_tenant_id;
$function$;

revoke execute on function public.genesis_capitalization_known_fingerprints(text) from public, anon, authenticated;
grant execute on function public.genesis_capitalization_known_fingerprints(text) to service_role;

comment on function public.genesis_capitalization_known_fingerprints(text) is
  'V4-DEC-016 service-role-only authoritative deduplication snapshot for one governed tenant; SECURITY INVOKER over the private ledger.';

commit;
