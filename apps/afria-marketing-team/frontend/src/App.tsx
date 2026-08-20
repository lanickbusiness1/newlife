import { useMemo, useState } from "react";
import { AGENTS, generateLeadEnginePlan, runAgent } from "./agents";
import { CANONICAL_PRODUCT, CRM_STAGES, PRODUCT_SECTIONS, type AgentContext } from "./domain";
import { exportEvidenceJson, exportHtmlReport, exportMarketingPlanMarkdown } from "./exporters";
import { simulatePolicy } from "./policy";
import { assessProductionReadiness, calculateRevenueMath } from "./revenueEngine";
import { saveWorkspace } from "./storage";
import "./styles.css";

const initialContext: AgentContext = {
  productName: "AfrIA Marketing Team™",
  country: "Bénin",
  buyer: "CEO PME",
  offer: "Starter Revenue Engine",
  price: "49 900 FCFA"
};

export default function App() {
  const [context, setContext] = useState(initialContext);
  const [humanApproved, setHumanApproved] = useState(false);
  const [saved, setSaved] = useState("");

  const leadPlan = useMemo(() => generateLeadEnginePlan(context), [context]);
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

  function persist() {
    const record = saveWorkspace("afria-marketing-team-production", { context, leadPlan, revenue, readiness });
    setSaved(`Sauvegardé ${record.savedAt}`);
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">{CANONICAL_PRODUCT.assetId} · {CANONICAL_PRODUCT.baseline}</p>
          <h1>AfrIA Marketing Team™</h1>
          <p className="lead">Production Product propriétaire pour transformer offres, ICP, campagnes, CRM, relances et revenus mesurables.</p>
          <div className="hero-actions">
            <button onClick={persist}>Sauvegarder le workspace</button>
            <label className="approval"><input type="checkbox" checked={humanApproved} onChange={event => setHumanApproved(event.target.checked)} /> Validation humaine SEND / EXPORT</label>
          </div>
          <p className="saved">{saved || CANONICAL_PRODUCT.productionRevenueReadyLiteral}</p>
        </div>
        <aside className="status-card">
          <strong>{CANONICAL_PRODUCT.productStandard}</strong>
          <span>Software artifact: {readiness.productionProductReady ? "READY" : "BLOCKED"}</span>
          <span>Revenue live: {readiness.productionRevenueReady ? "READY" : "NO-GO"}</span>
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
          <p>Blockers: {readiness.blockers.join(" · ")}</p>
        </article>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>R.E.M.E</h2>
          <ul><li>Objections enregistrées</li><li>Messages gagnants</li><li>Preuves client</li><li>Leçons réutilisables</li></ul>
        </article>
        <article className="panel wide">
          <h2>Export Center</h2>
          <p>Policy EXPORT: {exportPolicy.state}</p>
          <textarea readOnly value={exportMarketingPlanMarkdown(exportPayload)} />
          <details><summary>JSON evidence</summary><pre>{exportEvidenceJson(exportPayload)}</pre></details>
          <details><summary>HTML report</summary><pre>{exportHtmlReport(exportPayload)}</pre></details>
        </article>
      </section>

      <footer>{PRODUCT_SECTIONS.join(" · ")}</footer>
    </main>
  );
}
