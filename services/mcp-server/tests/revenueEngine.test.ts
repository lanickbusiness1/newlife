import { describe, expect, test } from "vitest";
import {
  assertReleaseToRevenue,
  compileRevenueEngine,
  createDefaultCrm,
  createDefaultSequence,
  GENESIS_V4_REVENUE_ENGINE_ANCHOR,
  GENESIS_V4_TODAY_INNOVATIONS,
  type ProductRevenueEngineInput
} from "../src/revenueEngine";

const sellableInput: ProductRevenueEngineInput = {
  product: {
    id: "PRD-MKT-TEAM-001",
    name: "AfrIA Marketing Team™",
    parentGenome: "GENESIS_V4",
    market: "Pan-Africain",
    owner: "Lanick Mohamed",
    validatedByCeo: true,
    targetCountries: ["Bénin", "Mali", "Guinée", "Sénégal"]
  },
  offer: {
    name: "Starter Revenue Engine",
    promise: "installer un moteur commercial IA opérationnel pour PME africaines",
    deliverable: "offre, scripts, CRM, séquence, paiement et tableau de conversion",
    price: 49900,
    currency: "FCFA",
    cta: "Réserver un diagnostic WhatsApp"
  },
  icp: {
    segment: "PME et entrepreneurs africains WhatsApp-first",
    buyerRole: "CEO / Fondateur",
    geography: ["Bénin", "Mali", "Guinée", "Sénégal"],
    pains: ["prospection irrégulière", "faible conversion", "absence de relance"],
    urgency: "high"
  },
  proof: {
    assets: ["démo cockpit", "scripts prêts à envoyer", "pricing validé"],
    evidenceLevel: "demo"
  },
  channels: [
    { name: "whatsapp", targetVolume: 6000, owner: "AfrIA Marketing Team™" },
    { name: "linkedin", targetVolume: 3000, owner: "AfrIA Marketing Team™" },
    { name: "email", targetVolume: 1000, owner: "AfrIA Marketing Team™" }
  ],
  script: {
    opening: "J’ai construit une équipe marketing IA pour entrepreneurs africains.",
    qualification: "Ton besoin prioritaire est vente, contenu, relance ou automatisation ?",
    objectionHandling: ["test gratuit 48h", "preuve avant paiement", "démarrage assisté"],
    closing: "On démarre cette semaine avec le pack pilote ?"
  },
  crm: createDefaultCrm("Lanick Mohamed"),
  sequence: createDefaultSequence("AfrIA Marketing Team™"),
  payment: {
    methods: ["Mobile Money", "Virement"],
    invoiceProcess: "facture PDF + preuve paiement",
    collectionOwner: "Lanick Mohamed"
  },
  governance: {
    m6Reviewed: true,
    s7plusReviewed: true,
    big4Required: false,
    humanApprovalRef: "CEO-2026-08-18"
  },
  automation: {
    autoTakeoverEnabled: true,
    crmSyncEnabled: true,
    paymentOpsEnabled: true,
    remeLoggingEnabled: true,
    emergencyStopEnabled: true,
    rollbackPlanRef: "ROLLBACK-REV-001"
  },
  metrics: {
    presentationsTarget: 10000,
    expectedSalesPerHundred: 4,
    targetRevenue: 19960000
  }
};

describe("GENESIS V4 Revenue Engine", () => {
  test("blocks a product that has no monetizable offer", () => {
    const output = compileRevenueEngine({
      product: { name: "AfrIA PaySwitch™", parentGenome: "GENESIS_V4" }
    });

    expect(output.anchor.assetId).toBe(GENESIS_V4_REVENUE_ENGINE_ANCHOR.assetId);
    expect(output.releaseStatus).toBe("blocked");
    expect(output.currentStage).toBe("offer");
    expect(output.blockers).toContain("Offre: Nom d’offre absent");
  });

  test("marks a complete pre-revenue product as sellable after CRM, sequence and payment wiring", () => {
    const output = compileRevenueEngine(sellableInput);

    expect(output.releaseStatus).toBe("sellable");
    expect(output.currentStage).toBe("first_revenue");
    expect(output.gates.m6).toBe("pass");
    expect(output.gates.s7plus).toBe("pass");
    expect(output.gates.m8).toBe("conditional");
    expect(output.gates.big4).toBe("not_required");
    expect(output.defaultSequence).toHaveLength(6);
  });

  test("encodes the innovations of the day into the executable output", () => {
    const output = compileRevenueEngine(sellableInput);

    expect(output.innovations).toEqual([...GENESIS_V4_TODAY_INNOVATIONS]);
    expect(output.innovations).toContain("auto_gtm_takeover");
    expect(output.autoGtmRunbook.takeoverStatus).toBe("armed");
    expect(output.autoGtmRunbook.operator).toBe("AfrIA Marketing Team™");
    expect(output.remeEvents).toContain("REME.INNOVATION:afria_marketing_team_as_revenue_operator");
  });

  test("applies the law of averages to qualified volume", () => {
    const output = compileRevenueEngine(sellableInput);

    expect(output.revenueMath.law).toBe("law_of_averages_x_law_of_large_numbers");
    expect(output.revenueMath.presentationsTarget).toBe(10000);
    expect(output.revenueMath.expectedSalesPerHundred).toBe(4);
    expect(output.revenueMath.expectedSales).toBe(400);
    expect(output.revenueMath.expectedRevenue).toBe(19960000);
  });

  test("requires proof of cash collection before revenue_proven", () => {
    const output = compileRevenueEngine({
      ...sellableInput,
      firstRevenue: {
        amount: 49900,
        currency: "FCFA",
        customer: "Client pilote PME",
        collectedAt: "2026-08-18",
        proofRef: "PAY-RECEIPT-001"
      }
    });

    expect(output.releaseStatus).toBe("revenue_proven");
    expect(output.currentStage).toBe("case_study");
    expect(output.gates.m8).toBe("conditional");
  });

  test("approves scale_ready only when every stage is ready, M8 reviewed and decision is scale", () => {
    const output = compileRevenueEngine({
      ...sellableInput,
      governance: {
        ...sellableInput.governance,
        m8Reviewed: true
      },
      firstRevenue: {
        amount: 199000,
        currency: "FCFA",
        customer: "Agence pilote",
        collectedAt: "2026-08-18",
        proofRef: "PAY-RECEIPT-002"
      },
      caseStudy: {
        title: "Agence pilote : première campagne IA livrée",
        customerSegment: "Agence marketing",
        metric: "4 offres produites en 48h",
        consent: true
      },
      upsell: {
        offers: ["Business", "Agence"],
        trigger: "client actif après première livraison"
      },
      scaleDecision: "scale"
    });

    expect(output.releaseStatus).toBe("scale_ready");
    expect(output.currentStage).toBe("scale_correct_kill");
    expect(output.gates.m8).toBe("pass");
  });

  test("keeps Big4 as required when institutional scale asks for external review", () => {
    const output = compileRevenueEngine({
      ...sellableInput,
      governance: {
        ...sellableInput.governance,
        big4Required: true,
        big4Reviewed: false
      }
    });

    expect(output.gates.big4).toBe("required");
  });

  test("throws a GENESIS_V4 guardrail error when release is blocked", () => {
    expect(() => assertReleaseToRevenue({ product: { name: "Produit incomplet" } })).toThrow(
      /GENESIS_V4_REVENUE_ENGINE_BLOCKED/
    );
  });
});
