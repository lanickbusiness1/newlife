const demoFallback = {
  mode: 'DEMO',
  candidates: 1284,
  institutionalNeeds: 17,
  activeMatches: 146,
  placements: 23,
  pipeline: '184.5 M GNF',
};

export async function loadInvestorKpis(supabase) {
  const { data, error } = await supabase.rpc('investor_demo_kpis');

  if (error || !data) {
    return {
      ...demoFallback,
      warning: `RPC KPI indisponible${error?.message ? ` : ${error.message}` : ''}`,
    };
  }

  return {
    mode: 'LIVE',
    candidates: Number(data.candidates ?? 0),
    institutionalNeeds: Number(data.institutional_needs ?? 0),
    activeMatches: Number(data.candidate_job_matches ?? 0),
    placements: Number(data.placements ?? 0),
    pipeline: 'Connecté à institutional_billing',
  };
}
