export type CeaPrimaryIntent =
  | "Identité"
  | "Voyage"
  | "Mémoire & Culture"
  | "Installation"
  | "Investissement"
  | "Communauté";

export type CeaHorizon = "<30d" | "30-90d" | "3-12m" | ">12m";
export type CeaLanguage = "EN" | "FR" | "PT";
export type CeaPriority = "P0 - Immédiat" | "P1 - Cette semaine" | "P2 - Ce mois" | "P3 - Nurture";
export type CeaNextBestOffer =
  | "Diagnostic gratuit"
  | "Pack Dossier 150 USD"
  | "Accueil Cotonou 600 USD"
  | "Installation 1 500 USD"
  | "Investissement 2 000 USD+";

export interface CeaReturnLeadInput {
  contentId: string;
  narrativeSource: string;
  primaryIntent: CeaPrimaryIntent;
  horizon: CeaHorizon;
  budgetUsd: number;
  investmentProject?: string;
  consentContact: boolean;
  language: CeaLanguage;
}

export interface CeaReturnLeadQualification {
  profile: "CEA_RETURN";
  contentId: string;
  narrativeSource: string;
  primaryIntent: CeaPrimaryIntent;
  language: CeaLanguage;
  priority: CeaPriority;
  nextBestOffer: CeaNextBestOffer;
  estimatedValueUsd: number;
  paymentStatus: "Non proposé";
  revenueAttributedUsd: 0;
  contactAllowed: boolean;
}

const OFFER_BY_INTENT: Record<CeaPrimaryIntent, { offer: CeaNextBestOffer; valueUsd: number }> = {
  "Identité": { offer: "Pack Dossier 150 USD", valueUsd: 150 },
  "Voyage": { offer: "Accueil Cotonou 600 USD", valueUsd: 600 },
  "Mémoire & Culture": { offer: "Accueil Cotonou 600 USD", valueUsd: 600 },
  "Installation": { offer: "Installation 1 500 USD", valueUsd: 1500 },
  "Investissement": { offer: "Investissement 2 000 USD+", valueUsd: 2000 },
  "Communauté": { offer: "Diagnostic gratuit", valueUsd: 0 }
};

function derivePriority(input: CeaReturnLeadInput): CeaPriority {
  const hasConcreteInvestment =
    input.primaryIntent === "Investissement" &&
    input.budgetUsd > 0 &&
    Boolean(input.investmentProject?.trim());

  if (hasConcreteInvestment) return "P0 - Immédiat";

  if (
    input.primaryIntent === "Installation" &&
    (input.horizon === "<30d" || input.horizon === "30-90d")
  ) {
    return "P0 - Immédiat";
  }

  if (
    input.primaryIntent === "Identité" ||
    input.primaryIntent === "Voyage" ||
    input.primaryIntent === "Mémoire & Culture"
  ) {
    return "P1 - Cette semaine";
  }

  if (input.primaryIntent === "Communauté" && input.horizon === ">12m") {
    return "P3 - Nurture";
  }

  return "P2 - Ce mois";
}

export function qualifyCeaReturnLead(input: CeaReturnLeadInput): CeaReturnLeadQualification {
  const mappedOffer = OFFER_BY_INTENT[input.primaryIntent];

  return {
    profile: "CEA_RETURN",
    contentId: input.contentId,
    narrativeSource: input.narrativeSource,
    primaryIntent: input.primaryIntent,
    language: input.language,
    priority: derivePriority(input),
    nextBestOffer: mappedOffer.offer,
    estimatedValueUsd: mappedOffer.valueUsd,
    paymentStatus: "Non proposé",
    revenueAttributedUsd: 0,
    contactAllowed: input.consentContact
  };
}
