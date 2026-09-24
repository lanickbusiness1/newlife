import { recoveryManifest, surfaces, tournamentNotice } from "./model.mjs";
import { hostDataset, qualifiedHostTeams } from "./hosts.mjs";
import { DEFAULT_PREFERENCES, HOST_FOCUS_OPTIONS, SUPPORTED_LANGUAGES, normalizePreferences } from "./preferences.mjs";
import { assessTicketRisk, sanitizeEvidenceRecord } from "./vault.mjs";

const PREFS_KEY = "supporter2030.preferences.v1";
const VAULT_KEY = "supporter2030.ticketEvidence.v1";
const state = {
  active: "home",
  preferences: loadPreferences(),
  evidence: loadEvidence(),
  scan: null
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, function (char) {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#039;";
  });
}

function safeJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function loadPreferences() {
  return normalizePreferences(safeJson(PREFS_KEY, DEFAULT_PREFERENCES));
}

function savePreferences(preferences) {
  state.preferences = normalizePreferences(preferences);
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(state.preferences));
  } catch {}
}

function loadEvidence() {
  const value = safeJson(VAULT_KEY, []);
  return Array.isArray(value) ? value.slice(0, 20).map(function (item) {
    return sanitizeEvidenceRecord(item);
  }) : [];
}

function saveEvidence(records) {
  state.evidence = records.slice(0, 20);
  try {
    localStorage.setItem(VAULT_KEY, JSON.stringify(state.evidence));
  } catch {}
}

function card(title, body, meta, extra) {
  return [
    '<article class="card">',
    '<div class="card-kicker">', escapeHtml(meta || ""), '</div>',
    '<h2>', escapeHtml(title), '</h2>',
    '<p>', escapeHtml(body), '</p>',
    extra || "",
    '</article>'
  ].join("");
}

function hostCards() {
  const all = hostDataset.mainHosts.concat(hostDataset.centenaryHosts);
  return all.map(function (item) {
    const body = item.role === "HOST"
      ? "Pays hôte principal confirmé par la FIFA."
      : "Pays accueillant un match de célébration du centenaire.";
    const meta = item.role === "HOST" ? "HOST · SOURCE_PROVEN" : "CENTENARY · SOURCE_PROVEN";
    const extra = '<div class="source-line">Vérifié le ' +
      escapeHtml(new Date(item.verifiedAt).toLocaleDateString("fr-FR")) +
      '</div>';
    return card(item.country, body, meta, extra);
  }).join("");
}

function qualifiedCards() {
  return qualifiedHostTeams.map(function (team) {
    return card(
      team.team,
      "Qualification automatique liée au statut d’hôte ou d’hôte du centenaire, avec provenance FIFA.",
      "QUALIFIED · SOURCE_PROVEN",
      ""
    );
  }).join("");
}

function evidenceList() {
  if (!state.evidence.length) {
    return '<div class="empty-mini">Aucune preuve enregistrée sur cet appareil.</div>';
  }
  return state.evidence.map(function (record) {
    return [
      '<article class="evidence-row">',
      '<strong>', escapeHtml(record.seller || "Vendeur non nommé"), '</strong>',
      '<span>', escapeHtml(record.reference || "Sans référence"), '</span>',
      '<small>', escapeHtml(record.createdAt), '</small>',
      '<p>', escapeHtml(record.receiptNote || "Aucune note"), '</p>',
      '</article>'
    ].join("");
  }).join("");
}

function home() {
  return [
    '<section class="hero">',
    '<span class="eyebrow">Independent supporter app · ', String(recoveryManifest.targetYear), '</span>',
    '<h1>Le football mondial, vécu depuis l’Afrique.</h1>',
    '<p>Un produit mobile-first, offline-ready et fail-closed sur toutes les données sensibles ou non vérifiées.</p>',
    '<div class="hero-actions">',
    '<button data-go="matches">Match Center</button>',
    '<button class="ghost" data-go="hosts">Voir les hôtes 2030</button>',
    '</div></section>',
    '<section class="proof-strip">',
    '<span>6 qualifications hôtes sourcées</span>',
    '<span>0 match inventé</span>',
    '<span>PWA offline</span>',
    '<span>Vault local</span>',
    '</section>',
    '<section class="grid">',
    card("Match Center", tournamentNotice(), "Fail-closed", ""),
    card("Hôtes 2030", "Maroc, Portugal, Espagne + Argentine, Paraguay et Uruguay sont les seuls hubs chargés avec preuve FIFA.", "SOURCE_PROVEN", ""),
    card("Ticket Safety", "Analyse de risque et conservation locale minimale des preuves.", "Local-first", ""),
    card("Mode économie", state.preferences.dataSaver ? "Activé sur cet appareil." : "Désactivé sur cet appareil.", "Offline-ready", ""),
    '</section>'
  ].join("");
}

