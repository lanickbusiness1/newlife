const unavailableKpis = {
  mode: 'DEGRADED',
  candidates: null,
  institutionalNeeds: null,
  activeMatches: null,
  placements: null,
  pipeline: null,
  status: 'Indicateurs temporairement indisponibles',
  warning: 'Aucune valeur de remplacement n’est affichée.',
};

function toMetric(value) {
  if (value === null || value === undefined || value === '') return null;
  const metric = Number(value);
  return Number.isFinite(metric) && metric >= 0 ? metric : null;
}

export async function loadInvestorKpis(supabase) {
  try {
    const { data, error } = await supabase.rpc('investor_demo_kpis');
    const row = Array.isArray(data) ? data[0] : data;

    if (error || !row) return { ...unavailableKpis };

    return {
      mode: 'LIVE',
      candidates: toMetric(row.candidates),
      institutionalNeeds: toMetric(row.institutional_needs),
      activeMatches: toMetric(row.candidate_job_matches),
      placements: toMetric(row.placements),
      pipeline: toMetric(row.pipeline_opportunities),
      status: 'Données agrégées vérifiées',
    };
  } catch {
    return { ...unavailableKpis };
  }
}
