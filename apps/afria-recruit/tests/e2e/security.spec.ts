import { test, expect } from '@playwright/test';

const SYNTHETIC_TOKEN = 'e2e-synthetic-token';

test('unauthenticated candidate API fails with 401 and no infrastructure detail', async ({ request }) => {
  const response = await request.get('/api/candidate/context');
  expect(response.status()).toBe(401);
  const body = await response.json() as { error: string };
  expect(body.error).toBe('Authentication required');
  expect(body.error).not.toMatch(/supabase|postgres|stack|service.?role|openai/i);
});

test('malformed authenticated request fails closed without provider or database details', async ({ request }) => {
  const response = await request.post('/api/candidate/gap-analysis', {
    headers: { Authorization: `Bearer ${SYNTHETIC_TOKEN}`, 'Content-Type': 'application/json' },
    data: { jobId: '' },
  });
  expect(response.status()).toBe(400);
  const body = await response.json() as { error: string };
  expect(body.error).toMatch(/Invalid jobId/i);
  expect(body.error).not.toMatch(/supabase|postgres|stack|service.?role|openai/i);
});

test('unknown synthetic job is a safe 404 rather than a raw backend error', async ({ request }) => {
  const response = await request.post('/api/candidate/gap-analysis', {
    headers: { Authorization: `Bearer ${SYNTHETIC_TOKEN}`, 'Content-Type': 'application/json' },
    data: { jobId: '00000000-0000-4000-8000-000000009999' },
  });
  expect(response.status()).toBe(404);
  const body = await response.json() as { error: string };
  expect(body.error).toBe('Job not found');
  expect(body.error).not.toMatch(/supabase|postgres|stack|service.?role|openai/i);
});