function matches() {
  return [
    '<section class="screen-head"><span class="eyebrow">Match Center</span>',
    '<h1>Les preuves avant le score.</h1>',
    '<p>Seules les qualifications officiellement sourcées sont affichées. Les affiches, horaires et stades restent fermés sans source fraîche.</p>',
    '</section>',
    '<section class="grid">', qualifiedCards(), '</section>',
    '<div class="empty-state"><strong>Aucun calendrier de match chargé</strong>',
    '<p>', escapeHtml(tournamentNotice()), '</p>',
    '<span class="status">FIXTURES · EVIDENCE_REQUIRED</span></div>'
  ].join("");
}

function hosts() {
  return [
    '<section class="screen-head"><span class="eyebrow">Hôtes 2030</span>',
    '<h1>Trois continents, six pays.</h1>',
    '<p>Cette vue est construite uniquement à partir de la désignation et des qualifications automatiques publiées par la FIFA.</p>',
    '<a class="source-link" href="', escapeHtml(hostDataset.source.sourceUrl), '" target="_blank" rel="noreferrer">Source FIFA</a>',
    '</section><section class="grid">', hostCards(), '</section>'
  ].join("");
}

function community() {
  return [
    '<section class="screen-head"><span class="eyebrow">Communautés</span><h1>Supporter ensemble, avec garde-fous.</h1></section>',
    '<section class="grid">',
    card("Cercles pays", "Espaces supporters par pays avec règles de modération et signalement.", "Communautés", ""),
    card("Watch parties", "Découverte locale et invitations ; aucune promesse d’événement non vérifié.", "Expérience", ""),
    card("Trust & Safety", "Le backend communautaire reste à connecter avant toute ouverture publique.", "AUTHORITY_EDGE_PENDING", ""),
    '</section>'
  ].join("");
}

function travel() {
  return [
    '<section class="screen-head"><span class="eyebrow">Voyage & Culture</span>',
    '<h1>Inspiration séparée des règles officielles.</h1></section>',
    '<section class="grid">',
    card("Focus actuel", state.preferences.hostFocus, "Préférence locale", ""),
    card("Entrée & séjour", "Visa, santé et formalités ne seront affichés qu’avec provenance officielle et fraîcheur.", "Compliance", ""),
    card("Mobilité", "Transport, cartes et itinéraires restent des connecteurs à brancher.", "EVIDENCE_REQUIRED", ""),
    card("Culture", "Contenus culturels éditoriaux séparés des règles officielles de voyage.", "Editorial", ""),
    '</section>'
  ].join("");
}

function vault() {
  const risk = state.scan
    ? '<div class="risk risk-' + state.scan.level.toLowerCase() + '"><strong>Risque ' +
      escapeHtml(state.scan.level) + '</strong><span>' +
      escapeHtml(state.scan.signals.length ? state.scan.signals.join(", ") : "aucun signal heuristique") +
      '</span></div>'
    : "";
  return [
    '<section class="screen-head"><span class="eyebrow">Ticket Safety</span>',
    '<h1>Garder la preuve, jamais le secret.</h1>',
    '<p>Le Vault reste local à cet appareil. Il retire les coordonnées inutiles et masque les suites ressemblant à des numéros de carte.</p></section>',
    '<form id="vault-form" class="form-card">',
    '<label>Vendeur / plateforme<input name="seller" maxlength="120" autocomplete="off"></label>',
    '<label>Référence<input name="reference" maxlength="120" autocomplete="off"></label>',
    '<label>Note de preuve<textarea name="receiptNote" maxlength="500" placeholder="Décrire la preuve sans mot de passe, CVV ni données sensibles."></textarea></label>',
    '<div class="hero-actions"><button type="submit">Enregistrer localement</button>',
    '<button type="button" class="ghost" id="risk-scan">Analyser le risque</button></div>',
    risk,
    '</form><section class="evidence-list">', evidenceList(), '</section>'
  ].join("");
}

