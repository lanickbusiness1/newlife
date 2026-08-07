export const GENESIS_V4_REVENUE_ENGINE_ANCHOR = {
  genome: "GENESIS_V4",
  assetId: "GEN-V4-REV-ENGINE-001",
  canonicalOwner: "AfrIAgenesis®",
  linkedProduct: "AfrIA Marketing Team™",
  doctrine: "Release-to-Revenue Control Plane",
  invariant:
    "No AfrIAgenesis® product advances without offer, ICP, proof, channel, script, CRM, sequence, payment, first revenue, case study, upsell and a Scale/Correct/Kill decision.",
  chain:
    "Produit → Offre → ICP → Preuve → Canal → Script → CRM → Séquence → Paiement → Premier revenu → Cas client → Upsell → Scale / Correct / Kill"
} as const;

export const REVENUE_STAGES = [
  "product",
  "offer",
  "icp",
  "proof",
  "channel",
  "script",
  "crm",
  "sequence",
  "payment",
  "first_revenue",
  "case_study",
  "upsell",
  "scale_correct_kill"
] as const;

export type RevenueStage = (typeof REVENUE_STAGES)[number];
export type StageStatus = "ready" | "partial" | "missing" | "blocked";
export type ScaleDecision = "scale" | "correct" | "kill" | "hold";

export interface ProductRevenueEngineInput {
  product?: { id?: string; name: string; owner?: string; parentGenome?: string; market?: string };
  offer?: { name: string; promise: string; deliverable: string; price: number; currency: string; cta: string };
  icp?: { segment: string; buyerRole: string; geography: string[]; pains: string[]; urgency?: "low" | "medium" | "high" };
  proof?: { assets: string[]; evidenceLevel: "claim" | "demo" | "pilot" | "client_proof" | "auditable_pack" };
  channels?: { name: "linkedin" | "whatsapp" | "email" | "call" | "partner" | "field" | "other"; targetVolume: number; owner?: string }[];
  script?: { opening: string; qualification: string; objectionHandling: string[]; closing: string };
  crm?: CrmDefinition;
  sequence?: SequenceStep[];
  payment?: { methods: string[]; invoiceProcess: string; collectionOwner: string; paymentLink?: string };
  firstRevenue?: { amount: number; currency: string; customer: string; collectedAt: string; proofRef: string };
  caseStudy?: { title: string; customerSegment: string; metric: string; consent: boolean };
  upsell?: { offers: string[]; trigger: string };
  scaleDecision?: ScaleDecision;
}

export interface CrmDefinition {
  owner: string;
  stages: string[];
  followUpSlaHours: number;
}

export interface SequenceStep {
  day: number;
  channel: string;
  message: string;
  goal: string;
}

export interface StageAssessment {
  stage: RevenueStage;
  label: string;
  status: StageStatus;
  score: number;
  evidence: string[];
  blockers: string[];
  nextAction: string;
}

export interface RevenueEngineOutput {
  anchor: typeof GENESIS_V4_REVENUE_ENGINE_ANCHOR;
  productName: string;
  releaseStatus: "blocked" | "sellable" | "revenue_proven" | "scale_ready";
  currentStage: RevenueStage;
  completionRate: number;
  stages: StageAssessment[];
  gates: { m6: "pass" | "fail"; s7plus: "pass" | "fail"; m8: "pass" | "conditional" | "fail" };
  crmBlueprint: CrmDefinition;
  defaultSequence: SequenceStep[];
  blockers: string[];
  nextActions: string[];
  scaleDecision: ScaleDecision;
}

const LABELS: Record<RevenueStage, string> = {
  product: "Produit",
  offer: "Offre",
  icp: "ICP",
  proof: "Preuve",
  channel: "Canal",
  script: "Script",
  crm: "CRM",
  sequence: "Séquence",
  payment: "Paiement",
  first_revenue: "Premier revenu",
  case_study: "Cas client",
  upsell: "Upsell",
  scale_correct_kill: "Scale / Correct / Kill"
};

