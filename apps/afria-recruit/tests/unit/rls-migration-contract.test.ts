import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const migrationPath = resolve(
  process.cwd(),
  '../../supabase/migrations/20260816154500_harden_candidate_disclosure_rbac.sql',
);

test('candidate disclosure migration keeps billing and viewer outside candidate-data access', async () => {
  const sql = await readFile(migrationPath, 'utf8');

  assert.match(sql, /create or replace function private\.can_receive_candidate_disclosure/i);
  assert.match(sql, /member_role\s+in\s*\('hiring_manager',\s*'recruiter',\s*'admin'\)/i);
  assert.doesNotMatch(sql, /member_role\s+in\s*\([^)]*'billing'/i);
  assert.doesNotMatch(sql, /member_role\s+in\s*\([^)]*'viewer'/i);
  assert.match(sql, /private\.can_receive_candidate_disclosure\(c\.organization_id\)/i);
  assert.match(sql, /create policy consents_select[\s\S]*private\.can_receive_candidate_disclosure\(organization_id\)/i);
  assert.match(sql, /create policy disclosure_select[\s\S]*private\.can_receive_candidate_disclosure\(organization_id\)/i);
  assert.match(sql, /revoke all on function private\.can_receive_candidate_disclosure\(uuid\) from public/i);
  assert.match(sql, /grant execute on function private\.can_receive_candidate_disclosure\(uuid\) to authenticated/i);
});
