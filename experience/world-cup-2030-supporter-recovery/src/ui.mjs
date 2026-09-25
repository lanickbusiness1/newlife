import { recoveryManifest, surfaces, tournamentNotice } from "./model.mjs";
import { hostDataset, qualifiedHostTeams } from "./hosts.mjs";
import { DEFAULT_PREFERENCES, HOST_FOCUS_OPTIONS, SUPPORTED_LANGUAGES, normalizePreferences } from "./preferences.mjs";
import { DEFAULT_PROFILE, normalizeSupporterProfile, isProfileReady } from "./profile.mjs";
import { normalizeOutbox, queueOfflineAction } from "./outbox.mjs";
import { validateApiEnvelope } from "./api-envelope.mjs";
import { assessTicketRisk, sanitizeEvidenceRecord } from "./vault.mjs";

const PREFS_KEY = "supporter2030.preferences.v1";
const VAULT_KEY = "supporter2030.ticketEvidence.v1";
const PROFILE_KEY = "supporter2030.profile.v1";
const OUTBOX_KEY = "supporter2030.outbox.v1";

const state = {
  active: "home",
  preferences: loadPreferences(),
  profile: loadProfile(),
  evidence: loadEvidence(),
  outbox: loadOutbox(),
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

function safeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function loadPreferences() {
  return normalizePreferences(safeJson(PREFS_KEY, DEFAULT_PREFERENCES));
}
function savePreferences(value) {
  state.preferences = normalizePreferences(value);
  safeStore(PREFS_KEY, state.preferences);
}
function loadProfile() {
  return normalizeSupporterProfile(safeJson(PROFILE_KEY, DEFAULT_PROFILE));
}
function saveProfile(value) {
  state.profile = normalizeSupporterProfile(value);
  safeStore(PROFILE_KEY, state.profile);
}
function loadEvidence() {
  const value = safeJson(VAULT_KEY, []);
  return Array.isArray(value) ? value.slice(0, 20).map(function (item) {
    return sanitizeEvidenceRecord(item);
  }) : [];
}
function saveEvidence(records) {
  state.evidence = records.slice(0, 20);
  safeStore(VAULT_KEY, state.evidence);
}
function loadOutbox() {
  return normalizeOutbox(safeJson(OUTBOX_KEY, []));
}
function saveOutbox(records) {
  state.outbox = normalizeOutbox(records);
  safeStore(OUTBOX_KEY, state.outbox);
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

function profileSummary() {
  if (!isProfileReady(state.profile)) {
    return card("Profil supporter", "Configure un pseudo et un pays pour personnaliser l’expérience sans créer de compte.", "LOCAL · PRIVACY-FIRST", '<button class="text-button" data-go="profile">Configurer</button>');
  }
  const favorites = state.profile.favoriteTeams.length ? state.profile.favoriteTeams.join(", ") : "aucune équipe favorite";
  return card(
    state.profile.nickname,
    state.profile.country + " · " + favorites,
    "PROFIL LOCAL",
    '<button class="text-button" data-go="profile">Modifier</button>'
  );
}

function hostCards() {
  return hostDataset.mainHosts.concat(hostDataset.centenaryHosts).map(function (item) {
    const body = item.role === "HOST"
      ? "Pays hôte principal confirmé par la FIFA."
      : "Pays accueillant un match de célébration du centenaire.";
    const meta = item.role === "HOST" ? "HOST · SOURCE_PROVEN" : "CENTENARY · SOURCE_PROVEN";
    return card(item.country, body, meta, '<div class="source-line">Vérifié le ' +
      escapeHtml(new Date(item.verifiedAt).toLocaleDateString("fr-FR")) + '</div>');
  }).join("");
}

function qualifiedCards() {
  return qualifiedHostTeams.map(function (team) {
    const favorite = state.profile.favoriteTeams.some(function (name) {
      return name.toLowerCase() === team.team.toLowerCase();
    });
    return card(
      team.team,
      "Qualification automatique liée au statut d’hôte ou d’hôte du centenaire, avec provenance FIFA.",
      "QUALIFIED · SOURCE_PROVEN",
      favorite ? '<span class="pill">★ Favori</span>' : ""
    );
  }).join("");
}

function evidenceList() {
  if (!state.evidence.length) return '<div class="empty-mini">Aucune preuve enregistrée sur cet appareil.</div>';
  return state.evidence.map(function (record) {
    return '<article class="evidence-row"><strong>' +
      escapeHtml(record.seller || "Vendeur non nommé") +
      '</strong><span>' + escapeHtml(record.reference || "Sans référence") +
      '</span><small>' + escapeHtml(record.createdAt) +
      '</small><p>' + escapeHtml(record.receiptNote || "Aucune note") + '</p></article>';
  }).join("");
}

function outboxList() {
  if (!state.outbox.length) return '<div class="empty-mini">Aucune action en attente sur cet appareil.</div>';
  return state.outbox.slice().reverse().map(function (item) {
    const summary = item.type === "COMMUNITY_DRAFT"
      ? item.payload.text
      : item.type === "WATCH_PARTY_INTEREST"
        ? item.payload.host + (item.payload.note ? " · " + item.payload.note : "")
        : item.payload.nickname + " · " + item.payload.country;
    return '<article class="outbox-row"><strong>' + escapeHtml(item.type) +
      '</strong><p>' + escapeHtml(summary) +
      '</p><small>LOCAL_ONLY · ' + escapeHtml(item.createdAt) + '</small></article>';
  }).join("");
}

function apiBoundaryStatus() {
  return validateApiEnvelope({
    eventYear: 2030,
    provenance: hostDataset.source,
    data: qualifiedHostTeams
  });
}

function home() {
  return [
    '<section class="hero"><span class="eyebrow">Independent supporter app · ', String(recoveryManifest.targetYear), '</span>',
    '<h1>Le football mondial, vécu depuis l’Afrique.</h1>',
    '<p>Mobile-first, offline-ready et fail-closed sur les données non vérifiées.</p>',
    '<div class="hero-actions"><button data-go="matches">Match Center</button>',
    '<button class="ghost" data-go="community">Communautés</button></div></section>',
    '<section class="proof-strip"><span>6 qualifications hôtes sourcées</span><span>0 match inventé</span>',
    '<span>PWA offline</span><span>Outbox locale: ', String(state.outbox.length), '</span></section>',
    '<section class="grid">',
    profileSummary(),
    card("Match Center", tournamentNotice(), "FAIL-CLOSED", ""),
    card("Ticket Safety", "Analyse de risque et conservation locale minimale des preuves.", "LOCAL-FIRST", ""),
    card("Mode économie", state.preferences.dataSaver ? "Activé sur cet appareil." : "Désactivé sur cet appareil.", "OFFLINE-READY", ""),
    '</section>'
  ].join("");
}

function matches() {
  return [
    '<section class="screen-head"><span class="eyebrow">Match Center</span><h1>Les preuves avant le score.</h1>',
    '<p>Seules les qualifications officiellement sourcées sont affichées. Les affiches, horaires et stades restent fermés sans source fraîche.</p></section>',
    '<section class="grid">', qualifiedCards(), '</section>',
    '<div class="empty-state"><strong>Aucun calendrier de match chargé</strong><p>',
    escapeHtml(tournamentNotice()), '</p><span class="status">FIXTURES · EVIDENCE_REQUIRED</span></div>'
  ].join("");
}

function hosts() {
  return [
    '<section class="screen-head"><span class="eyebrow">Hôtes 2030</span><h1>Trois continents, six pays.</h1>',
    '<p>Vue construite uniquement à partir de la désignation et des qualifications automatiques publiées par la FIFA.</p>',
    '<a class="source-link" href="', escapeHtml(hostDataset.source.sourceUrl), '" target="_blank" rel="noreferrer">Source FIFA</a></section>',
    '<section class="grid">', hostCards(), '</section>'
  ].join("");
}

function community() {
  return [
    '<section class="screen-head"><span class="eyebrow">Communautés</span><h1>Participer même hors ligne.</h1>',
    '<p>Les actions restent dans une file locale tant qu’aucun backend modéré et autorisé n’est connecté.</p></section>',
    '<form id="community-form" class="form-card">',
    '<label>Brouillon supporter<textarea name="text" maxlength="280" placeholder="Ton message — aucun mot de passe ni donnée sensible."></textarea></label>',
    '<div class="hero-actions"><button type="submit">Mettre en file offline</button>',
    '<button type="button" class="ghost" id="watch-interest">Intérêt watch party · ', escapeHtml(state.preferences.hostFocus), '</button></div>',
    '</form>',
    '<div class="notice">Aucune publication réseau n’est effectuée dans cette build. Backend communautaire : <strong>AUTHORITY_EDGE_PENDING</strong>.</div>',
    '<section class="evidence-list">', outboxList(), '</section>'
  ].join("");
}

function travel() {
  return [
    '<section class="screen-head"><span class="eyebrow">Voyage & Culture</span><h1>Inspiration séparée des règles officielles.</h1></section>',
    '<section class="grid">',
    card("Focus actuel", state.preferences.hostFocus, "PRÉFÉRENCE LOCALE", ""),
    card("Entrée & séjour", "Visa, santé et formalités ne seront affichés qu’avec provenance officielle et fraîcheur.", "COMPLIANCE", ""),
    card("Mobilité", "Transport, cartes et itinéraires restent des connecteurs à brancher.", "EVIDENCE_REQUIRED", ""),
    card("Culture", "Contenus culturels éditoriaux séparés des règles officielles de voyage.", "EDITORIAL", ""),
    '</section>'
  ].join("");
}

function vault() {
  const risk = state.scan
    ? '<div class="risk risk-' + state.scan.level.toLowerCase() + '"><strong>Risque ' +
      escapeHtml(state.scan.level) + '</strong><span>' +
      escapeHtml(state.scan.signals.length ? state.scan.signals.join(", ") : "aucun signal heuristique") + '</span></div>'
    : "";
  return [
    '<section class="screen-head"><span class="eyebrow">Ticket Safety</span><h1>Garder la preuve, jamais le secret.</h1>',
    '<p>Le Vault reste local à cet appareil et masque les suites ressemblant à des numéros de carte.</p></section>',
    '<form id="vault-form" class="form-card"><label>Vendeur / plateforme<input name="seller" maxlength="120" autocomplete="off"></label>',
    '<label>Référence<input name="reference" maxlength="120" autocomplete="off"></label>',
    '<label>Note de preuve<textarea name="receiptNote" maxlength="500" placeholder="Décrire la preuve sans mot de passe, CVV ni donnée sensible."></textarea></label>',
    '<div class="hero-actions"><button type="submit">Enregistrer localement</button>',
    '<button type="button" class="ghost" id="risk-scan">Analyser le risque</button></div>', risk, '</form>',
    '<section class="evidence-list">', evidenceList(), '</section>'
  ].join("");
}

function assistant() {
  const boundary = apiBoundaryStatus();
  return [
    '<section class="screen-head"><span class="eyebrow">Assistant IA</span><h1>Répondre avec un truth state.</h1></section>',
    '<div class="assistant-box"><div class="prompt">« Qu’est-ce qui est vérifié aujourd’hui ? »</div>',
    '<div class="reply">Hôtes principaux : Maroc, Portugal, Espagne. Matchs du centenaire : Argentine, Paraguay, Uruguay. Ces six sélections sont qualifiées automatiquement selon la source FIFA chargée. Aucun calendrier, stade ou autre équipe n’est revendiqué.</div>',
    '<span class="status">API BOUNDARY · ', boundary.ok ? "PASS" : "BLOCKED", '</span></div>'
  ].join("");
}

function profile() {
  const favorites = state.profile.favoriteTeams.join(", ");
  return [
    '<section class="screen-head"><span class="eyebrow">Profil supporter</span><h1>Une identité locale, pas un compte.</h1>',
    '<p>Aucun email ni téléphone n’est demandé dans cette build.</p></section>',
    '<form id="profile-form" class="form-card">',
    '<label>Pseudo<input name="nickname" maxlength="40" value="', escapeHtml(state.profile.nickname), '" placeholder="Ex. Lanick"></label>',
    '<label>Pays<input name="country" maxlength="40" value="', escapeHtml(state.profile.country), '" placeholder="Ex. Bénin"></label>',
    '<label>Équipes favorites<textarea name="favoriteTeams" maxlength="200" placeholder="Séparer par des virgules, max 5">', escapeHtml(favorites), '</textarea></label>',
    '<label class="check"><input type="checkbox" name="notifications"', state.profile.notifications ? " checked" : "", '> Autoriser les notifications locales quand elles seront disponibles</label>',
    '<button type="submit">Enregistrer sur cet appareil</button></form>',
    '<div class="notice">Les favoris sont des <strong>préférences utilisateur</strong>, pas une déclaration de qualification.</div>'
  ].join("");
}

function settings() {
  const languageOptions = SUPPORTED_LANGUAGES.map(function (language) {
    return '<option value="' + escapeHtml(language) + '"' + (state.preferences.language === language ? " selected" : "") +
      '>' + escapeHtml(language.toUpperCase()) + '</option>';
  }).join("");
  const hostOptions = HOST_FOCUS_OPTIONS.map(function (host) {
    return '<option value="' + escapeHtml(host) + '"' + (state.preferences.hostFocus === host ? " selected" : "") +
      '>' + escapeHtml(host) + '</option>';
  }).join("");
  return [
    '<section class="screen-head"><span class="eyebrow">Réglages</span><h1>Préférences locales.</h1><p>Aucun compte requis.</p></section>',
    '<form id="settings-form" class="form-card"><label>Langue préférée<select name="language">', languageOptions, '</select></label>',
    '<label>Hub favori<select name="hostFocus">', hostOptions, '</select></label>',
    '<label class="check"><input type="checkbox" name="dataSaver"', state.preferences.dataSaver ? " checked" : "", '> Mode économie de données</label>',
    '<button type="submit">Enregistrer sur cet appareil</button></form>'
  ].join("");
}

const content = { home, matches, hosts, community, travel, vault, assistant, profile, settings };

function wireScreen() {
  document.querySelectorAll("[data-go]").forEach(function (button) {
    button.addEventListener("click", function () { navigate(button.dataset.go); });
  });

  const profileForm = document.querySelector("#profile-form");
  if (profileForm) {
    profileForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const data = new FormData(profileForm);
      saveProfile({
        nickname: data.get("nickname"),
        country: data.get("country"),
        favoriteTeams: String(data.get("favoriteTeams") || "").split(","),
        notifications: data.get("notifications") === "on"
      });
      saveOutbox(queueOfflineAction(state.outbox, {
        type: "PROFILE_SYNC",
        payload: { nickname: state.profile.nickname, country: state.profile.country }
      }));
      render();
    });
  }

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

  const communityForm = document.querySelector("#community-form");
  if (communityForm) {
    communityForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const data = new FormData(communityForm);
      saveOutbox(queueOfflineAction(state.outbox, {
        type: "COMMUNITY_DRAFT",
        payload: { text: data.get("text") }
      }));
      render();
    });
    document.querySelector("#watch-interest")?.addEventListener("click", function () {
      saveOutbox(queueOfflineAction(state.outbox, {
        type: "WATCH_PARTY_INTEREST",
        payload: { host: state.preferences.hostFocus, note: "Local interest only" }
      }));
      render();
    });
  }

  const vaultForm = document.querySelector("#vault-form");
  if (vaultForm) {
    vaultForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(vaultForm).entries());
      saveEvidence([sanitizeEvidenceRecord(data)].concat(state.evidence));
      state.scan = null;
      render();
    });
    document.querySelector("#risk-scan")?.addEventListener("click", function () {
      const data = Object.fromEntries(new FormData(vaultForm).entries());
      state.scan = assessTicketRisk(String(data.seller || "") + " " + String(data.reference || "") + " " + String(data.receiptNote || ""));
      render();
    });
  }
}

function render() {
  const main = document.querySelector("#app");
  main.innerHTML = (content[state.active] || content.home)();
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
    '" aria-label="' + escapeHtml(surface.label) + '"><span>' + escapeHtml(surface.label) + '</span></button>';
}).join("");

document.querySelectorAll(".nav-btn").forEach(function (button) {
  button.addEventListener("click", function () { navigate(button.dataset.route); });
});

if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register("./service-worker.js").catch(function () {});
}

render();