const ACTIONS: Record<RevenueStage, string> = {
  product: "Définir l’identité produit et rattacher l’actif au GENOME V4.",
  offer: "Créer l’offre monétisable : promesse, livrable, prix, CTA et délai.",
  icp: "Qualifier l’ICP : segment, décideur, géographie, douleurs, urgence.",
  proof: "Produire une preuve : démo, capture, audit, pack preuve ou cas pilote.",
  channel: "Choisir les canaux actifs : LinkedIn, WhatsApp, email, appels, partenaires ou terrain.",
  script: "Écrire les scripts DM, WhatsApp, appel, objections et closing.",
  crm: "Créer le pipeline CRM avec owner, étapes et SLA de relance.",
  sequence: "Installer la séquence J+0, J+1, J+3, J+5, J+7 et J+14.",
  payment: "Brancher Mobile Money, virement, facture, lien ou procédure de paiement.",
  first_revenue: "Obtenir le premier paiement et enregistrer la preuve d’encaissement.",
  case_study: "Transformer la livraison en cas client autorisé avec métrique claire.",
  upsell: "Définir l’upsell, le referral et le déclencheur post-livraison.",
  scale_correct_kill: "Décider : scaler, corriger, tuer ou maintenir l’offre."
};

const DEFAULT_CRM_STAGES = [
  "Signal",
  "Lead qualifié",
  "Diagnostic réservé",
  "Proposition envoyée",
  "Closing",
  "Paiement encaissé",
  "Livraison",
  "Preuve client",
  "Upsell / Referral"
];

export function createDefaultCrm(owner = "AfrIA Marketing Team™"): CrmDefinition {
  return { owner, stages: [...DEFAULT_CRM_STAGES], followUpSlaHours: 48 };
}

export function createDefaultSequence(productName: string, primaryChannel = "whatsapp"): SequenceStep[] {
  return [
    [0, "ouvrir la conversation", `Bonjour, j’ai une offre ${productName} conçue pour résoudre un problème concret et générer un résultat mesurable. Je peux te montrer le cas d’usage en 10 minutes.`],
    [1, "apporter une preuve", "Je t’envoie un exemple concret : problème, solution, livrable, prix, délai et preuve attendue."],
    [3, "qualifier le besoin", "La priorité aujourd’hui est plutôt vente, contenu, relance ou automatisation ?"],
    [5, "présenter l’offre", "Voici l’offre pilote : diagnostic, configuration, livraison rapide et mesure du résultat. Je peux démarrer cette semaine."],
    [7, "clôturer", "Je clôture les places pilotes. Tu préfères démarrer maintenant ou être recontacté à la prochaine vague ?"],
    [14, "relance finale propre", "Dernière relance propre : je ferme le suivi si ce n’est pas prioritaire. Sinon je te réserve un créneau de diagnostic."]
  ].map(([day, goal, message]) => ({ day: Number(day), channel: primaryChannel, goal: String(goal), message: String(message) }));
}

const text = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const items = (value: unknown[] | undefined) => Array.isArray(value) && value.length > 0;
const missing = (condition: boolean, message: string) => (condition ? "" : message);

function assessed(stage: RevenueStage, blockers: string[], evidence: string[], partial = false): StageAssessment {
  const cleanBlockers = blockers.filter(Boolean);
  const status: StageStatus = cleanBlockers.length === 0 ? "ready" : partial ? "partial" : "missing";
  return {
    stage,
    label: LABELS[stage],
    status,
    score: status === "ready" ? 100 : status === "partial" ? 50 : 0,
    evidence,
    blockers: cleanBlockers,
    nextAction: ACTIONS[stage]
  };
}

