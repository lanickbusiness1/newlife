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
  { id: "community", label: "Communautés", purpose: "supporter groups and moderation" },
  { id: "travel", label: "Voyage & Culture", purpose: "travel, culture and safety guidance" },
  { id: "vault", label: "Ticket Safety", purpose: "anti-scam and ticket evidence vault" },
  { id: "assistant", label: "Assistant IA", purpose: "grounded supporter assistance" }
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
    return "Données compétition non chargées — aucune qualification ou affiche n’est revendiquée.";
  }
  return "Données compétition sourcées — vérifier la fraîcheur avant affichage.";
}
