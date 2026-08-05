import { createClient } from '@supabase/supabase-js';
import './styles.css';

const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;

const demo = {
  candidates: 1284,
  institutionalNeeds: 17,
  activeMatches: 146,
  placements: 23,
  pipeline: '184.5 M GNF',
  clients: ['CIAUD', 'Orange Guinée']
};

async function loadRealKpis() {
  if (!supabase) return { mode: 'DEMO', ...demo };
  const tables = ['candidates','institutional_needs','candidate_job_matches','placements'];
  const values = {};
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) return { mode: 'DEMO', ...demo, warning: 'Connexion partielle au backend' };
    values[table] = count ?? 0;
  }
  return {
    mode: 'LIVE',
    candidates: values.candidates,
    institutionalNeeds: values.institutional_needs,
    activeMatches: values.candidate_job_matches,
    placements: values.placements,
    pipeline: 'À calculer depuis institutional_billing',
    clients: demo.clients
  };
}

function card(label, value) {
  return `<article class="card"><span>${label}</span><strong>${value}</strong></article>`;
}

async function render() {
  const kpi = await loadRealKpis();
  document.querySelector('#app').innerHTML = `
    <main>
      <header><div><p class="brand">AfrIAgenesis®</p><h1>AfrIA Recruit™</h1><p>Living Talent OS — Investor Demonstrator</p></div><span class="mode">${kpi.mode}</span></header>
      <section class="hero"><h2>Le moteur africain de talent vérifié, explicable et gouverné.</h2><p>Backend cloud Supabase actif, matching explicable, consentement, institutions, facturation et revue humaine.</p></section>
      <section class="grid">
        ${card('Candidats', kpi.candidates)}
        ${card('Besoins institutionnels', kpi.institutionalNeeds)}
        ${card('Matchs', kpi.activeMatches)}
        ${card('Placements', kpi.placements)}
        ${card('Pipeline', kpi.pipeline)}
        ${card('Pilotes', kpi.clients.join(' · '))}
      </section>
      <section class="panel"><h3>Parcours démontré</h3><ol><li>Besoin institutionnel</li><li>Matching explicable</li><li>Consentement candidat</li><li>Revue humaine</li><li>Placement</li><li>Facturation et apprentissage</li></ol></section>
      ${kpi.warning ? `<p class="warning">${kpi.warning}</p>` : ''}
    </main>`;
}
render();
