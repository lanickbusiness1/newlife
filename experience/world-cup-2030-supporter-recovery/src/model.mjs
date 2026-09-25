export const recoveryManifest = Object.freeze({
  targetEvent: "World Cup",
  targetYear: 2030,
  canonicalIdentity: "UNRESOLVED",
  sourceRecovery: "NOT_RECOVERED",
  catalogMutation: "BLOCKED",
  productTruth: "RECOVERY_ARTIFACT",
  officialBranding: false
});

export const surfaces = Object.freeze([
  { id: "home", label: "Accueil", purpose: "supporter dashboard" },
  { id: "matches", label: "Match Center", purpose: "verified fixtures and scores only" },
  { id: "hosts", label: "Hôtes 2030", purpose: "source-proven host hubs" },
  { id: "community", label: "Communautés", purpose: "offline-safe supporter drafts and future moderated groups" },
  { id: "travel", label: "Voyage", purpose: "travel, culture and safety guidance" },
  { id: "vault", label: "Ticket Safety", purpose: "anti-scam and ticket evidence vault" },
  { id: "assistant", label: "Assistant IA", purpose: "grounded supporter assistance" },
  { id: "profile", label: "Profil", purpose: "privacy-preserving local supporter identity" },
  { id: "settings", label: "Réglages", purpose: "local preferences and data saver" }
]);

export const tournamentState = Object.freeze({
  status: "EVIDENCE_REQUIRED",
  teams: [],
  fixtures: [],
  qualification: [],
  source: null,
  verifiedAt: null
});

export function canPromoteQualification(record) {
  return Boolean(
    record &&
    typeof record.team === "string" &&
    record.team.trim() &&
    record.status === "QUALIFIED" &&
    typeof record.sourceUrl === "string" &&
    /^https:\/\//.test(record.sourceUrl) &&
    typeof record.verifiedAt === "string" &&
    !Number.isNaN(Date.parse(record.verifiedAt))
  );
}

export function tournamentNotice(state = tournamentState) {
  if (!state.source || !state.verifiedAt) {
    return "Calendrier et affiches non chargés — aucune rencontre n’est inventée.";
  }
  return "Données compétition sourcées — vérifier la fraîcheur avant affichage.";
}
