import type { AgentContext, AgentId } from "./domain";

export const AGENTS: { id: AgentId; name: string; role: string }[] = [
  { id: "strategist", name: "Le Stratège", role: "GTM africain mobile-first" },
  { id: "creator", name: "Le Créateur", role: "contenus WhatsApp, LinkedIn, email" },
  { id: "designer", name: "Le Designer", role: "brief visuel Canva/Figma" },
  { id: "analyst", name: "L’Analyste", role: "intelligence marché et FCFA" },
  { id: "cmo", name: "Le CMO IA", role: "plan marketing 30/60/90" }
];

export function runAgent(agentId: AgentId, context: AgentContext): string {
  const base = `${context.productName} — ${context.offer} pour ${context.buyer} au ${context.country} (${context.price}).`;
  switch (agentId) {
    case "strategist":
      return `GTM: positionner ${base} Priorité: canal WhatsApp-first, preuve rapide, diagnostic 10 minutes, paiement contrôlé.`;
    case "creator":
      return `WhatsApp: Bonjour, j’ai construit ${context.productName} pour transformer offre, contenus, relances et ventes. On teste sur ton activité ?`;
    case "designer":
      return `brief visuel: interface sombre premium, or du Sahel, accents terre cuite, modules Agent, CRM et Revenue Cockpit.`;
    case "analyst":
      return `marché: analyser douleurs PME, niveau de maturité digitale, canaux d’achat, budget en FCFA et urgence commerciale.`;
    case "cmo":
      return `30/60/90: 30 jours preuve et scripts, 60 jours pipeline et paiements, 90 jours cas client, upsell et scale.`;
  }
}

export function generateLeadEnginePlan(context: AgentContext) {
  return {
    icp: `${context.buyer} avec besoin de prospection, relance, contenus et conversion au ${context.country}`,
    script: `J’ai construit ${context.productName} pour installer un moteur commercial IA. Offre: ${context.offer}. Prix: ${context.price}.`,
    sequence: [
      "J+0 ouverture WhatsApp avec promesse claire",
      "J+1 preuve et exemple concret",
      "J+3 question de qualification",
      "J+5 offre pilote et diagnostic",
      "J+7 closing propre",
      "J+14 relance finale et archivage CRM"
    ],
    channels: ["WhatsApp", "LinkedIn", "Email"],
    nextAction: "Créer 25 prospects qualifiés sandbox et 3 messages personnalisés avant validation humaine SEND."
  };
}
