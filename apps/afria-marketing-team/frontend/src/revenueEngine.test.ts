import { describe, expect, test } from "vitest";
import { assessProductionReadiness, calculateRevenueMath } from "./revenueEngine";

describe("production revenue engine", () => {
  test("calculates law of averages revenue", () => {
    const result = calculateRevenueMath({ presentations: 10000, expectedSalesPerHundred: 4, averagePrice: 49900 });
    expect(result.expectedSales).toBe(400);
    expect(result.expectedRevenue).toBe(19960000);
  });

  test("treats live setup as activation work, not imaginary blockers", () => {
    const result = assessProductionReadiness({
      offerReady: true,
      icpReady: true,
      crmReady: true,
      paymentConfigured: false,
      whatsappConfigured: false,
      firstCashProof: false
    });
    expect(result.productionProductReady).toBe(true);
    expect(result.productionRevenueReady).toBe(false);
    expect(result.commercialStatus).toBe("READY_TO_SELL");
    expect(result.verifiedBlockers).toEqual([]);
    expect(result.activationActions).toContain("Configurer paiement réel ou procédure d'encaissement manuelle");
    expect(result.activationActions).toContain("Configurer sender WhatsApp commercial");
    expect(result.activationActions).toContain("Collecter première preuve d'encaissement");
    expect(result.gates.m6).toBe("pass");
  });
});