function assistant() {
  return [
    '<section class="screen-head"><span class="eyebrow">Assistant IA</span><h1>Répondre avec un truth state.</h1></section>',
    '<div class="assistant-box">',
    '<div class="prompt">« Qu’est-ce qui est vérifié aujourd’hui ? »</div>',
    '<div class="reply">Hôtes principaux : Maroc, Portugal, Espagne. Matchs du centenaire : Argentine, Paraguay, Uruguay. Ces six sélections sont qualifiées automatiquement selon la source FIFA chargée. Aucun calendrier, stade ou autre équipe n’est revendiqué dans cette build.</div>',
    '<span class="status">GROUNDING · SOURCE_PROVEN / EVIDENCE_REQUIRED</span>',
    '</div>'
  ].join("");
}

function settings() {
  const languageOptions = SUPPORTED_LANGUAGES.map(function (language) {
    return '<option value="' + escapeHtml(language) + '"' +
      (state.preferences.language === language ? " selected" : "") +
      '>' + escapeHtml(language.toUpperCase()) + '</option>';
  }).join("");
  const hostOptions = HOST_FOCUS_OPTIONS.map(function (host) {
    return '<option value="' + escapeHtml(host) + '"' +
      (state.preferences.hostFocus === host ? " selected" : "") +
      '>' + escapeHtml(host) + '</option>';
  }).join("");
  return [
    '<section class="screen-head"><span class="eyebrow">Réglages</span>',
    '<h1>Préférences locales.</h1><p>Aucun compte n’est requis dans cette build.</p></section>',
    '<form id="settings-form" class="form-card">',
    '<label>Langue préférée<select name="language">', languageOptions, '</select></label>',
    '<label>Hub favori<select name="hostFocus">', hostOptions, '</select></label>',
    '<label class="check"><input type="checkbox" name="dataSaver"',
    state.preferences.dataSaver ? " checked" : "",
    '> Mode économie de données</label>',
    '<button type="submit">Enregistrer sur cet appareil</button>',
    '</form>'
  ].join("");
}

const content = {
  home: home,
  matches: matches,
  hosts: hosts,
  community: community,
  travel: travel,
  vault: vault,
  assistant: assistant,
  settings: settings
};

function wireScreen() {
  document.querySelectorAll("[data-go]").forEach(function (button) {
    button.addEventListener("click", function () {
      navigate(button.dataset.go);
    });
  });

  const settingsForm = document.querySelector("#settings-form");
  if (settingsForm) {
    settingsForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const data = new FormData(settingsForm);
      savePreferences({
        language: data.get("language"),
        hostFocus: data.get("hostFocus"),
        dataSaver: data.get("dataSaver") === "on"
      });
      render();
    });
  }

  const vaultForm = document.querySelector("#vault-form");
  if (vaultForm) {
    vaultForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(vaultForm).entries());
      const record = sanitizeEvidenceRecord(data);
      saveEvidence([record].concat(state.evidence));
      state.scan = null;
      render();
    });
    const scanButton = document.querySelector("#risk-scan");
    if (scanButton) {
      scanButton.addEventListener("click", function () {
        const data = Object.fromEntries(new FormData(vaultForm).entries());
        state.scan = assessTicketRisk(
          String(data.seller || "") + " " +
          String(data.reference || "") + " " +
          String(data.receiptNote || "")
        );
        render();
      });
    }
  }
}

function render() {
  const main = document.querySelector("#app");
  const renderer = content[state.active] || content.home;
  main.innerHTML = renderer();
  document.querySelectorAll(".nav-btn").forEach(function (button) {
    button.classList.toggle("active", button.dataset.route === state.active);
  });
  wireScreen();
}

function navigate(route) {
  if (!surfaces.some(function (surface) { return surface.id === route; })) return;
  state.active = route;
  render();
}

document.querySelector("#nav").innerHTML = surfaces.map(function (surface) {
  return '<button class="nav-btn" data-route="' + escapeHtml(surface.id) +
    '" aria-label="' + escapeHtml(surface.label) +
    '"><span>' + escapeHtml(surface.label) + '</span></button>';
}).join("");

document.querySelectorAll(".nav-btn").forEach(function (button) {
  button.addEventListener("click", function () {
    navigate(button.dataset.route);
  });
});

if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register("./service-worker.js").catch(function () {});
}

render();
