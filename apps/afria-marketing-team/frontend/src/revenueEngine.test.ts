import { describe, expect, test } from "vitest";
import { assessProductionReadiness, calculateRevenueMath } from "./revenueEngine";

describe("production revenue engine", () => {
  test("calculates law of averages revenue", () => {
    const result = calculateRevenueMath({ presentations: 10000, expectedSalesPerHundred: 4, averagePrice: 49900 });
    expect(result.expectedSales).toBe(400);
    expect(result.expectedRevenue).toBe(19960000);
  });

  test("blocks revenue-ready claim without live configuration and first proof", () => {
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
    expect(result.blockers).toContain("Payment provider not configured");
    expect(result.blockers).toContain("WhatsApp Business/API sender not configured");
    expect(result.blockers).toContain("First cash collection proof missing");
    expect(result.gates.m6).toBe("pass");
  });
});
