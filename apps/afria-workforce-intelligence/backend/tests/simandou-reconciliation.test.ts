import assert from "node:assert/strict";
import test from "node:test";
import { ControlError } from "../src/living-core.js";
import {
  FiscalObligation,
  GovernmentReceipt,
  Invoice,
  Payment,
  PortShipment,
  SaleContract,
  type EvidenceLink,
} from "../src/simandou-value-capture.js";
import { reconcileShipmentCashFlow } from "../src/simandou-reconciliation.js";

const evidence: EvidenceLink[] = [{
  evidenceId: "e1",
  source: "synthetic://simandou/reconciliation",
  sha256: "a".repeat(64),
  observedAt: "2026-08-17T00:00:00.000Z",
  truthClass: "FACT",
}];

function shipment(projectId = "simandou") {
  return new PortShipment("ship-1", "tenant-gn", projectId, "lot-1", 100, 65, "2026-08-17", evidence);
}

function sale(projectId = "simandou") {
  return new SaleContract("sale-1", "tenant-gn", projectId, "ship-1", "Synthetic Buyer", 10_000, "USD", "2026-08-17", "FACT", evidence);
}

function invoice(projectId = "simandou") {
  return new Invoice("invoice-1", "tenant-gn", projectId, "sale-1", 10_000, "USD", "2026-08-17", evidence);
}

function obligation(projectId = "simandou") {
  return new FiscalObligation("obl-1", "tenant-gn", projectId, "rule-1", "sale-1", 350, "USD", "2026-09-17", "FACT", evidence);
}

test("shipment without linked sale creates MISSING_SALE_LINK exception", () => {
  const result = reconcileShipmentCashFlow({
    shipment: shipment(),
    sale: null,
    invoice: null,
    payments: [],
    obligations: [],
    receipts: [],
  });

  assert.equal(result.status, "EXCEPTIONS");
  assert.equal(result.exceptions[0]?.code, "MISSING_SALE_LINK");
  assert.deepEqual(result.exceptions[0]?.sourceObjectIds, ["ship-1"]);
});

test("payment mismatch beyond tolerance creates an exception and never labels fraud", () => {
  const result = reconcileShipmentCashFlow({
    shipment: shipment(),
    sale: sale(),
    invoice: invoice(),
    payments: [new Payment("payment-1", "tenant-gn", "simandou", "invoice-1", 9_000, "USD", "2026-08-18", evidence)],
    obligations: [],
    receipts: [],
    paymentTolerance: 1,
  });

  assert.equal(result.exceptions.some((item) => item.code === "PAYMENT_MISMATCH"), true);
  assert.equal(result.exceptions.some((item) => String(item.code) === "FRAUD"), false);
});

test("cross-project linkage is blocked before reconciliation", () => {
  assert.throws(
    () => reconcileShipmentCashFlow({
      shipment: shipment(),
      sale: sale("other-project"),
      invoice: invoice(),
      payments: [],
      obligations: [],
      receipts: [],
    }),
    (error: unknown) => error instanceof ControlError && /project isolation/i.test(error.message),
  );
});

test("matching sale, payment and government receipt returns MATCHED", () => {
  const result = reconcileShipmentCashFlow({
    shipment: shipment(),
    sale: sale(),
    invoice: invoice(),
    payments: [new Payment("payment-1", "tenant-gn", "simandou", "invoice-1", 10_000, "USD", "2026-08-18", evidence)],
    obligations: [obligation()],
    receipts: [new GovernmentReceipt("receipt-1", "tenant-gn", "simandou", "obl-1", 350, "USD", "2026-09-01", evidence)],
    paymentTolerance: 0,
    receiptTolerance: 0,
  });

  assert.equal(result.status, "MATCHED");
  assert.equal(result.exceptions.length, 0);
  assert.equal(result.invoiceAmount, 10_000);
  assert.equal(result.paymentAmount, 10_000);
  assert.equal(result.expectedPublicRevenue, 350);
  assert.equal(result.receivedPublicRevenue, 350);
});
