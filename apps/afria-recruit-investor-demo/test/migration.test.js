import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migrationUrl = new URL(
  '../../../supabase/migrations/20260810094242_secure_investor_demo_kpis.sql',
  import.meta.url,
);

test('investor aggregate migration executes with secure privileges and verified-only metrics', async (t) => {
  const database = new PGlite();
  t.after(() => database.close());

  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;

    create table public.candidates (
      profile_status text not null,
      verification_summary_status text not null,
      visibility text not null
    );
    create table public.institutional_needs (
      evidence_status text not null,
      status text not null
    );
    create table public.candidate_job_matches (
      verification_gate boolean not null,
      match_status text not null
    );
    create table public.placements (status text not null);

    alter table public.candidates enable row level security;
    alter table public.institutional_needs enable row level security;
    alter table public.candidate_job_matches enable row level security;
    alter table public.placements enable row level security;

    insert into public.candidates values
      ('verified', 'verified', 'discoverable'),
      ('draft', 'unverified', 'private');
    insert into public.institutional_needs values
      ('verified', 'approved'),
      ('internal_claim', 'draft');
    insert into public.candidate_job_matches values
      (true, 'eligible'),
      (false, 'blocked');
    insert into public.placements values ('active'), ('offered');
  `);

  await database.exec(await readFile(migrationUrl, 'utf8'));

  const definitionResult = await database.query(`
    select
      p.prosecdef,
      p.proconfig,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
      exists (
        select 1
        from aclexplode(p.proacl)
        where grantee = 0 and privilege_type = 'EXECUTE'
      ) as public_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'investor_demo_kpis'
  `);
  const [definition] = definitionResult.rows;

  assert.equal(definition.prosecdef, true);
  assert.deepEqual(definition.proconfig, ['search_path=""']);
  assert.equal(definition.anon_execute, true);
  assert.equal(definition.authenticated_execute, true);
  assert.equal(definition.public_execute, false);

  await database.exec('set role anon');
  const metricsResult = await database.query(
    'select public.investor_demo_kpis()',
  );
  const [{ investor_demo_kpis: metrics }] = metricsResult.rows;
  await assert.rejects(database.query('select * from public.candidates'), /permission denied/i);
  await database.exec('reset role');

  assert.deepEqual(metrics, {
    candidates: 1,
    institutional_needs: 1,
    candidate_job_matches: 1,
    placements: 1,
    pipeline_opportunities: 1,
  });
});
