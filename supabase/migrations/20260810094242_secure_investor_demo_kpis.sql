-- Public investor metrics expose verified aggregates only, never row-level data.
create or replace function public.investor_demo_kpis()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'candidates', (
      select count(*)::bigint
      from public.candidates
      where profile_status = 'verified'
        and verification_summary_status = 'verified'
        and visibility in ('matching_only', 'discoverable')
    ),
    'institutional_needs', (
      select count(*)::bigint
      from public.institutional_needs
      where evidence_status = 'verified'
        and status in ('approved', 'sourcing', 'filled')
    ),
    'candidate_job_matches', (
      select count(*)::bigint
      from public.candidate_job_matches
      where verification_gate is true
        and match_status = 'eligible'
    ),
    'placements', (
      select count(*)::bigint
      from public.placements
      where status in ('active', 'completed')
    ),
    'pipeline_opportunities', (
      select count(*)::bigint
      from public.institutional_needs
      where evidence_status = 'verified'
        and status in ('approved', 'sourcing')
    )
  );
$function$;

revoke execute on function public.investor_demo_kpis() from public;
revoke execute on function public.investor_demo_kpis() from anon;
revoke execute on function public.investor_demo_kpis() from authenticated;
grant execute on function public.investor_demo_kpis() to anon;
grant execute on function public.investor_demo_kpis() to authenticated;

comment on function public.investor_demo_kpis() is
  'Verified aggregate-only metrics for the public AfrIA Recruit investor staging.';
