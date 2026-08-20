export interface RevenueMathInput {
  presentations: number;
  expectedSalesPerHundred: number;
  averagePrice: number;
}

export interface RevenueMathOutput extends RevenueMathInput {
  expectedSales: number;
  expectedRevenue: number;
  law: "law_of_averages_x_law_of_large_numbers";
}

export interface ReadinessInput {
  offerReady: boolean;
  icpReady: boolean;
  crmReady: boolean;
  paymentConfigured: boolean;
  whatsappConfigured: boolean;
  firstCashProof: boolean;
}

export interface ReadinessOutput {
  productionProductReady: boolean;
  productionRevenueReady: boolean;
  blockers: string[];
  gates: {
    m6: "pass" | "fail";
    s7plus: "pass" | "fail";
    cyberAudit: "pending" | "pass";
    m8: "not_started" | "conditional" | "pass";
    big4: "not_required" | "required" | "pass";
  };
}

export function calculateRevenueMath(input: RevenueMathInput): RevenueMathOutput {
  const presentations = Math.max(0, input.presentations);
  const expectedSalesPerHundred = Math.max(0, input.expectedSalesPerHundred);
  const averagePrice = Math.max(0, input.averagePrice);
  const expectedSales = Math.round((presentations * expectedSalesPerHundred) / 100);
  return {
    presentations,
    expectedSalesPerHundred,
    averagePrice,
    expectedSales,
    expectedRevenue: expectedSales * averagePrice,
    law: "law_of_averages_x_law_of_large_numbers"
  };
}

export function assessProductionReadiness(input: ReadinessInput): ReadinessOutput {
  const blockers = [
    input.offerReady ? "" : "Offer not ready",
    input.icpReady ? "" : "ICP not ready",
    input.crmReady ? "" : "CRM not ready",
    input.paymentConfigured ? "" : "Payment provider not configured",
    input.whatsappConfigured ? "" : "WhatsApp Business/API sender not configured",
    input.firstCashProof ? "" : "First cash collection proof missing"
  ].filter(Boolean);

  const productionProductReady = input.offerReady && input.icpReady && input.crmReady;
  const productionRevenueReady = productionProductReady && input.paymentConfigured && input.whatsappConfigured && input.firstCashProof;

  return {
    productionProductReady,
    productionRevenueReady,
    blockers,
    gates: {
      m6: productionProductReady ? "pass" : "fail",
      s7plus: input.crmReady ? "pass" : "fail",
      cyberAudit: "pending",
      m8: productionRevenueReady ? "conditional" : "not_started",
      big4: "not_required"
    }
  };
}