function assessStage(input: ProductRevenueEngineInput, stage: RevenueStage): StageAssessment {
  const product = input.product;
  const offer = input.offer;
  const icp = input.icp;
  const proof = input.proof;
  const channels = input.channels;
  const script = input.script;
  const crm = input.crm;
  const sequence = input.sequence;
  const payment = input.payment;
  const revenue = input.firstRevenue;
  const caseStudy = input.caseStudy;
  const upsell = input.upsell;

  switch (stage) {
    case "product":
      return assessed(stage, [
        missing(text(product?.name), "Nom produit absent"),
        product?.parentGenome && product.parentGenome !== "GENESIS_V4" ? "Produit non rattaché à GENESIS_V4" : ""
      ], product ? [product.name, product.parentGenome ?? "GENESIS_V4"] : []);
    case "offer":
      return assessed(stage, [
        missing(text(offer?.name), "Nom d’offre absent"),
        missing(text(offer?.promise), "Promesse absente"),
        missing(text(offer?.deliverable), "Livrable absent"),
        missing(typeof offer?.price === "number" && offer.price > 0, "Prix absent ou nul"),
        missing(text(offer?.currency), "Devise absente"),
        missing(text(offer?.cta), "CTA absent")
      ], offer ? [offer.name, `${offer.price} ${offer.currency}`, offer.cta] : []);
    case "icp":
      return assessed(stage, [
        missing(text(icp?.segment), "Segment ICP absent"),
        missing(text(icp?.buyerRole), "Rôle acheteur absent"),
        missing(items(icp?.geography), "Géographie cible absente"),
        missing(items(icp?.pains), "Douleurs client absentes")
      ], icp ? [icp.segment, icp.buyerRole, ...icp.geography] : []);
    case "proof":
      return assessed(stage, [
        missing(items(proof?.assets), "Preuves absentes"),
        missing(text(proof?.evidenceLevel), "Niveau de preuve absent")
      ], proof ? [proof.evidenceLevel, ...proof.assets] : []);
    case "channel": {
      const partial = channels?.some(channel => channel.targetVolume <= 0) === true;
      return assessed(stage, partial ? ["Un canal existe mais son volume cible est nul"] : [missing(items(channels), "Canal de vente absent")], channels?.map(channel => `${channel.name}:${channel.targetVolume}`) ?? [], partial);
    }
    case "script":
      return assessed(stage, [
        missing(text(script?.opening), "Ouverture absente"),
        missing(text(script?.qualification), "Question de qualification absente"),
        missing(items(script?.objectionHandling), "Réponses aux objections absentes"),
        missing(text(script?.closing), "Closing absent")
      ], script ? [script.opening, script.closing] : []);
    case "crm":
      return assessed(stage, [
        missing(text(crm?.owner), "Owner CRM absent"),
        missing(items(crm?.stages), "Étapes CRM absentes"),
        missing(typeof crm?.followUpSlaHours === "number" && crm.followUpSlaHours > 0, "SLA de relance absent")
      ], crm ? [crm.owner, `${crm.followUpSlaHours}h`, ...crm.stages] : []);
    case "sequence": {
      const partial = sequence !== undefined && sequence.length > 0 && sequence.length < 5;
      return assessed(stage, partial ? ["Séquence trop courte : minimum 5 touches"] : [missing(items(sequence), "Séquence de relance absente")], sequence?.map(step => `J+${step.day}:${step.channel}:${step.goal}`) ?? [], partial);
    }
    case "payment":
      return assessed(stage, [
        missing(items(payment?.methods), "Méthodes de paiement absentes"),
        missing(text(payment?.invoiceProcess), "Processus de facturation absent"),
        missing(text(payment?.collectionOwner), "Responsable cash collection absent")
      ], payment ? [...payment.methods, payment.invoiceProcess, payment.collectionOwner] : []);
    case "first_revenue":
      return assessed(stage, [
        missing(typeof revenue?.amount === "number" && revenue.amount > 0, "Montant encaissé absent"),
        missing(text(revenue?.currency), "Devise du revenu absente"),
        missing(text(revenue?.customer), "Client payant absent"),
        missing(text(revenue?.collectedAt), "Date d’encaissement absente"),
        missing(text(revenue?.proofRef), "Référence de preuve d’encaissement absente")
      ], revenue ? [revenue.customer, `${revenue.amount} ${revenue.currency}`, revenue.proofRef] : []);
    case "case_study":
      return assessed(stage, [
        missing(text(caseStudy?.title), "Titre cas client absent"),
        missing(text(caseStudy?.customerSegment), "Segment client absent"),
        missing(text(caseStudy?.metric), "Métrique d’impact absente"),
        missing(caseStudy?.consent === true, "Consentement publication absent")
      ], caseStudy ? [caseStudy.title, caseStudy.customerSegment, caseStudy.metric] : []);
    case "upsell":
      return assessed(stage, [
        missing(items(upsell?.offers), "Offres d’upsell absentes"),
        missing(text(upsell?.trigger), "Déclencheur d’upsell absent")
      ], upsell ? [upsell.trigger, ...upsell.offers] : []);
    case "scale_correct_kill":
      return assessed(stage, [missing(Boolean(input.scaleDecision), "Décision Scale/Correct/Kill absente")], input.scaleDecision ? [input.scaleDecision] : []);
  }
}

