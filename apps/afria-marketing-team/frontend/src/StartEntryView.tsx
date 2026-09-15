import { useMemo, useState } from "react";
import { buildWhatsAppActivationLink } from "./activation";
import {
  START_CAPABILITIES,
  buildFreePreview,
  getStartCapability,
  type FreePreview,
  type StartCapabilityId
} from "./startEntry";

export default function StartEntryView() {
  const [selectedId, setSelectedId] = useState<StartCapabilityId>("prospect");
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<FreePreview | null>(null);
  const [error, setError] = useState("");

  const selected = useMemo(() => getStartCapability(selectedId), [selectedId]);
  const activationMessage = `Bonjour, je veux activer ${selected.name} depuis la page /start AfrIAgenesis®. Merci de m’indiquer le prix final, le mode de paiement disponible et les conditions de livraison avant encaissement.`;
  const bundleMessage = "Bonjour, je veux le AfrIA Agent Starter Pack (AfrIA Prospect + Call Intelligence + Proposal + Signal). Merci de confirmer le prix, le mode de paiement disponible et les conditions de livraison avant encaissement.";

  function selectCapability(id: StartCapabilityId) {
    setSelectedId(id);
    setPreview(null);
    setError("");
  }

  function generatePreview() {
    try {
      setPreview(buildFreePreview(selectedId, input));
      setError("");
    } catch (previewError) {
      setPreview(null);
      setError(previewError instanceof Error && previewError.message === "INPUT_REQUIRED"
        ? "Ajoutez quelques informations réelles pour générer l’aperçu gratuit."
        : "Impossible de générer cet aperçu avec les données fournies.");
    }
  }

  return (
    <main className="app-shell start-shell">
      <section className="start-hero">
        <p className="eyebrow">AfrIAgenesis® · Capability-to-Cash Entry</p>
        <h1>Que voulez-vous accomplir maintenant ?</h1>
        <p className="lead">Choisissez un résultat. Obtenez une micro-valeur gratuite, bornée et sans chiffres inventés. Si elle vous convient, activez la capacité complète ou le Starter Pack.</p>
        <div className="truth-strip">
          <span>4 capacités</span>
          <span>1 aperçu gratuit</span>
          <span>Aucun faux checkout</span>
          <span>Paiement confirmé avant encaissement</span>
        </div>
      </section>

      <section className="capability-grid" aria-label="Capacités AfrIAgenesis">
        {START_CAPABILITIES.map(capability => (
          <button
            className={`capability-card ${selectedId === capability.id ? "selected" : ""}`}
            key={capability.id}
            type="button"
            onClick={() => selectCapability(capability.id)}
          >
            <span className="capability-kicker">Résultat immédiat</span>
            <strong>{capability.name}</strong>
            <span>{capability.outcome}</span>
            <small>{capability.freePromise}</small>
          </button>
        ))}
      </section>

      <section className="start-workbench">
        <article className="panel start-input-panel">
          <p className="eyebrow">1 · Essayez</p>
          <h2>{selected.name}</h2>
          <p>{selected.freePromise}</p>
          <label className="start-input-label">
            {selected.inputLabel}
            <textarea
              value={input}
              placeholder={selected.inputPlaceholder}
              onChange={event => setInput(event.target.value)}
              maxLength={3000}
            />
          </label>
          <div className="start-actions">
            <button type="button" onClick={generatePreview}>Générer mon aperçu gratuit</button>
            <span>{input.length}/3000</span>
          </div>
          {error ? <p className="start-error" role="alert">{error}</p> : null}
        </article>

        <article className="panel start-preview-panel" aria-live="polite">
          <p className="eyebrow">2 · Vérifiez la valeur</p>
          {preview ? (
            <>
              <h2>{preview.title}</h2>
              <pre className="start-preview">{preview.output}</pre>
              <p className="start-disclaimer">Aperçu gratuit borné. Les informations manquantes restent « À confirmer ». Aucun envoi externe ni paiement n’est déclenché automatiquement.</p>
            </>
          ) : (
            <div className="empty-preview">
              <h2>Votre aperçu apparaîtra ici</h2>
              <p>Nous privilégions une première preuve d’utilité avant de vous demander d’acheter.</p>
            </div>
          )}
        </article>
      </section>

      <section className="conversion-panel">
        <div>
          <p className="eyebrow">3 · Activez seulement si utile</p>
          <h2>Passer de l’aperçu à l’exécution complète</h2>
          <p>Le checkout automatisé n’est pas encore déclaré configuré dans le Revenue Proof Gate. L’activation passe donc par le canal commercial réel AfrIAgenesis® : prix et mode de paiement sont confirmés avant encaissement.</p>
        </div>
        <div className="conversion-actions">
          <a className="button-link" href={buildWhatsAppActivationLink(activationMessage)} target="_blank" rel="noreferrer">{selected.paidCta}</a>
          <a className="button-link secondary-action" href={buildWhatsAppActivationLink(bundleMessage)} target="_blank" rel="noreferrer">{selected.bundleCta}</a>
          <a className="text-link" href="/">Accéder au cockpit AfrIA Marketing Team™</a>
        </div>
      </section>

      <footer>Signal → micro-valeur → activation → paiement prouvé → livraison → outcome → R.E.M.E™</footer>
    </main>
  );
}
