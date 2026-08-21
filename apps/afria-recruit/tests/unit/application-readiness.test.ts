import test from 'node:test';
import assert from 'node:assert/strict';

test('cv diagnostic exposes the canonical application readiness scorer', async () => {
  const module = await import('../../lib/domain/cv-diagnostic.js');
  const scorer = (module as unknown as Record<string, unknown>).scoreApplicationReadiness;

  assert.equal(typeof scorer, 'function');
});
