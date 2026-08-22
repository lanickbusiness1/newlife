import { useMemo, useState } from "react";
import { CASH_ACTIVATION, buildWhatsAppActivationLink, summarizeDayOneTarget } from "./activation";
import { AGENTS, generateLeadEnginePlan, runAgent } from "./agents";
import { CANONICAL_PRODUCT, CRM_STAGES, PRODUCT_SECTIONS, type AgentContext } from "./domain";
import { exportEvidenceJson, exportHtmlReport, exportMarketingPlanMarkdown } from "./exporters";
import { simulatePolicy } from "./policy";
import { assessProductionReadiness, calculateRevenueMath } from "./revenueEngine";
import { saveWorkspace } from "./storage";
import { assessEnterpriseVisibility, VISIBILITY_CAPABILITY, type VisibilityAssessment } from "./visibility";
import "./styles.css";

const initialContext: AgentContext = {
  productName: "AfrIA Marketing Team™",
  country: "Bénin",
  buyer: "CEO PME",
  offer: "Starter Revenue Engine",
  price: "49 900 FCFA"
};

type VisibilityScoreField =
  | "searchPresence"
  | "aiPresence"
  | "mediaPresence"
  | "professionalPresence"
  | "marketplacePresence"
  | "institutionalPresence"
  | "investorPresence";

const VISIBILITY_SCORE_FIELDS: Array<{ key: VisibilityScoreField; label: string }> = [
  { key: "searchPresence", label: "Search / SEO" },
  { key: "aiPresence", label: "Moteurs IA / AEO-GEO" },
  { key: "mediaPresence", label: "Médias" },
  { key: "professionalPresence", label: "Réseaux professionnels" },
  { key: "marketplacePresence", label: "Marketplaces / répertoires" },
  { key: "institutionalPresence", label: "Sources institutionnelles" },
  { key: "investorPresence", label: "Sources investisseurs" }
];

const initialVisibility: VisibilityAssessment = {
  enterpriseName: "Entreprise cible",
  country: "Bénin",
  verifiedIdentity: true,
  verifiedSourceCount: 2,
  websitePresent: true,
  searchPresence: 45,
  aiPresence: 20,
  mediaPresence: 15,
  professionalPresence: 35,
  marketplacePresence: 10,
  institutionalPresence: 25,
  investorPresence: 5
};

