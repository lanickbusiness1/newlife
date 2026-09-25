export type CeaPrimaryIntent =
  | "Identité"
  | "Voyage"
  | "Mémoire & Culture"
  | "Installation"
  | "Investissement"
  | "Communauté";

export type CeaHorizon = "<30d" | "30-90d" | "3-12m" | ">12m";
export type CeaLanguage = "EN" | "FR" | "PT";

export type CeaReturnForm = {
  name: string;
  email: string;
  whatsapp: string;
  country: string;
  organization: string;
  language: CeaLanguage;
  primaryIntent: CeaPrimaryIntent;
  whyNow: string;
  horizon: CeaHorizon;
  budgetUsd: number;
  household: string;
  investmentProject: string;
  consentContact: boolean;
};

export type CeaAttribution = {
  contentId: string;
  narrativeSource: string;
  sourceCampaign: string;
};

export type CeaQualification = {
  profile: "CEA_RETURN";
  content_id: string;
  narrative_source: string;
  primary_intent: CeaPrimaryIntent;
  language: CeaLanguage;
  priority: "P0 - Immédiat" | "P1 - Cette semaine" | "P2 - Ce mois" | "P3 - Nurture";
  next_best_offer:
    | "Diagnostic gratuit"
    | "Pack Dossier 150 USD"
    | "Accueil Cotonou 600 USD"
    | "Installation 1 500 USD"
    | "Investissement 2 000 USD+";
  estimated_value_usd: number;
  payment_status: "Non proposé";
  revenue_attributed_usd: number;
  contact_allowed: boolean;
};

export const CEA_CONTENT_DEFAULT = "VODUN-KAKPO-001";
export const CEA_NARRATIVE_DEFAULT = "griot/capsule-01";
export const CEA_CAMPAIGN_DEFAULT = "griot-vodun-patrimoine-avenir";

export function resolveCeaAttribution(search: string): CeaAttribution {
  const params = new URLSearchParams(search);
  return {
    contentId: params.get("utm_content") || CEA_CONTENT_DEFAULT,
    narrativeSource: params.get("utm_campaign") || CEA_NARRATIVE_DEFAULT,
    sourceCampaign: params.get("utm_source") || CEA_CAMPAIGN_DEFAULT,
  };
}

export function buildCeaQualifyPayload(form: CeaReturnForm, attribution: CeaAttribution) {
  return {
    content_id: attribution.contentId,
    narrative_source: attribution.narrativeSource,
    primary_intent: form.primaryIntent,
    horizon: form.horizon,
    budget_usd: Number.isFinite(form.budgetUsd) ? Math.max(0, form.budgetUsd) : 0,
    investment_project: form.investmentProject.trim() || null,
    consent_contact: form.consentContact,
    language: form.language,
  };
}

export function buildCeaCrmPayload(
  form: CeaReturnForm,
  attribution: CeaAttribution,
  qualification: CeaQualification,
  leadId: string,
) {
  return {
    lead_id: leadId,
    name: form.name.trim(),
    email: form.email.trim() || null,
    whatsapp: form.whatsapp.trim() || null,
    country: form.country.trim() || null,
    organization: form.organization.trim() || null,
    content_id: attribution.contentId,
    narrative_source: attribution.narrativeSource,
    primary_intent: form.primaryIntent,
    next_best_offer: qualification.next_best_offer,
    language: form.language,
    consent_contact: form.consentContact,
    revenue_attributed_usd: 0,
    payment_status: "Non proposé",
    priority: qualification.priority,
    note: [
      `why_now=${form.whyNow.trim() || "not_provided"}`,
      `household=${form.household.trim() || "not_provided"}`,
      `source_campaign=${attribution.sourceCampaign}`,
    ].join("; "),
  };
}

export function canPersistCeaLead(form: CeaReturnForm): boolean {
  return Boolean(
    form.consentContact &&
    form.name.trim() &&
    (form.email.trim() || form.whatsapp.trim())
  );
}

export function buildCeaWhatsAppMessage(
  form: CeaReturnForm,
  attribution: CeaAttribution,
): string {
  const name = form.name.trim() || "Prospect";
  return [
    `Bonjour, je suis ${name}.`,
    `Je souhaite un diagnostic Retour aux Sources™ — intention : ${form.primaryIntent}.`,
    `Horizon : ${form.horizon}.`,
    `Référence contenu : ${attribution.contentId}.`,
    "Merci de confirmer la prochaine étape, le prix applicable et les conditions avant tout paiement.",
  ].join(" ");
}


export function buildCeaReturnPath(): string {
  return "/retour-sources";
}

export function isCeaReturnPath(pathname: string): boolean {
  return pathname.replace(/\/+$/, "") === buildCeaReturnPath();
}
