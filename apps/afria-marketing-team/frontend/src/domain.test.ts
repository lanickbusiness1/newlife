import { describe, expect, test } from "vitest";
import { CANONICAL_PRODUCT, CAPABILITIES, CRM_STAGES, PRODUCT_SECTIONS } from "./domain";

describe("AfrIA Marketing Team production domain", () => {
  test("anchors the product as production product and not MVP", () => {
    expect(CANONICAL_PRODUCT.assetId).toBe("PRD-MKT-TEAM-001");
    expect(CANONICAL_PRODUCT.productStandard).toBe("Production Product");
    expect(CANONICAL_PRODUCT.productStandard).not.toContain("MVP");
    expect(CANONICAL_PRODUCT.productionRevenueReady).toBe(false);
    expect(CANONICAL_PRODUCT.productionRevenueReadyLiteral).toBe("PRODUCTION_REVENUE_READY=false");
  });

  test("defines the complete revenue CRM pipeline", () => {
    expect(CRM_STAGES).toEqual([
      "Signal",
      "Lead qualifié",
      "Diagnostic",
      "Proposition",
      "Paiement",
      "Livraison",
      "Cas client",
      "Upsell / Referral"
    ]);
  });

  test("separates sensitive capabilities", () => {
    expect(CAPABILITIES).toContain("SEND");
    expect(CAPABILITIES).toContain("PAY");
    expect(CAPABILITIES).toContain("DELETE");
    expect(CAPABILITIES).toContain("EXPORT");
  });

  test("product shell exposes production sections", () => {
    expect(PRODUCT_SECTIONS).toContain("Revenue Cockpit");
    expect(PRODUCT_SECTIONS).toContain("R.E.M.E");
    expect(PRODUCT_SECTIONS).toContain("Governance");
  });
});
