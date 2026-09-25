import { FormEvent, useEffect, useMemo, useState } from "react";
import { buildWhatsAppActivationLink } from "./activation";
import {
  buildCeaCrmPayload,
  buildCeaHeritageEventPayload,
  buildCeaQualifyPayload,
  buildCeaWhatsAppMessage,
  canPersistCeaLead,
  resolveCeaAttribution,
  type CeaHeritageEventType,
  type CeaQualification,
  type CeaReturnForm,
} from "./ceaReturn";
import "./ceaReturn.css";

const initialForm: CeaReturnForm = {
  name: "",
  email: "",
  whatsapp: "",
  country: "",
  organization: "",
  language: "FR",
  primaryIntent: "Mémoire & Culture",
  whyNow: "",
  horizon: "30-90d",
  budgetUsd: 0,
  household: "",
  investmentProject: "",
  consentContact: false,
};

function newClientId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}`;
}

function getOrCreateSessionId(): string {
  const key = "cea_return_session_id";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created = newClientId("CEA-SESSION");
  window.sessionStorage.setItem(key, created);
  return created;
}

export default function CeaReturnView() {
  const [form, setForm] = useState(initialForm);
  const [qualification, setQualification] = useState<CeaQualification | null>(null);
  const [crmState, setCrmState] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const attribution = useMemo(
    () => resolveCeaAttribution(window.location.search),
    [],
  );
  const sessionId = useMemo(() => getOrCreateSessionId(), []);
  const leadId = useMemo(() => newClientId("CEA-LEAD"), []);

  async function trackEvent(
    eventType: CeaHeritageEventType,
    options: { leadId?: string; consentContact?: boolean } = {},
  ) {
    try {
      await fetch("/cea/heritage/event/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildCeaHeritageEventPayload(sessionId, eventType, attribution, options),
        ),
      });
    } catch {
      // Measurement is best-effort and must never fabricate or block the user journey.
    }
  }

  useEffect(() => {
    void trackEvent("CONTENT_VIEW");
  }, [sessionId, attribution]);

  function setField<K extends keyof CeaReturnForm>(field: K, value: CeaReturnForm[K]) {
    setForm(current => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setCrmState("");
    setSubmitting(true);
    void trackEvent("CTA_CLICK");

    try {
      const qualifyResponse = await fetch("/cea/lead/qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCeaQualifyPayload(form, attribution)),
      });
      if (!qualifyResponse.ok) throw new Error("qualification_failed");
      const qualified = await qualifyResponse.json() as CeaQualification;
      setQualification(qualified);

      if (!canPersistCeaLead(form)) {
        setCrmState(
          form.consentContact
            ? "Ajoutez un email ou un WhatsApp pour enregistrer votre demande."
            : "Diagnostic calculé sans enregistrement CRM : consentement de contact non accordé.",
        );
        return;
      }

      const crmResponse = await fetch("/cea/crm/lead/persist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildCeaCrmPayload(form, attribution, qualified, leadId),
        ),
      });
      if (!crmResponse.ok) throw new Error("crm_request_failed");
      const crm = await crmResponse.json() as {
        persisted: boolean;
        reason: string;
        classification?: string;
      };
      setCrmState(
        crm.persisted
          ? "Votre demande a été enregistrée avec votre consentement."
          : `Diagnostic prêt. Persistance CRM non active sur cet environnement (${crm.classification ?? crm.reason}).`,
      );
      if (crm.persisted) {
        void trackEvent("LEAD_CREATED", {
          leadId,
          consentContact: form.consentContact,
        });
      }
    } catch {
      setError("Le diagnostic n’a pas pu être enregistré. Aucun paiement n’a été déclenché.");
    } finally {
      setSubmitting(false);
    }
  }

  const whatsappMessage = buildCeaWhatsAppMessage(form, attribution);

  return (
    <main className="app-shell cea-shell">
      <section className="cea-hero">
        <p className="eyebrow">Retour aux Sources™ · CEA Consulting Cotonou · AfrIAgenesis®</p>
        <h1>Mémoire vivante. Voyage conscient. Projet sécurisé.</h1>
        <p className="lead">
          Un parcours privé pour clarifier votre lien au Bénin, préparer votre voyage,
          votre installation ou votre projet d’investissement — sans confondre accompagnement
          privé et procédures officielles de l’État.
        </p>
        <div className="truth-strip">
          <span>Sources publiques N0 seulement</span>
          <span>Consentement avant CRM</span>
          <span>Aucun mandat public implicite</span>
          <span>Aucun paiement automatique</span>
        </div>
      </section>

      <section className="cea-story">
        <article className="panel">
          <p className="eyebrow">Mémoire → culture → avenir</p>
          <h2>Comprendre avant de consommer</h2>
          <p>
            Le Griot Numérique relie personnes, œuvres, lieux, institutions et sources vérifiables.
            Les savoirs communautaires, initiatiques ou sacrés restent hors du funnel public tant
            qu’un cadre de consentement et de gouvernance légitime n’est pas établi.
          </p>
          <p className="cea-source">
            Référence de contenu : <b>{attribution.contentId}</b> · narration : <b>{attribution.narrativeSource}</b>
          </p>
        </article>

        <article className="panel">
          <p className="eyebrow">Votre prochaine étape</p>
          <h2>Diagnostic Retour aux Sources™</h2>
          <p>
            Le diagnostic oriente vers l’offre appropriée. Il ne garantit aucune décision
            administrative, nationalité, délai officiel ou rendement d’investissement.
          </p>
          <a
            className="button-link secondary-action"
            href={buildWhatsAppActivationLink(whatsappMessage)}
            onClick={() => void trackEvent("WHATSAPP_START", { consentContact: form.consentContact })}
            target="_blank"
            rel="noreferrer"
          >
            Parler sur WhatsApp
          </a>
        </article>
      </section>

      <form className="panel cea-form" onSubmit={submit}>
        <div className="cea-form-heading">
          <div>
            <p className="eyebrow">Diagnostic en 12 questions</p>
            <h2>Quel parcours vous correspond ?</h2>
          </div>
          <span className="cea-no-charge">Aucun encaissement à cette étape</span>
        </div>

        <div className="form-grid">
          <label>Nom complet<input required value={form.name} onChange={e => setField("name", e.target.value)} /></label>
          <label>Email<input type="email" value={form.email} onChange={e => setField("email", e.target.value)} /></label>
          <label>WhatsApp<input value={form.whatsapp} onChange={e => setField("whatsapp", e.target.value)} placeholder="+229…" /></label>
          <label>Pays de résidence<input value={form.country} onChange={e => setField("country", e.target.value)} /></label>
          <label>Organisation / communauté<input value={form.organization} onChange={e => setField("organization", e.target.value)} /></label>
          <label>Langue
            <select value={form.language} onChange={e => setField("language", e.target.value as CeaReturnForm["language"])}>
              <option value="FR">Français</option>
              <option value="EN">English</option>
              <option value="PT">Português</option>
            </select>
          </label>
          <label>Objectif principal
            <select value={form.primaryIntent} onChange={e => setField("primaryIntent", e.target.value as CeaReturnForm["primaryIntent"])}>
              <option>Identité</option>
              <option>Voyage</option>
              <option>Mémoire & Culture</option>
              <option>Installation</option>
              <option>Investissement</option>
              <option>Communauté</option>
            </select>
          </label>
          <label>Horizon
            <select value={form.horizon} onChange={e => setField("horizon", e.target.value as CeaReturnForm["horizon"])}>
              <option value="<30d">&lt;30 jours</option>
              <option value="30-90d">30–90 jours</option>
              <option value="3-12m">3–12 mois</option>
              <option value=">12m">&gt;12 mois</option>
            </select>
          </label>
          <label>Budget indicatif USD<input type="number" min="0" value={form.budgetUsd} onChange={e => setField("budgetUsd", Number(e.target.value))} /></label>
          <label>Voyage / household<input value={form.household} onChange={e => setField("household", e.target.value)} placeholder="Seul, couple, famille…" /></label>
        </div>

        <label className="cea-long-field">Pourquoi maintenant ?
          <textarea value={form.whyNow} onChange={e => setField("whyNow", e.target.value)} maxLength={1200} />
        </label>

        <label className="cea-long-field">Si investissement : projet, montant envisagé, partenaires déjà identifiés
          <textarea value={form.investmentProject} onChange={e => setField("investmentProject", e.target.value)} maxLength={1200} />
        </label>

        <label className="approval cea-consent">
          <input
            type="checkbox"
            checked={form.consentContact}
            onChange={e => setField("consentContact", e.target.checked)}
          />
          J’autorise CEA Consulting / AfrIAgenesis® à enregistrer mes coordonnées et à me contacter pour ce diagnostic. Je peux retirer ce consentement.
        </label>

        <div className="cea-actions">
          <button type="submit" disabled={submitting}>{submitting ? "Qualification…" : "Faire mon diagnostic"}</button>
          <span>Content ID conservé : {attribution.contentId}</span>
        </div>

        {error ? <p className="start-error" role="alert">{error}</p> : null}
        {crmState ? <p className="cea-state">{crmState}</p> : null}
      </form>

      {qualification ? (
        <section className="panel cea-result" aria-live="polite">
          <p className="eyebrow">Résultat du diagnostic</p>
          <h2>{qualification.next_best_offer}</h2>
          <div className="evidence-grid">
            <div><b>Priorité</b><span>{qualification.priority.replace(" - ", "\n")}</span></div>
            <div><b>Intention</b><span>{qualification.primary_intent}</span></div>
            <div><b>Valeur offre</b><span>{qualification.estimated_value_usd} USD</span></div>
            <div><b>Paiement</b><span>{qualification.payment_status}</span></div>
            <div><b>Revenu attribué</b><span>{qualification.revenue_attributed_usd} USD</span></div>
          </div>
          <p>
            Un paiement n’est reconnu comme revenu qu’après preuve transactionnelle vérifiée.
            Cette page ne déclenche aucun débit.
          </p>
        </section>
      ) : null}

      <footer>
        Griot Numérique → diagnostic → consentement → CRM → proposition → paiement prouvé → expérience → R.E.M.E™
      </footer>
    </main>
  );
}