function deriveReleaseStatus(stages: StageAssessment[]): RevenueEngineOutput["releaseStatus"] {
  const readyThrough = (stage: RevenueStage) => stages.slice(0, REVENUE_STAGES.indexOf(stage) + 1).every(item => item.status === "ready");
  if (stages.every(item => item.status === "ready") && stages.at(-1)?.evidence.includes("scale")) return "scale_ready";
  if (readyThrough("first_revenue")) return "revenue_proven";
  if (readyThrough("payment")) return "sellable";
  return "blocked";
}

export function compileRevenueEngine(input: ProductRevenueEngineInput): RevenueEngineOutput {
  const stages = REVENUE_STAGES.map(stage => assessStage(input, stage));
  const firstNotReady = stages.find(stage => stage.status !== "ready") ?? stages[stages.length - 1]!;
  const readyCount = stages.filter(stage => stage.status === "ready").length;
  const completionRate = Math.round((readyCount / stages.length) * 100);
  const blockers = stages.flatMap(stage => stage.blockers.map(blocker => `${stage.label}: ${blocker}`));
  const releaseStatus = deriveReleaseStatus(stages);
  const primaryChannel = input.channels?.[0]?.name ?? "whatsapp";

  return {
    anchor: GENESIS_V4_REVENUE_ENGINE_ANCHOR,
    productName: input.product?.name ?? "UNNAMED_PRODUCT",
    releaseStatus,
    currentStage: firstNotReady.stage,
    completionRate,
    stages,
    gates: {
      m6: completionRate >= 70 ? "pass" : "fail",
      s7plus: input.payment?.methods?.length && input.crm?.owner ? "pass" : "fail",
      m8: releaseStatus === "scale_ready" ? "pass" : releaseStatus === "revenue_proven" ? "conditional" : "fail"
    },
    crmBlueprint: input.crm ?? createDefaultCrm(),
    defaultSequence: input.sequence ?? createDefaultSequence(input.product?.name ?? "AfrIAgenesis® product", primaryChannel),
    blockers,
    nextActions: stages.filter(stage => stage.status !== "ready").slice(0, 5).map(stage => `${stage.label}: ${stage.nextAction}`),
    scaleDecision: input.scaleDecision ?? "hold"
  };
}

export function assertReleaseToRevenue(input: ProductRevenueEngineInput): RevenueEngineOutput {
  const compiled = compileRevenueEngine(input);
  if (compiled.releaseStatus === "blocked") {
    throw new Error(`GENESIS_V4_REVENUE_ENGINE_BLOCKED: ${compiled.blockers.slice(0, 3).join("; ")}`);
  }
  return compiled;
}
