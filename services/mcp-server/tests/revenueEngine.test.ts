import { describe, expect, test } from "vitest";
import {
  assertReleaseToRevenue,
  compileRevenueEngine,
  createDefaultCrm,
  createDefaultSequence,
  GENESIS_V4_REVENUE_ENGINE_ANCHOR,
  type ProductRevenueEngineInput
} from "../src/revenueEngine";

const sellableInput: ProductRevenueEngineInput = {
  product: {
    id: "PRD-MKT-TEAM-001",
    name: "AfrIA Marketing Team™",
    parentGenome: "GENESIS_V4",
    market: "Pan-Africain"
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
    geography: ["Bénin", "Guinée", "Sénégal"],
    pains: ["prospection irrégulière", "faible conversion", "absence de relance"],
    urgency: "high"
  },
  proof: {
    assets: ["démo cockpit", "scripts prêts à envoyer", "pricing validé"],
    evidenceLevel: "demo"
  },
  channels: [{ name: "whatsapp", targetVolume: 100, owner: "AfrIA Marketing Team™" }],
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
  }
};

describe("GENESIS V4 Revenue Engine", () => {
  test("blocks a product that has no monetizable offer", () => {
    const output = compileRevenueEngine({
      product: { name: "AfrIA PaySwitch™", parentGenome: "GENESIS_V4" }
    });

    expect(output.anchor).toEqual(GENESIS_V4_REVENUE_ENGINE_ANCHOR);
    expect(output.releaseStatus).toBe("blocked");
    expect(output.currentStage).toBe("offer");
    expect(output.blockers).toContain("Offre: Nom d’offre absent");
  });

  test("marks a complete pre-revenue product as sellable after payment wiring", () => {
    const output = compileRevenueEngine(sellableInput);

    expect(output.releaseStatus).toBe("sellable");
    expect(output.currentStage).toBe("first_revenue");
    expect(output.gates.m6).toBe("pass");
    expect(output.gates.s7plus).toBe("pass");
    expect(output.defaultSequence).toHaveLength(6);
  });

  test("requires proof of cash collection before revenue_proven", () => {
    const output = compileRevenueEngine({
      ...sellableInput,
      firstRevenue: {
        amount: 49900,
        currency: "FCFA",
        customer: "Client pilote PME",
        collectedAt: "2026-08-07",
        proofRef: "PAY-RECEIPT-001"
      }
    });

    expect(output.releaseStatus).toBe("revenue_proven");
    expect(output.currentStage).toBe("case_study");
    expect(output.gates.m8).toBe("conditional");
  });

  test("approves scale_ready only when every stage is ready and decision is scale", () => {
    const output = compileRevenueEngine({
      ...sellableInput,
      firstRevenue: {
        amount: 199000,
        currency: "FCFA",
        customer: "Agence pilote",
        collectedAt: "2026-08-07",
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

  test("throws a GENESIS_V4 guardrail error when release is blocked", () => {
    expect(() => assertReleaseToRevenue({ product: { name: "Produit incomplet" } })).toThrow(
      /GENESIS_V4_REVENUE_ENGINE_BLOCKED/
    );
  });
});
