export const CASH_ACTIVATION = {
  status: "READY_TO_SELL",
  noImaginaryBlockersRule: "Live setup items are activation tasks unless a verified technical, legal, security, or permission failure exists.",
  owner: "Lanick Mohamed / AfrIAgenesis®",
  primaryWhatsApp: "+22961107373",
  secondaryWhatsApp: "+224611406262",
  firstOffer: {
    name: "Starter Revenue Engine",
    price: "49 900 FCFA",
    promise: "une offre claire, un ICP, un script WhatsApp/LinkedIn/email, un pipeline CRM et une séquence 14 jours prête à envoyer"
  },
  dayOneTarget: {
    prospects: 100,
    responses: 30,
    diagnostics: 10,
    sales: 4,
    revenueFcfa: 199600
  },
  priorityChannels: ["WhatsApp direct", "LinkedIn", "email ciblé", "réseau terrain Bénin/Mali/Guinée"],
  activationActions: [
    "Envoyer 100 messages ciblés",
    "Réserver 10 diagnostics",
    "Envoyer 4 propositions Starter",
    "Encaisser le premier paiement",
    "Transformer le premier résultat en cas client"
  ],
  openingMessage:
    "Bonjour, j’ai finalisé AfrIA Marketing Team™, une équipe marketing IA prête à générer offre, scripts, CRM et relances pour entrepreneurs et PME africaines. L’offre Starter est à 49 900 FCFA avec un diagnostic rapide. On le lance pour votre activité ?"
} as const;

export function buildWhatsAppActivationLink(message: string = CASH_ACTIVATION.openingMessage): string {
  const phone = CASH_ACTIVATION.primaryWhatsApp.replace(/\D/g, "");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function summarizeDayOneTarget(): string {
  const { prospects, responses, diagnostics, sales, revenueFcfa } = CASH_ACTIVATION.dayOneTarget;
  return `${prospects} prospects → ${responses} réponses → ${diagnostics} diagnostics → ${sales} ventes → ${revenueFcfa.toLocaleString("fr-FR")} FCFA`;
}
