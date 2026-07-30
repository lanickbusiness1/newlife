import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createApi } from '../src/api.js';
import { DiagnosticStore } from '../src/store.js';
import { DiagnosticService } from '../src/service.js';
import { QUESTIONS } from '../src/questions.js';

async function setup() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'diag30-'));
  const service = new DiagnosticService(new DiagnosticStore({ filePath: path.join(dir, 'diagnostics.json') }));
  const server = createApi({ service });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  return {
    dir,
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      server.close();
      await once(server, 'close');
      await rm(dir, { recursive: true, force: true });
    }
  };
}

async function json(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  return { status: response.status, body: await response.json() };
}

test('complete API journey persists, scores, reports and prepares evidence request', async () => {
  const app = await setup();
  try {
    const created = await json(`${app.baseUrl}/api/v1/diagnostics`, { method: 'POST', body: { country: 'BJ' } });
    assert.equal(created.status, 201);
    const id = created.body.id;

    const answers = QUESTIONS.map((question) => ({
      question_id: question.id,
      value: 'DOCUMENTE',
      evidence_level: 'DECLARATIF',
      evidence_reference: null,
      comment: null,
      updated_at: '2026-07-30T00:00:00.000Z'
    }));
    const saved = await json(`${app.baseUrl}/api/v1/diagnostics/${id}/answers`, { method: 'PUT', body: { answers } });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.answers.length, 30);

    const scored = await json(`${app.baseUrl}/api/v1/diagnostics/${id}/score`, { method: 'POST', body: { evidence_gate_passed: true } });
    assert.equal(scored.status, 200);
    assert.equal(scored.body.global_score, 100);
    assert.equal(scored.body.status, 'STRATEGICALLY_READY');

    const report = await json(`${app.baseUrl}/api/v1/diagnostics/${id}/report`);
    assert.equal(report.status, 200);
    assert.equal(report.body.answers.length, 30);
    assert.match(report.body.disclaimer, /ne constitue ni un agrément/i);

    const blocked = await json(`${app.baseUrl}/api/v1/diagnostics/${id}/evidence-request`, { method: 'POST', body: {} });
    assert.equal(blocked.status, 409);

    const consent = await json(`${app.baseUrl}/api/v1/diagnostics/${id}/lead-consent`, { method: 'POST', body: { accepted: true, purpose: 'audit_probant' } });
    assert.equal(consent.status, 200);

    const evidence = await json(`${app.baseUrl}/api/v1/diagnostics/${id}/evidence-request`, {
      method: 'POST',
      body: { institution_name: 'Institution pilote', contact_reference: 'lead-001' }
    });
    assert.equal(evidence.status, 201);
    assert.equal(evidence.body.status, 'PREPARED');
  } finally {
    await app.close();
  }
});

test('invalid JSON, unknown session and missing explicit consent are rejected', async () => {
  const app = await setup();
  try {
    const invalid = await fetch(`${app.baseUrl}/api/v1/diagnostics`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{'
    });
    assert.equal(invalid.status, 400);

    const missing = await json(`${app.baseUrl}/api/v1/diagnostics/unknown/score`, { method: 'POST', body: {} });
    assert.equal(missing.status, 404);

    const created = await json(`${app.baseUrl}/api/v1/diagnostics`, { method: 'POST', body: {} });
    const refused = await json(`${app.baseUrl}/api/v1/diagnostics/${created.body.id}/lead-consent`, {
      method: 'POST', body: { accepted: false }
    });
    assert.equal(refused.status, 422);
  } finally {
    await app.close();
  }
});
