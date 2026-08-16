import test from 'node:test';
import assert from 'node:assert/strict';
import {
  requireAuthenticatedCandidate,
  type AuthBoundaryDependencies,
} from '../../lib/auth/authenticated-user.js';
import { createAdminClient } from '../../lib/supabase/admin-client.js';

function request(token?: string) {
  return new Request('https://candidate.local/api', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function deps(overrides: Partial<AuthBoundaryDependencies> = {}) {
  let adminCalls = 0;
  const dependencies: AuthBoundaryDependencies = {
    getUser: async () => ({ id: 'user-1' }),
    findCandidateForUser: async () => ({ id: 'candidate-1', userId: 'user-1' }),
    createAdminClient: () => {
      adminCalls += 1;
      return { role: 'admin' };
    },
    ...overrides,
  };
  return { dependencies, adminCalls: () => adminCalls };
}

test('rejects a request without bearer authentication before admin construction', async () => {
  const fixture = deps();
  await assert.rejects(
    () => requireAuthenticatedCandidate(request(), fixture.dependencies),
    /authentication required/i,
  );
  assert.equal(fixture.adminCalls(), 0);
});

test('rejects invalid authentication before candidate lookup or admin construction', async () => {
  let candidateLookups = 0;
  const fixture = deps({
    getUser: async () => null,
    findCandidateForUser: async () => {
      candidateLookups += 1;
      return null;
    },
  });
  await assert.rejects(
    () => requireAuthenticatedCandidate(request('bad-token'), fixture.dependencies),
    /authentication required/i,
  );
  assert.equal(candidateLookups, 0);
  assert.equal(fixture.adminCalls(), 0);
});

test('rejects authenticated users without an owned candidate before admin construction', async () => {
  const fixture = deps({ findCandidateForUser: async () => null });
  await assert.rejects(
    () => requireAuthenticatedCandidate(request('valid-token'), fixture.dependencies),
    /candidate profile required/i,
  );
  assert.equal(fixture.adminCalls(), 0);
});

test('constructs the privileged client only after auth and candidate ownership succeed', async () => {
  const calls: string[] = [];
  const fixture = deps({
    getUser: async () => {
      calls.push('auth');
      return { id: 'user-1' };
    },
    findCandidateForUser: async (token, userId) => {
      assert.equal(token, 'valid-token');
      assert.equal(userId, 'user-1');
      calls.push('ownership');
      return { id: 'candidate-1', userId: 'user-1' };
    },
    createAdminClient: () => {
      calls.push('admin');
      return { role: 'admin' };
    },
  });

  const result = await requireAuthenticatedCandidate(request('valid-token'), fixture.dependencies);
  assert.equal(result.user.id, 'user-1');
  assert.equal(result.candidate.id, 'candidate-1');
  assert.deepEqual(calls, ['auth', 'ownership', 'admin']);
});

test('admin client fails closed when the server secret is missing', () => {
  assert.throws(
    () => createAdminClient({ NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }),
    /service role key is required/i,
  );
});
