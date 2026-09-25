import { describe, expect, test } from "vitest";
import { qualifyCeaReturnLead, toCeaCrmRecord } from "./ceaReturn";

describe("CEA_RETURN revenue qualification", () => {
  test("preserves campaign attribution and routes an identity lead to the 150 USD dossier offer", () => {
    const result = qualifyCeaReturnLead({
      contentId: "BEN-SUR-001",
      narrativeSource: "instagram/benin-surprise-return",
      primaryIntent: "Identité",
      horizon: "3-12m",
      budgetUsd: 500,
      consentContact: true,
      language: "FR"
    });

    expect(result.contentId).toBe("BEN-SUR-001");
    expect(result.priority).toBe("P1 - Cette semaine");
    expect(result.nextBestOffer).toBe("Pack Dossier 150 USD");
    expect(result.paymentStatus).toBe("Non proposé");
    expect(result.contactAllowed).toBe(true);
  });

  test("routes an installation within 90 days to P0 and the 1,500 USD offer", () => {
    const result = qualifyCeaReturnLead({
      contentId: "BEN-INS-002",
      narrativeSource: "facebook",
      primaryIntent: "Installation",
      horizon: "30-90d",
      budgetUsd: 3000,
      consentContact: true,
      language: "EN"
    });

    expect(result.priority).toBe("P0 - Immédiat");
    expect(result.nextBestOffer).toBe("Installation 1 500 USD");
    expect(result.estimatedValueUsd).toBe(1500);
  });

  test("routes a concrete investment case with declared budget to P0 and investment due diligence", () => {
    const result = qualifyCeaReturnLead({
      contentId: "BEN-INV-001",
      narrativeSource: "linkedin",
      primaryIntent: "Investissement",
      horizon: "30-90d",
      budgetUsd: 25000,
      investmentProject: "Acquisition et exploitation d'un actif hôtelier à Cotonou",
      consentContact: true,
      language: "FR"
    });

    expect(result.priority).toBe("P0 - Immédiat");
    expect(result.nextBestOffer).toBe("Investissement 2 000 USD+");
    expect(result.estimatedValueUsd).toBe(2000);
  });

  test("keeps long-horizon community curiosity in nurture", () => {
    const result = qualifyCeaReturnLead({
      contentId: "BEN-MEM-003",
      narrativeSource: "youtube",
      primaryIntent: "Communauté",
      horizon: ">12m",
      budgetUsd: 0,
      consentContact: true,
      language: "PT"
    });

    expect(result.priority).toBe("P3 - Nurture");
    expect(result.nextBestOffer).toBe("Diagnostic gratuit");
  });

  test("never authorizes direct contact without explicit consent", () => {
    const result = qualifyCeaReturnLead({
      contentId: "BEN-SUR-004",
      narrativeSource: "tiktok",
      primaryIntent: "Voyage",
      horizon: "<30d",
      budgetUsd: 1000,
      consentContact: false,
      language: "FR"
    });

    expect(result.contactAllowed).toBe(false);
  });

  test("maps qualification to the exact CRM property contract without inventing missing fields", () => {
    const qualification = qualifyCeaReturnLead({
      contentId: "BEN-SUR-001",
      narrativeSource: "instagram/benin-surprise-return",
      primaryIntent: "Identité",
      horizon: "3-12m",
      budgetUsd: 500,
      consentContact: true,
      language: "FR"
    });

    const record = toCeaCrmRecord(qualification);

    expect(record).toEqual({
      "Content ID": "BEN-SUR-001",
      "Narrative Source": "instagram/benin-surprise-return",
      "Primary Intent": "Identité",
      "Next Best Offer": "Pack Dossier 150 USD",
      "Langue": "FR",
      "Consentement Contact": "__YES__",
      "Revenue Attributed USD": 0,
      "Payment Status": "Non proposé",
      "Priorité": "P1 - Cette semaine"
    });
    expect(record).not.toHaveProperty("Trust Gap");
    expect(record).not.toHaveProperty("Emotional Trigger");
    expect(record).not.toHaveProperty("Referral Potential");
  });
});
