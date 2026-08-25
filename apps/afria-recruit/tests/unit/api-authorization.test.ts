import test from 'node:test';
import assert from 'node:assert/strict';
import { CandidateHttpError, createCandidateRoute } from '../../lib/http/errors.js';

test('candidate route maps authentication failures to a safe 401 response', async () => {
  const route = createCandidateRoute(async () => {
    throw new CandidateHttpError(401, 'Authentication required');
  });
  const response = await route(new Request('https://candidate.local/api'));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Authentication required' });
});

test('candidate route never exposes raw infrastructure errors', async () => {
  const route = createCandidateRoute(async () => {
    throw new Error('postgres://secret-host internal stack trace');
  });
  const response = await route(new Request('https://candidate.local/api'));
  const body = await response.json() as { error: string };
  assert.equal(response.status, 500);
  assert.equal(body.error, 'Request failed safely');
  assert.doesNotMatch(body.error, /postgres|secret-host|stack/i);
});

test('candidate route preserves explicit validation errors', async () => {
  const route = createCandidateRoute(async () => {
    throw new CandidateHttpError(400, 'Invalid request');
  });
  const response = await route(new Request('https://candidate.local/api'));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Invalid request' });
});
