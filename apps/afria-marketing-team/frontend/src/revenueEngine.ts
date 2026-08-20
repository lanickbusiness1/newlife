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

export type CommercialStatus = "FIX_PRODUCT" | "READY_TO_SELL" | "READY_TO_COLLECT_CASH" | "CASH_PROVEN";

export interface ReadinessOutput {
  productionProductReady: boolean;
  productionRevenueReady: boolean;
  commercialStatus: CommercialStatus;
  activationActions: string[];
  verifiedBlockers: string[];
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
  const verifiedBlockers = [
    input.offerReady ? "" : "Offre produit absente",
    input.icpReady ? "" : "ICP prioritaire absent",
    input.crmReady ? "" : "Pipeline CRM absent"
  ].filter(Boolean);

  const activationActions = [
    input.paymentConfigured ? "" : "Configurer paiement réel ou procédure d'encaissement manuelle",
    input.whatsappConfigured ? "" : "Configurer sender WhatsApp commercial",
    input.firstCashProof ? "" : "Collecter première preuve d'encaissement"
  ].filter(Boolean);

  const productionProductReady = input.offerReady && input.icpReady && input.crmReady;
  const productionRevenueReady = productionProductReady && input.paymentConfigured && input.whatsappConfigured && input.firstCashProof;
  const commercialStatus = deriveCommercialStatus(productionProductReady, productionRevenueReady, activationActions);

  return {
    productionProductReady,
    productionRevenueReady,
    commercialStatus,
    activationActions,
    verifiedBlockers,
    gates: {
      m6: productionProductReady ? "pass" : "fail",
      s7plus: input.crmReady ? "pass" : "fail",
      cyberAudit: "pending",
      m8: productionRevenueReady ? "conditional" : "not_started",
      big4: "not_required"
    }
  };
}

function deriveCommercialStatus(
  productionProductReady: boolean,
  productionRevenueReady: boolean,
  activationActions: string[]
): CommercialStatus {
  if (!productionProductReady) return "FIX_PRODUCT";
  if (productionRevenueReady) return "CASH_PROVEN";
  if (activationActions.length <= 1) return "READY_TO_COLLECT_CASH";
  return "READY_TO_SELL";
}
