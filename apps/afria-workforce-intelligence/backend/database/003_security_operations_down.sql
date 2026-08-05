drop trigger if exists local_content_audit_append_only on local_content_audit_events;
drop function if exists reject_local_content_audit_mutation();

drop table if exists local_content_idempotency_keys;
drop table if exists local_content_audit_events;
drop table if exists local_content_module_controls;

alter table workforce_identities no force row level security;
alter table workforce_employees no force row level security;
alter table workforce_evidence no force row level security;
alter table workforce_events no force row level security;

drop policy if exists tenant_isolation_identities on workforce_identities;
create policy tenant_isolation_identities on workforce_identities
using (tenant_id::text = current_setting('app.tenant_id', true));

drop policy if exists tenant_isolation_employees on workforce_employees;
create policy tenant_isolation_employees on workforce_employees
using (tenant_id::text = current_setting('app.tenant_id', true));

drop policy if exists tenant_isolation_evidence on workforce_evidence;
create policy tenant_isolation_evidence on workforce_evidence
using (tenant_id::text = current_setting('app.tenant_id', true));

drop policy if exists tenant_isolation_events on workforce_events;
create policy tenant_isolation_events on workforce_events
using (tenant_id::text = current_setting('app.tenant_id', true));
