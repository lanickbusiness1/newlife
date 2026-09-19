import test from 'node:test';
import assert from 'node:assert/strict';
import type { LegalSource } from '../../lib/legal/types.js';
import { verifyLegalSource } from '../../lib/legal/source-verifier.js';
import { resolveEffectiveInstrument, type LegalSourceGraph } from '../../lib/legal/source-graph.js';

const base: LegalSource = {
  id: 'BASE-001',
  title: 'Base statute',
  authority: 'Official Gazette',
  sourceUrl: 'https://example.invalid/base',
  effectiveStatus: 'VERIFIED',
  effectiveFrom: '2020-01-01',
};

test('source verification is evidence-based and never substitutes model confidence', () => {
  assert.equal(verifyLegalSource(base).status, 'SOURCE_VERIFIED');
  assert.equal(verifyLegalSource({ ...base, effectiveStatus: 'CONFLICT' }).status, 'SOURCE_CONFLICT');
  assert.equal(verifyLegalSource({ ...base, sourceUrl: '' }).status, 'SOURCE_INCOMPLETE');
});

test('future-effective instruments are not treated as currently effective', () => {
  const graph: LegalSourceGraph = { sources: [{ ...base, id: 'FUTURE', effectiveFrom: '2030-01-01' }] };
  const result = resolveEffectiveInstrument('FUTURE', '2026-08-23', graph);
  assert.equal(result.effectivity, 'NOT_YET_EFFECTIVE');
  assert.equal(result.effectiveSource, null);
});

test('a later amendment is surfaced without pretending the base instrument disappeared', () => {
  const amendment: LegalSource = {
    ...base,
    id: 'AMEND-001',
    title: 'Amending statute',
    effectiveFrom: '2024-01-01',
    amends: ['BASE-001'],
  };
  const graph: LegalSourceGraph = { sources: [base, amendment] };
  const result = resolveEffectiveInstrument('BASE-001', '2026-08-23', graph);
  assert.equal(result.effectivity, 'EFFECTIVE');
  assert.deepEqual(result.amendmentSourceIds, ['AMEND-001']);
});

test('replacement redirects to the verified replacement instrument', () => {
  const replacement: LegalSource = {
    ...base,
    id: 'REPLACEMENT-001',
    title: 'Replacement statute',
    effectiveFrom: '2025-01-01',
    replaces: ['BASE-001'],
  };
  const graph: LegalSourceGraph = { sources: [base, replacement] };
  const result = resolveEffectiveInstrument('BASE-001', '2026-08-23', graph);
  assert.equal(result.effectivity, 'REPLACED');
  assert.equal(result.effectiveSource?.id, 'REPLACEMENT-001');
});

test('repeal without replacement blocks use of the old instrument', () => {
  const repeal: LegalSource = {
    ...base,
    id: 'REPEAL-001',
    title: 'Repealing statute',
    effectiveFrom: '2025-01-01',
    repeals: ['BASE-001'],
  };
  const graph: LegalSourceGraph = { sources: [base, repeal] };
  const result = resolveEffectiveInstrument('BASE-001', '2026-08-23', graph);
  assert.equal(result.effectivity, 'REPEALED');
  assert.equal(result.effectiveSource, null);
});

test('multiple competing replacements fail closed as a source conflict', () => {
  const replacementA: LegalSource = { ...base, id: 'R-A', effectiveFrom: '2025-01-01', replaces: ['BASE-001'] };
  const replacementB: LegalSource = { ...base, id: 'R-B', effectiveFrom: '2025-01-01', replaces: ['BASE-001'] };
  const graph: LegalSourceGraph = { sources: [base, replacementA, replacementB] };
  const result = resolveEffectiveInstrument('BASE-001', '2026-08-23', graph);
  assert.equal(result.effectivity, 'CONFLICT');
  assert.equal(result.verificationStatus, 'SOURCE_CONFLICT');
});