export default function App() {
  const [context, setContext] = useState(initialContext);
  const [visibilityInput, setVisibilityInput] = useState(initialVisibility);
  const [humanApproved, setHumanApproved] = useState(false);
  const [saved, setSaved] = useState("");

  const leadPlan = useMemo(() => generateLeadEnginePlan(context), [context]);
  const visibility = useMemo(
    () => assessEnterpriseVisibility({ ...visibilityInput, country: context.country }),
    [visibilityInput, context.country]
  );
  const revenue = calculateRevenueMath({ presentations: 10000, expectedSalesPerHundred: 4, averagePrice: 49900 });
  const readiness = assessProductionReadiness({
    offerReady: true,
    icpReady: true,
    crmReady: true,
    paymentConfigured: false,
    whatsappConfigured: false,
    firstCashProof: false
  });
  const sendPolicy = simulatePolicy("SEND", { humanApproved });
  const exportPolicy = simulatePolicy("EXPORT", { humanApproved });
  const exportPayload = {
    productName: context.productName,
    assetId: CANONICAL_PRODUCT.assetId,
    offer: context.offer,
    productionRevenueReady: readiness.productionRevenueReady
  };

  function updateContext(field: keyof AgentContext, value: string) {
    setContext(current => ({ ...current, [field]: value }));
  }

  function updateVisibilityScore(field: VisibilityScoreField, value: string) {
    setVisibilityInput(current => ({ ...current, [field]: Number(value) }));
  }

  function persist() {
    const record = saveWorkspace("afria-marketing-team-production", {
      context,
      leadPlan,
      revenue,
      readiness,
      visibility,
      cashActivation: CASH_ACTIVATION
    });
    setSaved(`Sauvegardé ${record.savedAt}`);
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">{CANONICAL_PRODUCT.assetId} · {CANONICAL_PRODUCT.baseline}</p>
          <h1>AfrIA Marketing Team™</h1>
          <p className="lead">Production Product propriétaire pour transformer offres, ICP, campagnes, CRM, visibilité économique, relances et revenus mesurables.</p>
          <div className="hero-actions">
            <button onClick={persist}>Sauvegarder le workspace</button>
            <a className="button-link" href={buildWhatsAppActivationLink()} target="_blank" rel="noreferrer">Lancer WhatsApp cash</a>
            <label className="approval"><input type="checkbox" checked={humanApproved} onChange={event => setHumanApproved(event.target.checked)} /> Validation humaine SEND / EXPORT</label>
          </div>
          <p className="saved">{saved || "Aucun blocage imaginaire : statut commercial READY_TO_SELL"}</p>
        </div>
        <aside className="status-card">
          <strong>{CANONICAL_PRODUCT.productStandard}</strong>
          <span>Software artifact: {readiness.productionProductReady ? "READY" : "À corriger"}</span>
          <span>Commercial: {readiness.commercialStatus}</span>
          <span>Revenue: {readiness.productionRevenueReady ? "CASH_PROVEN" : "À ENCAISSER"}</span>
          <span>S7+ SEND: {sendPolicy.state}</span>
        </aside>
      </section>

      <section className="grid command">
        <article className="panel wide">
          <h2>Command Center</h2>
          <div className="form-grid">
            {Object.entries(context).map(([field, value]) => (
              <label key={field}>{field}<input value={value} onChange={event => updateContext(field as keyof AgentContext, event.target.value)} /></label>
            ))}
          </div>
        </article>
        <article className="panel">
          <h2>Governance</h2>
          <ul>
            <li>M6: {readiness.gates.m6}</li>
            <li>S7+: {readiness.gates.s7plus}</li>
            <li>CyberAudit: {readiness.gates.cyberAudit}</li>
            <li>M8: {readiness.gates.m8}</li>
            <li>Big4: {readiness.gates.big4}</li>
          </ul>
        </article>
      </section>

      <section className="grid">
        <article className="panel wide">
          <h2>{VISIBILITY_CAPABILITY.capability}</h2>
          <p><b>{VISIBILITY_CAPABILITY.metric}</b> · scoring {VISIBILITY_CAPABILITY.scoringVersion}</p>
          <div className="form-grid">
            <label>Entreprise<input value={visibilityInput.enterpriseName} onChange={event => setVisibilityInput(current => ({ ...current, enterpriseName: event.target.value }))} /></label>
            <label>Sources vérifiées<input type="number" min="0" value={visibilityInput.verifiedSourceCount} onChange={event => setVisibilityInput(current => ({ ...current, verifiedSourceCount: Number(event.target.value) }))} /></label>
            <label className="approval"><input type="checkbox" checked={visibilityInput.verifiedIdentity} onChange={event => setVisibilityInput(current => ({ ...current, verifiedIdentity: event.target.checked }))} /> Identité vérifiée</label>
            <label className="approval"><input type="checkbox" checked={visibilityInput.websitePresent} onChange={event => setVisibilityInput(current => ({ ...current, websitePresent: event.target.checked }))} /> Site canonique présent</label>
            {VISIBILITY_SCORE_FIELDS.map(field => (
              <label key={field.key}>{field.label}<input type="number" min="0" max="100" value={visibilityInput[field.key] ?? ""} onChange={event => updateVisibilityScore(field.key, event.target.value)} /></label>
            ))}
          </div>
        </article>
        <article className="panel">
          <h2>Visibility Cockpit</h2>
          <p>Score visibilité : <b>{visibility.visibilityScore}/100</b></p>
          <p>Visibility Gap : <b>{visibility.visibilityGap}/100</b></p>
          <p>Priorité : <b>{visibility.priority.toUpperCase()}</b></p>
          <p>Confiance : <b>{visibility.confidence}</b> · couverture {Math.round(visibility.observedDimensionRatio * 100)} %</p>
          <p>Données manquantes : {visibility.missingDimensions.length ? visibility.missingDimensions.join(" · ") : "aucune"}</p>
          <ol>{visibility.recommendedActions.map(action => <li key={action}>{action}</li>)}</ol>
        </article>
      </section>

      <section className="grid">
        <article className="panel wide">
          <h2>5 Agents</h2>
          <div className="agent-grid">
            {AGENTS.map(agent => <div className="agent" key={agent.id}><b>{agent.name}</b><small>{agent.role}</small><p>{runAgent(agent.id, context)}</p></div>)}
          </div>
        </article>
        <article className="panel">
          <h2>LeadEngine™</h2>
          <p>{leadPlan.icp}</p>
          <p>{leadPlan.script}</p>
          <ol>{leadPlan.sequence.map(step => <li key={step}>{step}</li>)}</ol>
        </article>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>CRM</h2>
          <div className="pipeline">{CRM_STAGES.map(stage => <span key={stage}>{stage}</span>)}</div>
        </article>
        <article className="panel">
          <h2>Revenue Cockpit</h2>
          <p>10 000 présentations × 4 % = <b>{revenue.expectedSales}</b> ventes attendues.</p>
          <p>Revenu attendu: <b>{revenue.expectedRevenue.toLocaleString("fr-FR")} FCFA</b></p>
          <p>Jour 1 cash: <b>{summarizeDayOneTarget()}</b></p>
          <p>Actions d’activation: {readiness.activationActions.join(" · ")}</p>
        </article>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>Cash Activation</h2>
          <p>{CASH_ACTIVATION.noImaginaryBlockersRule}</p>
          <ul>{CASH_ACTIVATION.activationActions.map(action => <li key={action}>{action}</li>)}</ul>
        </article>
        <article className="panel">
          <h2>R.E.M.E</h2>
          <ul><li>Objections enregistrées</li><li>Messages gagnants</li><li>Preuves client</li><li>Leçons réutilisables</li><li>Visibility Gap avant/après et attribution revenu</li></ul>
        </article>
      </section>

      <section className="grid">
        <article className="panel wide">
          <h2>Export Center</h2>
          <p>Policy EXPORT: {exportPolicy.state}</p>
          <textarea readOnly value={exportMarketingPlanMarkdown(exportPayload)} />
          <details><summary>JSON evidence</summary><pre>{exportEvidenceJson(exportPayload)}</pre></details>
          <details><summary>HTML report</summary><pre>{exportHtmlReport(exportPayload)}</pre></details>
          <details><summary>Enterprise visibility evidence</summary><pre>{JSON.stringify(visibility, null, 2)}</pre></details>
        </article>
      </section>

      <footer>{PRODUCT_SECTIONS.join(" · ")}</footer>
    </main>
  );
}
