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
    pipeline: 'Connecté à institutional_billing',
  });
});

test('returns a transparent fallback when the RPC is unavailable', async () => {
  const supabase = {
    async rpc() {
      return { data: null, error: { message: 'temporary failure' } };
    },
  };

  const result = await loadInvestorKpis(supabase);

  assert.equal(result.mode, 'DEMO');
  assert.match(result.warning, /RPC KPI indisponible/);
});
