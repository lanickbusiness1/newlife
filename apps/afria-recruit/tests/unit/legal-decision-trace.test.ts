import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDecisionTrace,
  hashDecisionTrace,
} from '../../lib/legal/decision-trace.js';
import {
  appendLegalAuditRecord,
  readLegalAuditRecord,
} from '../../lib/legal/legal-audit-ledger.js';

const failTraceInput = {
  countryCode: 'ML',
  jurisdiction: 'territorial_public_service' as const,
  sources: [{ sourceId: 'ML-TERR-001', article: '12' }],
  rules: [{ ruleId: 'ML-TERR-AGE-001', version: '1.0.0' }],
  factsUsed: ['age'],
  missingFacts: [],
  conflicts: [],
  verdict: 'FAIL' as const,
  reviewPath: 'RECRUITMENT_APPEAL_OR_HUMAN_REVIEW',
};

test('every FAIL trace contains facts, jurisdiction, exact article, rule version, review path and hash', () => {
  const trace = buildDecisionTrace(failTraceInput);
  assert.equal(trace.verdict, 'FAIL');
  assert.deepEqual(trace.factsUsed, ['age']);
  assert.equal(trace.jurisdiction, 'territorial_public_service');
  assert.deepEqual(trace.sourceIds, ['ML-TERR-001']);
  assert.deepEqual(trace.articles, ['12']);
  assert.deepEqual(trace.ruleVersions, ['1.0.0']);
  assert.equal(trace.reviewPath, 'RECRUITMENT_APPEAL_OR_HUMAN_REVIEW');
  assert.match(trace.auditHash ?? '', /^[a-f0-9]{64}$/);
});

test('an adverse FAIL cannot be traced without exact legal provenance and review path', () => {
  assert.throws(
    () => buildDecisionTrace({ ...failTraceInput, sources: [] }),
    /adverse.*source|FAIL.*source/i,
  );
  assert.throws(
    () => buildDecisionTrace({ ...failTraceInput, sources: [{ sourceId: 'ML-TERR-001', article: '' }] }),
    /article/i,
  );
  assert.throws(
    () => buildDecisionTrace({ ...failTraceInput, reviewPath: '' }),
    /reviewPath/i,
  );
});

test('canonical trace hashing is deterministic', () => {
  const first = buildDecisionTrace({ ...failTraceInput, conflicts: ['B', 'A'] });
  const second = buildDecisionTrace({ ...failTraceInput, conflicts: ['A', 'B'] });
  assert.equal(hashDecisionTrace(first), hashDecisionTrace(second));
  assert.equal(first.auditHash, second.auditHash);
});

test('legal audit ledger is append-only by record identifier', () => {
  const trace = buildDecisionTrace(failTraceInput);
  const inserted = appendLegalAuditRecord({
    id: 'audit-test-001',
    decisionTrace: trace,
    createdAt: '2026-08-23T22:00:00.000Z',
  });
  assert.equal(inserted.id, 'audit-test-001');
  assert.equal(readLegalAuditRecord('audit-test-001')?.decisionTrace.auditHash, trace.auditHash);

  assert.throws(
    () => appendLegalAuditRecord({
      id: 'audit-test-001',
      decisionTrace: buildDecisionTrace({ ...failTraceInput, factsUsed: ['different_fact'] }),
      createdAt: '2026-08-23T22:01:00.000Z',
    }),
    /append-only|already exists/i,
  );
});
