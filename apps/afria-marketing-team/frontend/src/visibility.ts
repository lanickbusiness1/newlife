export const VISIBILITY_CAPABILITY = {
  parentAssetId: "PRD-MKT-TEAM-001",
  capability: "AfrIA AI Visibility Intelligence™",
  metric: "African Enterprise Visibility Gap™",
  scoringVersion: "AEVG-1.0",
  newProductCreated: false,
  missingDataPolicy: "mark_missing_never_invent"
} as const;

export type VisibilityPriority = "critical" | "high" | "medium" | "low";
export type VisibilityConfidence = "high" | "medium" | "low";

export interface VisibilityAssessment {
  enterpriseName: string;
  country: string;
  verifiedIdentity: boolean;
  verifiedSourceCount: number;
  websitePresent: boolean;
  searchPresence?: number;
  aiPresence?: number;
  mediaPresence?: number;
  professionalPresence?: number;
  marketplacePresence?: number;
  institutionalPresence?: number;
  investorPresence?: number;
}

export interface VisibilityResult {
  parentAssetId: string;
  capability: string;
  metric: string;
  scoringVersion: string;
  newProductCreated: false;
  enterpriseName: string;
  country: string;
  visibilityScore: number;
  visibilityGap: number;
  priority: VisibilityPriority;
  confidence: VisibilityConfidence;
  observedDimensionRatio: number;
  missingDimensions: string[];
  recommendedActions: string[];
  missingDataPolicy: string;
}

type ObservationField =
  | "searchPresence"
  | "aiPresence"
  | "mediaPresence"
  | "professionalPresence"
  | "marketplacePresence"
  | "institutionalPresence"
  | "investorPresence";

const WEIGHTS: Record<ObservationField, number> & {
  verifiedIdentity: number;
  verifiedSourceCount: number;
  websitePresent: number;
} = {
  verifiedIdentity: 10,
  verifiedSourceCount: 5,
  websitePresent: 5,
  searchPresence: 15,
  aiPresence: 20,
  mediaPresence: 10,
  professionalPresence: 10,
  marketplacePresence: 10,
  institutionalPresence: 7.5,
  investorPresence: 7.5
};

const OBSERVATION_FIELDS: ObservationField[] = [
  "searchPresence",
  "aiPresence",
  "mediaPresence",
  "professionalPresence",
  "marketplacePresence",
  "institutionalPresence",
  "investorPresence"
];

const ACTIONS: Record<ObservationField, string> = {
  searchPresence: "Renforcer la découvrabilité Search/SEO avec pages canoniques, entités et preuves sourcées.",
  aiPresence: "Renforcer la visibilité IA/AEO-GEO-LLMO avec faits structurés, citations et contenus répondant aux prompts acheteurs.",
  mediaPresence: "Construire un media kit prouvé et des angles éditoriaux sans fabriquer de réputation.",
  professionalPresence: "Renforcer la présence sur les réseaux professionnels avec dirigeants, expertise et preuves commerciales.",
  marketplacePresence: "Publier les offres vérifiées sur les marketplaces et répertoires sectoriels pertinents.",
  institutionalPresence: "Améliorer la présence dans les registres, annuaires et sources institutionnelles vérifiables.",
  investorPresence: "Préparer un profil investisseur sourcé et les éléments de data room nécessaires à la découvrabilité financière."
};

function clampScore(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function priorityForGap(gap: number): VisibilityPriority {
  if (gap >= 70) return "critical";
  if (gap >= 50) return "high";
  if (gap >= 30) return "medium";
  return "low";
}

export function assessEnterpriseVisibility(input: VisibilityAssessment): VisibilityResult {
  let score = 0;
  score += input.verifiedIdentity ? WEIGHTS.verifiedIdentity : 0;
  score += (Math.min(Math.max(input.verifiedSourceCount, 0), 5) / 5) * WEIGHTS.verifiedSourceCount;
  score += input.websitePresent ? WEIGHTS.websitePresent : 0;

  const missingDimensions: string[] = [];
  for (const field of OBSERVATION_FIELDS) {
    const raw = input[field];
    if (raw === undefined) missingDimensions.push(field);
    score += (clampScore(raw) / 100) * WEIGHTS[field];
  }

  const visibilityScore = round2(score);
  const visibilityGap = round2(100 - visibilityScore);
  const observedDimensionRatio = round2((OBSERVATION_FIELDS.length - missingDimensions.length) / OBSERVATION_FIELDS.length);
  const confidence: VisibilityConfidence = observedDimensionRatio >= 0.8 ? "high" : observedDimensionRatio >= 0.5 ? "medium" : "low";

  const rankedActions: Array<{ deficit: number; action: string }> = [];
  if (!input.verifiedIdentity || input.verifiedSourceCount < 3) {
    rankedActions.push({ deficit: 15, action: "Renforcer l’Enterprise Visibility Profile™ avec identité et sources vérifiables." });
  }
  if (!input.websitePresent) {
    rankedActions.push({ deficit: 5, action: "Créer ou vérifier le site canonique et les données structurées de l’entreprise." });
  }
  for (const field of OBSERVATION_FIELDS) {
    const value = clampScore(input[field]);
    if (value < 50) {
      rankedActions.push({ deficit: WEIGHTS[field] * (1 - value / 100), action: ACTIONS[field] });
    }
  }
  rankedActions.sort((a, b) => b.deficit - a.deficit);

  return {
    ...VISIBILITY_CAPABILITY,
    enterpriseName: input.enterpriseName,
    country: input.country,
    visibilityScore,
    visibilityGap,
    priority: priorityForGap(visibilityGap),
    confidence,
    observedDimensionRatio,
    missingDimensions,
    recommendedActions: rankedActions.slice(0, 5).map(item => item.action)
  };
}
