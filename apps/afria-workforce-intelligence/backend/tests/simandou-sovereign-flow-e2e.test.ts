import assert from "node:assert/strict";
import test from "node:test";
import { Identity } from "../src/domain.js";
import {
  FiscalRule,
  GovernmentReceipt,
  GradeCertificate,
  Invoice,
  OreLot,
  Payment,
  PortShipment,
  SaleContract,
  ValueCaptureComponent,
  computeFiscalObligation,
  type EvidenceLink,
  type FiscalFormula,
} from "../src/simandou-value-capture.js";
import { reconcileShipmentCashFlow } from "../src/simandou-reconciliation.js";
import { ValueCaptureLedger, ValueCaptureMethodology } from "../src/simandou-value-capture-service.js";

const tenantId = "tenant-gn";
const projectId = "simandou";
const evidence: EvidenceLink[] = [{
  evidenceId: "e2e-proof",
  source: "synthetic://simandou/e2e",
  sha256: "9".repeat(64),
  observedAt: "2026-08-17T00:00:00.000Z",
  truthClass: "FACT",
}];

const formula: FiscalFormula = {
  kind: "AD_VALOREM_PERCENT",
  ratePercent: 5,
  base: "GROSS_SALE_VALUE",
};

test("proves OreLot to GovernmentReceipt to Value Capture as one synthetic sovereign flow", () => {
  const lot = new OreLot("lot-e2e", tenantId, projectId, 100, 65.3, "2026-08-17", evidence);
  const grade = new GradeCertificate("grade-e2e", tenantId, projectId, lot.id, 65.3, 1.1, "2026-08-17", evidence);
  const shipment = new PortShipment("shipment-e2e", tenantId, projectId, lot.id, 100, grade.gradeFePercent, "2026-08-17", evidence);
  const sale = new SaleContract("sale-e2e", tenantId, projectId, shipment.id, "Synthetic Buyer", 10_000, "USD", "2026-08-17", "FACT", evidence);
  const invoice = new Invoice("invoice-e2e", tenantId, projectId, sale.id, sale.grossSaleValue, "USD", "2026-08-17", evidence);
  const payment = new Payment("payment-e2e", tenantId, projectId, invoice.id, invoice.amount, "USD", "2026-08-18", evidence);

  const legalApprover = new Identity("legal-human", tenantId, "HUMAN", "Legal Approver", ["LEGAL_APPROVER"]);
  const fiscalRule = new FiscalRule(
    "rule-e2e",
    tenantId,
    projectId,
    "synthetic-fiscal-source",
    "v1",
    "GN",
    "2026-01-01",
    "2026-12-31",
    formula,
    "DRAFT",
    evidence,
  ).validate(legalApprover, evidence[0]!);

  const obligation = computeFiscalObligation({
    rule: fiscalRule,
    sale,
    asOf: "2026-08-17",
    jurisdiction: "GN",
    obligationId: "obligation-e2e",
    dueDate: "2026-09-17",
  });
  const receipt = new GovernmentReceipt("receipt-e2e", tenantId, projectId, obligation.id, obligation.expectedAmount, "USD", "2026-09-01", evidence);

  const reconciliation = reconcileShipmentCashFlow({
    shipment,
    sale,
    invoice,
    payments: [payment],
    obligations: [obligation],
    receipts: [receipt],
    paymentTolerance: 0,
    receiptTolerance: 0,
  });
  assert.equal(reconciliation.status, "MATCHED");
  assert.equal(reconciliation.exceptions.length, 0);
  assert.equal(reconciliation.receivedPublicRevenue, 500);

  const methodologyApprover = new Identity("method-human", tenantId, "HUMAN", "Methodology Approver", ["METHODOLOGY_APPROVER"]);
  const methodology = new ValueCaptureMethodology(
    "method-e2e",
    tenantId,
    projectId,
    "v1",
    ["PUBLIC_REVENUE"],
    "DRAFT",
    evidence,
  ).validate(methodologyApprover, evidence[0]!);

  const ledger = new ValueCaptureLedger(tenantId, projectId, "USD");
  ledger.add(new ValueCaptureComponent(
    "vc-public-e2e",
    tenantId,
    projectId,
    "PUBLIC_REVENUE",
    receipt.amount,
    receipt.currency,
    receipt.id,
    receipt.evidence,
  ));
  const snapshot = ledger.snapshot({ grossEconomicValue: sale.grossSaleValue, methodology });

  assert.equal(snapshot.status, "READY");
  assert.equal(snapshot.retainedEconomicValue, 500);
  assert.equal(snapshot.valueCaptureRatioPercent, 5);
  assert.equal(snapshot.methodologyId, methodology.id);
});
