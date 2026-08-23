import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRegionalLayers } from '../../lib/legal/regional-layer-resolver.js';

test('attaches only explicitly registered regional layers for the exact country and subject', () => {
  const layers = resolveRegionalLayers('ML', 'business_law', '2026-08-23');
  assert.ok(layers.some((layer) => layer.organization === 'OHADA'));
  assert.equal(layers.some((layer) => layer.organization === 'EAC'), false);
  assert.equal(layers.some((layer) => layer.organization === 'SADC'), false);
});

test('does not infer employment-law applicability from regional geography alone', () => {
  const layers = resolveRegionalLayers('ML', 'employment', '2026-08-23');
  assert.equal(layers.some((layer) => ['OHADA', 'UEMOA', 'CEMAC', 'CEDEAO', 'EAC', 'SADC'].includes(layer.organization)), false);
});

test('unknown countries receive no regional layer by default', () => {
  assert.deepEqual(resolveRegionalLayers('ZZ', 'business_law', '2026-08-23'), []);
});

test('future-effective layers are excluded until their effective date', () => {
  const before = resolveRegionalLayers('BJ', 'regional_economic_law', '2000-01-01');
  const after = resolveRegionalLayers('BJ', 'regional_economic_law', '2026-08-23');
  assert.equal(before.some((layer) => layer.organization === 'UEMOA'), false);
  assert.ok(after.some((layer) => layer.organization === 'UEMOA'));
});
