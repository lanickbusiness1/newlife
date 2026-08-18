export const GENESIS_V4_REVENUE_ENGINE_ANCHOR = {
  genome: "GENESIS_V4",
  assetId: "GEN-V4-REV-ENGINE-001",
  version: "0.3.0",
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

export const GENESIS_V4_TODAY_INNOVATIONS = [
  "abundance_math",
  "qualified_volume",
  "proof_first_selling",
  "auto_gtm_takeover",
  "release_to_revenue_gate",
  "reme_learning_loop",
  "m6_s7plus_m8_big4_controls",
  "afria_marketing_team_as_revenue_operator"
] as const;

export type RevenueStage = (typeof REVENUE_STAGES)[number];
export type TodayInnovation = (typeof GENESIS_V4_TODAY_INNOVATIONS)[number];
export type StageStatus = "ready" | "partial" | "missing" | "blocked";
export type ScaleDecision = "scale" | "correct" | "kill" | "hold";
export type ReleaseStatus = "blocked" | "sellable" | "revenue_proven" | "scale_ready";

export interface ProductRevenueEngineInput {
  product?: {
    id?: string;
    name: string;
    owner?: string;
    parentGenome?: string;
    market?: string;
    validatedByCeo?: boolean;
    targetCountries?: string[];
  };
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
  governance?: {
    m6Reviewed?: boolean;
    s7plusReviewed?: boolean;
    m8Reviewed?: boolean;
    big4Required?: boolean;
    big4Reviewed?: boolean;
    humanApprovalRef?: string;
  };
  automation?: {
    autoTakeoverEnabled?: boolean;
    crmSyncEnabled?: boolean;
    paymentOpsEnabled?: boolean;
    remeLoggingEnabled?: boolean;
    emergencyStopEnabled?: boolean;
    rollbackPlanRef?: string;
  };
  metrics?: {
    presentationsTarget?: number;
    expectedSalesPerHundred?: number;
    targetRevenue?: number;
    maxCAC?: number;
  };
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

export interface RevenueMath {
  presentationsTarget: number;
  expectedSalesPerHundred: number;
  expectedSales: number;
  averagePrice: number;
  currency: string;
  expectedRevenue: number;
  law: "law_of_averages_x_law_of_large_numbers";
}

export interface AutoGtmRunbook {
  takeoverStatus: "armed" | "not_armed";
  operator: "AfrIA Marketing Team™";
  trigger: string;
  executionLoop: string[];
  safeguards: string[];
}

export interface RevenueEngineOutput {
  anchor: typeof GENESIS_V4_REVENUE_ENGINE_ANCHOR;
  innovations: TodayInnovation[];
  productName: string;
  releaseStatus: ReleaseStatus;
  currentStage: RevenueStage;
  completionRate: number;
  stages: StageAssessment[];
  gates: {
    m6: "pass" | "fail";
    s7plus: "pass" | "fail";
    m8: "pass" | "conditional" | "fail";
    big4: "pass" | "required" | "not_required";
  };
  crmBlueprint: CrmDefinition;
  defaultSequence: SequenceStep[];
  revenueMath: RevenueMath;
  autoGtmRunbook: AutoGtmRunbook;
  blockers: string[];
  nextActions: string[];
  scaleDecision: ScaleDecision;
  remeEvents: string[];
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

function readyThrough(stages: StageAssessment[], stage: RevenueStage) {
  return stages.slice(0, REVENUE_STAGES.indexOf(stage) + 1).every(item => item.status === "ready");
}

function deriveReleaseStatus(stages: StageAssessment[]): ReleaseStatus {
  if (stages.every(item => item.status === "ready") && stages.at(-1)?.evidence.includes("scale")) return "scale_ready";
  if (readyThrough(stages, "first_revenue")) return "revenue_proven";
  if (readyThrough(stages, "payment")) return "sellable";
  return "blocked";
}

function buildRevenueMath(input: ProductRevenueEngineInput): RevenueMath {
  const presentationsTarget = input.metrics?.presentationsTarget ?? input.channels?.reduce((sum, channel) => sum + Math.max(channel.targetVolume, 0), 0) ?? 100;
  const expectedSalesPerHundred = input.metrics?.expectedSalesPerHundred ?? 4;
  const expectedSales = Math.round((presentationsTarget * expectedSalesPerHundred) / 100);
  const averagePrice = input.offer?.price ?? 0;
  const currency = input.offer?.currency ?? "UNSET";
  return {
    presentationsTarget,
    expectedSalesPerHundred,
    expectedSales,
    averagePrice,
    currency,
    expectedRevenue: expectedSales * averagePrice,
    law: "law_of_averages_x_law_of_large_numbers"
  };
}

function buildAutoGtmRunbook(input: ProductRevenueEngineInput, releaseStatus: ReleaseStatus): AutoGtmRunbook {
  const armed = Boolean(input.product?.validatedByCeo && input.automation?.autoTakeoverEnabled && releaseStatus !== "blocked");
  return {
    takeoverStatus: armed ? "armed" : "not_armed",
    operator: "AfrIA Marketing Team™",
    trigger: armed
      ? "CEO validation + sellable/revenue_proven/scale_ready status"
      : "Await CEO validation, autoTakeoverEnabled=true and non-blocked Release-to-Revenue status",
    executionLoop: [
      "generate_offer_assets",
      "create_or_update_crm_pipeline",
      "launch_linkedin_whatsapp_email_sequence",
      "collect_payment_or_payment_proof",
      "log_reme_objections_and_winning_messages",
      "produce_case_study",
      "propose_upsell_or_scale_correct_kill"
    ],
    safeguards: [
      "least_privilege_scope:revenue:plan",
      "human_governance_required_for_restricted_data",
      "emergency_stop_required",
      "rollback_plan_required",
      "M6/S7+/M8/Big4 gates before institutional scale"
    ]
  };
}

function deriveGates(input: ProductRevenueEngineInput, completionRate: number, releaseStatus: ReleaseStatus): RevenueEngineOutput["gates"] {
  const hasPaymentOps = Boolean(input.payment && input.crm?.owner);
  const m6 = completionRate >= 70 && Boolean(input.governance?.m6Reviewed) ? "pass" : "fail";
  const s7plus = hasPaymentOps && Boolean(input.automation?.emergencyStopEnabled && input.automation?.rollbackPlanRef) ? "pass" : "fail";
  const m8 = releaseStatus === "scale_ready" && Boolean(input.governance?.m8Reviewed)
    ? "pass"
    : releaseStatus === "revenue_proven" || releaseStatus === "sellable"
      ? "conditional"
      : "fail";
  const big4 = input.governance?.big4Required
    ? input.governance.big4Reviewed ? "pass" : "required"
    : "not_required";
  return { m6, s7plus, m8, big4 };
}

function deriveRemeEvents(input: ProductRevenueEngineInput, output: Pick<RevenueEngineOutput, "releaseStatus" | "currentStage" | "completionRate">): string[] {
  const productName = input.product?.name ?? "UNNAMED_PRODUCT";
  return [
    `REME.REVENUE_ENGINE.COMPILED:${productName}`,
    `REME.RELEASE_STATUS:${output.releaseStatus}`,
    `REME.CURRENT_STAGE:${output.currentStage}`,
    `REME.COMPLETION_RATE:${output.completionRate}`,
    ...GENESIS_V4_TODAY_INNOVATIONS.map(innovation => `REME.INNOVATION:${innovation}`)
  ];
}

export function compileRevenueEngine(input: ProductRevenueEngineInput): RevenueEngineOutput {
  const stages = REVENUE_STAGES.map(stage => assessStage(input, stage));
  const firstNotReady = stages.find(stage => stage.status !== "ready") ?? stages[stages.length - 1]!;
  const readyCount = stages.filter(stage => stage.status === "ready").length;
  const completionRate = Math.round((readyCount / stages.length) * 100);
  const blockers = stages.flatMap(stage => stage.blockers.map(blocker => `${stage.label}: ${blocker}`));
  const releaseStatus = deriveReleaseStatus(stages);
  const primaryChannel = input.channels?.[0]?.name ?? "whatsapp";
  const crmBlueprint = input.crm ?? createDefaultCrm(input.product?.owner ?? "AfrIA Marketing Team™");
  const defaultSequence = input.sequence ?? createDefaultSequence(input.product?.name ?? "Produit AfrIAgenesis®", primaryChannel);
  const revenueMath = buildRevenueMath(input);
  const autoGtmRunbook = buildAutoGtmRunbook(input, releaseStatus);
  const gates = deriveGates(input, completionRate, releaseStatus);
  const minimalOutput = { releaseStatus, currentStage: firstNotReady.stage, completionRate };

  return {
    anchor: GENESIS_V4_REVENUE_ENGINE_ANCHOR,
    innovations: [...GENESIS_V4_TODAY_INNOVATIONS],
    productName: input.product?.name ?? "UNNAMED_PRODUCT",
    releaseStatus,
    currentStage: firstNotReady.stage,
    completionRate,
    stages,
    gates,
    crmBlueprint,
    defaultSequence,
    revenueMath,
    autoGtmRunbook,
    blockers,
    nextActions: blockers.length === 0
      ? ["Lancer campagne contrôlée", "Collecter preuve de paiement", "Créer cas client", "Décider Scale/Correct/Kill"]
      : [...new Set(stages.filter(stage => stage.status !== "ready").map(stage => stage.nextAction))],
    scaleDecision: input.scaleDecision ?? "hold",
    remeEvents: deriveRemeEvents(input, minimalOutput)
  };
}

export function assertReleaseToRevenue(input: ProductRevenueEngineInput, minimumStatus: ReleaseStatus = "sellable") {
  const output = compileRevenueEngine(input);
  const order: ReleaseStatus[] = ["blocked", "sellable", "revenue_proven", "scale_ready"];
  if (order.indexOf(output.releaseStatus) < order.indexOf(minimumStatus)) {
    const error = new Error(`GENESIS_V4_REVENUE_ENGINE_BLOCKED: ${output.blockers.join(" | ")}`);
    error.name = "GENESIS_V4_REVENUE_ENGINE_BLOCKED";
    throw error;
  }
  return output;
}
