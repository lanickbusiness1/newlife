import { recoveryManifest, surfaces, tournamentNotice } from "./model.mjs";

const state = { active: "home" };

function card(title, body, meta = "") {
  return `<article class="card"><div class="card-kicker">${meta}</div><h2>${title}</h2><p>${body}</p></article>`;
}

const content = {
  home: () => `
    <section class="hero">
      <span class="eyebrow">Independent supporter prototype · ${recoveryManifest.targetYear}</span>
      <h1>Le football mondial, vécu depuis l’Afrique.</h1>
      <p>Une reconstruction mobile-first en quarantaine, sans données officielles inventées et sans marque officielle.</p>
      <div class="hero-actions">
        <button data-go="matches">Voir le Match Center</button>
        <button class="ghost" data-go="community">Rejoindre les communautés</button>
      </div>
    </section>
    <section class="grid">
      ${card("Match Center", tournamentNotice(), "Données fail-closed")}
      ${card("Communautés", "Espaces supporters avec règles de modération et identité locale.", "Social")}
      ${card("Voyage & Culture", "Guides, mobilité et culture à connecter à des sources vérifiées.", "Découvrir")}
      ${card("Ticket Safety", "Conserver les preuves et repérer les signaux d’arnaque sans prétendre vendre des billets.", "Sécurité")}
    </section>`,
  matches: () => `
    <section class="screen-head"><span class="eyebrow">Match Center</span><h1>Aucune affiche inventée.</h1></section>
    <div class="empty-state">
      <strong>Données officielles requises</strong>
      <p>${tournamentNotice()}</p>
      <span class="status">EVIDENCE_REQUIRED</span>
    </div>`,
  community: () => `
    <section class="screen-head"><span class="eyebrow">Communautés</span><h1>Supporter ensemble, sans bruit.</h1></section>
    <section class="grid">
      ${card("Cercles pays", "Créer des groupes par pays lorsque les identités de compétition sont vérifiées.", "Communautés")}
      ${card("Watch parties", "Découverte locale et invitations avec garde-fous de sécurité.", "Expérience")}
      ${card("Modération", "Signalement, règles communautaires et contrôle des contenus abusifs.", "Trust & Safety")}
    </section>`,
  travel: () => `
    <section class="screen-head"><span class="eyebrow">Voyage & Culture</span><h1>Préparer le déplacement avec des preuves à jour.</h1></section>
    <section class="grid">
      ${card("Entrée & séjour", "Visa, formalités et exigences sanitaires uniquement via sources officielles fraîches.", "Compliance")}
      ${card("Culture locale", "Langues, gastronomie, patrimoine et codes locaux.", "Culture")}
      ${card("Mobilité", "Transport et itinéraires à connecter à des données vérifiées.", "Travel")}
    </section>`,
  vault: () => `
    <section class="screen-head"><span class="eyebrow">Ticket Safety</span><h1>La preuve avant la confiance.</h1></section>
    <section class="grid">
      ${card("Evidence Vault", "Conserver reçu, vendeur, date et référence sans exposer les données sensibles.", "Preuve")}
      ${card("Anti-scam", "Détecter les offres suspectes et rappeler les canaux officiels quand ils sont connus.", "Protection")}
      ${card("Aucun faux canal", "Ce prototype ne prétend ni vendre ni garantir des billets.", "Fail-closed")}
    </section>`,
  assistant: () => `
    <section class="screen-head"><span class="eyebrow">Assistant IA</span><h1>Répondre avec provenance.</h1></section>
    <div class="assistant-box">
      <p>Le moteur conversationnel n’est pas connecté dans cet artefact de récupération.</p>
      <div class="prompt">« Quelles données sont vérifiées aujourd’hui ? »</div>
      <div class="reply">Aucune donnée compétition n’est chargée dans cette version. Je ne vais pas inventer une équipe qualifiée, un match ou une date.</div>
    </div>`
};

function render() {
  const main = document.querySelector("#app");
  main.innerHTML = content[state.active]?.() ?? content.home();
  document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.go));
  });
  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === state.active);
  });
}

function navigate(route) {
  if (!surfaces.some((surface) => surface.id === route)) return;
  state.active = route;
  render();
}

document.querySelector("#nav").innerHTML = surfaces.map((surface) =>
  `<button class="nav-btn" data-route="${surface.id}" aria-label="${surface.label}"><span>${surface.label}</span></button>`
).join("");

document.querySelectorAll(".nav-btn").forEach((button) => {
  button.addEventListener("click", () => navigate(button.dataset.route));
});

render();
