export type StartCapabilityId = "prospect" | "call-intelligence" | "proposal" | "signal";

export type StartCapability = {
  id: StartCapabilityId;
  name: string;
  outcome: string;
  freePromise: string;
  inputLabel: string;
  inputPlaceholder: string;
  paidCta: string;
  bundleCta: string;
};

export type FreePreview = {
  capabilityId: StartCapabilityId;
  title: string;
  output: string;
  isBoundedFreePreview: true;
  checkoutState: "CONTACT_TO_ACTIVATE";
};

export const START_CAPABILITIES: readonly StartCapability[] = [
  {
    id: "prospect",
    name: "AfrIA Prospect",
    outcome: "Transformer des informations d’entreprise en message d’approche exploitable.",
    freePromise: "Un message d’approche personnalisé, court et prêt à relire avant envoi.",
    inputLabel: "Entreprise ou prospect",
    inputPlaceholder: "Ex. Entreprise: Kora Logistics. Activité: logistique B2B. Besoin observé: retards de livraison.",
    paidCta: "Activer / acheter AfrIA Prospect",
    bundleCta: "Voir AfrIA Agent Starter Pack"
  },
  {
    id: "call-intelligence",
    name: "AfrIA Call Intelligence",
    outcome: "Transformer un transcript en résumé, décisions et actions.",
    freePromise: "Un résumé borné avec uniquement les décisions et actions explicitement présentes dans le texte.",
    inputLabel: "Transcript ou notes d’appel",
    inputPlaceholder: "Collez un extrait de transcript ou vos notes d’appel.",
    paidCta: "Activer / acheter AfrIA Call Intelligence",
    bundleCta: "Voir AfrIA Agent Starter Pack"
  },
  {
    id: "proposal",
    name: "AfrIA Proposal",
    outcome: "Transformer un contexte commercial en proposition structurée sans inventer de chiffres.",
    freePromise: "Une ossature de proposition avec hypothèses et chiffres non fournis marqués À confirmer.",
    inputLabel: "Contexte de proposition",
    inputPlaceholder: "Ex. Entreprise: Kora Logistics. Besoin: réduire les retards de livraison. Aucun budget communiqué.",
    paidCta: "Activer / acheter AfrIA Proposal",
    bundleCta: "Voir AfrIA Agent Starter Pack"
  },
  {
    id: "signal",
    name: "AfrIA Signal",
    outcome: "Transformer une information brute en signal structuré et prochaines actions.",
    freePromise: "Un signal structuré en fait, implication, incertitude et action suivante.",
    inputLabel: "Signal brut",
    inputPlaceholder: "Collez l’information, l’annonce, la note ou l’opportunité à structurer.",
    paidCta: "Activer / acheter AfrIA Signal",
    bundleCta: "Voir AfrIA Agent Starter Pack"
  }
] as const;

export function buildStartEntryPath(): string {
  return "/start";
}

export function isStartEntryPath(pathname: string): boolean {
  return pathname.replace(/\/+$/, "") === buildStartEntryPath();
}

export function getStartCapability(id: StartCapabilityId): StartCapability {
  const capability = START_CAPABILITIES.find(item => item.id === id);
  if (!capability) throw new Error(`Unknown start capability: ${id}`);
  return capability;
}

function cleanInput(input: string): string {
  return input.replace(/\s+/g, " ").trim().slice(0, 3000);
}

function extractTaggedValue(input: string, tag: string): string | null {
  const expression = new RegExp(`${tag}\\s*:\\s*([^.;]+)`, "i");
  return input.match(expression)?.[1]?.trim() ?? null;
}

function firstSentences(input: string, max = 3): string[] {
  return input
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean)
    .slice(0, max);
}

export function buildFreePreview(id: StartCapabilityId, rawInput: string): FreePreview {
  const capability = getStartCapability(id);
  const input = cleanInput(rawInput);
  if (!input) {
    throw new Error("INPUT_REQUIRED");
  }

  if (id === "prospect") {
    const company = extractTaggedValue(input, "Entreprise") ?? "votre entreprise";
    const need = extractTaggedValue(input, "Besoin(?: observé)?") ?? "le besoin mentionné";
    return {
      capabilityId: id,
      title: `${capability.name} — aperçu gratuit`,
      output: `Bonjour ${company}, j’ai relevé un enjeu autour de ${need}. AfrIAgenesis® peut vous aider à clarifier le problème et la prochaine action utile, sans promesse non vérifiée. Souhaitez-vous un diagnostic express basé sur vos données réelles ?`,
      isBoundedFreePreview: true,
      checkoutState: "CONTACT_TO_ACTIVATE"
    };
  }

  if (id === "call-intelligence") {
    const sentences = firstSentences(input);
    return {
      capabilityId: id,
      title: `${capability.name} — aperçu gratuit`,
      output: `Résumé provisoire\n${sentences.map(sentence => `• ${sentence}`).join("\n")}\n\nDécisions explicites : À confirmer dans le transcript complet.\nActions explicites : À confirmer dans le transcript complet.`,
      isBoundedFreePreview: true,
      checkoutState: "CONTACT_TO_ACTIVATE"
    };
  }

  if (id === "proposal") {
    const company = extractTaggedValue(input, "Entreprise") ?? "Client à confirmer";
    const need = extractTaggedValue(input, "Besoin") ?? input.slice(0, 220);
    return {
      capabilityId: id,
      title: `${capability.name} — aperçu gratuit`,
      output: `Client : ${company}\nBesoin : ${need}\nRésultat proposé : cadrage du besoin, solution, étapes et critères de succès.\nPérimètre : À confirmer.\nBudget : À confirmer.\nDélais : À confirmer.\nPreuves/KPI : À confirmer avec les données client.`,
      isBoundedFreePreview: true,
      checkoutState: "CONTACT_TO_ACTIVATE"
    };
  }

  return {
    capabilityId: id,
    title: `${capability.name} — aperçu gratuit`,
    output: `Fait / signal : ${input.slice(0, 500)}\nImplication potentielle : à valider contre le contexte marché, pays et produit.\nIncertitudes : source, date, portée et preuve à vérifier.\nProchaine action : qualifier le signal avant décision commerciale ou opérationnelle.`,
    isBoundedFreePreview: true,
    checkoutState: "CONTACT_TO_ACTIVATE"
  };
}
