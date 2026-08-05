import { createClient } from '@supabase/supabase-js';
import { loadInvestorKpis } from './kpi.js';
import './styles.css';

// Publishable browser credentials only. Never expose service_role keys here.
const defaultUrl = 'https://hzrnrdeqscfesxlvfztx.supabase.co';
const defaultPublishableKey = 'sb_publishable__Yq6PAVUE28v_cbnSk5PZg_G-SOMBOE';
const url = import.meta.env.VITE_SUPABASE_URL || defaultUrl;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || defaultPublishableKey;
const supabase = createClient(url, key);

function card(label, value) {
  return `<article class="card"><span>${label}</span><strong>${value}</strong></article>`;
}

async function render() {
  const kpi = {
    ...(await loadInvestorKpis(supabase)),
    clients: ['CIAUD', 'Orange Guinée'],
  };

  document.querySelector('#app').innerHTML = `
    <main>
      <header><div><p class="brand">AfrIAgenesis®</p><h1>AfrIA Recruit™</h1><p>Living Talent OS — Investor Demonstrator</p></div><span class="mode">${kpi.mode}</span></header>
      <section class="hero"><h2>Le moteur africain de talent vérifié, explicable et gouverné.</h2><p>Backend cloud Supabase, matching explicable, consentement, institutions, facturation et revue humaine.</p></section>
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

render().catch((error) => {
  console.error('AfrIA Recruit investor demo render failure', error);
  document.querySelector('#app').innerHTML = '<main><section class="panel"><h1>AfrIA Recruit™</h1><p>Le démonstrateur est temporairement indisponible.</p></section></main>';
});
