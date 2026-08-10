import test from 'node:test';
import assert from 'node:assert/strict';
import { loadInvestorKpis } from '../src/kpi.js';

test('loads investor KPIs through the secured aggregate RPC', async () => {
  const calls = [];
  const supabase = {
    async rpc(name) {
      calls.push(name);
      return {
        data: {
          candidates: 0,
          institutional_needs: 3,
          candidate_job_matches: 0,
          placements: 0,
          pipeline_opportunities: 10,
        },
        error: null,
      };
    },
  };

  const result = await loadInvestorKpis(supabase);

  assert.deepEqual(calls, ['investor_demo_kpis']);
  assert.deepEqual(result, {
    mode: 'LIVE',
    candidates: 0,
    institutionalNeeds: 3,
    activeMatches: 0,
    placements: 0,
    pipeline: 10,
    status: 'Données agrégées vérifiées',
  });
});

test('normalizes a one-row RPC response without inventing missing values', async () => {
  const supabase = {
    async rpc() {
      return {
        data: [{
          candidates: '12',
          institutional_needs: '3',
          candidate_job_matches: '7',
          placements: '2',
        }],
        error: null,
      };
    },
  };

  const result = await loadInvestorKpis(supabase);

  assert.deepEqual(result, {
    mode: 'LIVE',
    candidates: 12,
    institutionalNeeds: 3,
    activeMatches: 7,
    placements: 2,
    pipeline: null,
    status: 'Données agrégées vérifiées',
  });
});

test('returns an empty transparent state when the RPC is unavailable', async () => {
  const supabase = {
    async rpc() {
      return { data: null, error: { message: 'temporary failure' } };
    },
  };

  const result = await loadInvestorKpis(supabase);

  assert.deepEqual(result, {
    mode: 'DEGRADED',
    candidates: null,
    institutionalNeeds: null,
    activeMatches: null,
    placements: null,
    pipeline: null,
    status: 'Indicateurs temporairement indisponibles',
    warning: 'Aucune valeur de remplacement n’est affichée.',
  });
});

test('returns the same transparent state when the RPC throws', async () => {
  const supabase = {
    async rpc() {
      throw new Error('network unavailable');
    },
  };

  const result = await loadInvestorKpis(supabase);

  assert.equal(result.mode, 'DEGRADED');
  assert.equal(result.candidates, null);
  assert.equal(result.pipeline, null);
  assert.equal(result.warning, 'Aucune valeur de remplacement n’est affichée.');
});
