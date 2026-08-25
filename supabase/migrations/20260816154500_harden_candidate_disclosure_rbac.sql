-- AfrIA Recruit™ Candidate OS — candidate disclosure least-privilege hardening.
-- Keeps generic organization membership semantics intact for billing/operations,
-- while restricting candidate-data disclosure to recruiting-authorized roles.

create or replace function private.can_receive_candidate_disclosure(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.member_role in ('hiring_manager', 'recruiter', 'admin')
  );
$$;

revoke all on function private.can_receive_candidate_disclosure(uuid) from public;
grant execute on function private.can_receive_candidate_disclosure(uuid) to authenticated;

create or replace function private.can_access_candidate(p_candidate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select private.owns_candidate(p_candidate_id)
      or private.is_platform_staff()
      or exists (
        select 1
        from public.consents c
        where c.candidate_id = p_candidate_id
          and c.organization_id is not null
          and private.can_receive_candidate_disclosure(c.organization_id)
          and c.purpose = 'institution_disclosure'
          and c.status = 'granted'
          and c.withdrawn_at is null
          and (c.expires_at is null or c.expires_at > now())
      );
$$;

revoke all on function private.can_access_candidate(uuid) from public;
grant execute on function private.can_access_candidate(uuid) to authenticated;

drop policy if exists consents_select on public.consents;
create policy consents_select
on public.consents
for select
to authenticated
using (
  private.owns_candidate(candidate_id)
  or private.is_platform_staff()
  or (
    organization_id is not null
    and private.can_receive_candidate_disclosure(organization_id)
  )
);

drop policy if exists disclosure_select on public.disclosure_events;
create policy disclosure_select
on public.disclosure_events
for select
to authenticated
using (
  private.owns_candidate(candidate_id)
  or private.is_platform_staff()
  or private.can_receive_candidate_disclosure(organization_id)
);

comment on function private.can_receive_candidate_disclosure(uuid) is
'Least-privilege organization capability for receiving candidate disclosures. Active hiring_manager, recruiter, or admin only.';
