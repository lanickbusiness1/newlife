import assert from "node:assert/strict";
import test from "node:test";
import {
  GradeCertificate,
  OreLot,
  Payment,
  PortShipment,
  SaleContract,
  ValueCaptureComponent,
  type EvidenceLink,
} from "../src/simandou-value-capture.js";

const evidence: EvidenceLink[] = [
  {
    evidenceId: "evidence-1",
    source: "synthetic://simandou/lot-1",
    sha256: "a".repeat(64),
    observedAt: "2026-08-17T00:00:00.000Z",
    truthClass: "FACT",
  },
];

test("rejects empty identity, tenant and project on mine-to-cash objects", () => {
  assert.throws(() => new OreLot("", "tenant-gn", "simandou", 100, 65, "2026-08-17", evidence), /id is required/i);
  assert.throws(() => new OreLot("lot-1", "", "simandou", 100, 65, "2026-08-17", evidence), /tenant/i);
  assert.throws(() => new OreLot("lot-1", "tenant-gn", "", 100, 65, "2026-08-17", evidence), /project/i);
});

test("rejects impossible grade, negative amounts and invalid dates", () => {
  assert.throws(() => new OreLot("lot-1", "tenant-gn", "simandou", 100, 101, "2026-08-17", evidence), /grade/i);
  assert.throws(() => new Payment("payment-1", "tenant-gn", "simandou", "invoice-1", -1, "USD", "2026-08-17", evidence), /non-negative/i);
  assert.throws(() => new PortShipment("shipment-1", "tenant-gn", "simandou", "lot-1", 90, 65, "2026-02-31", evidence), /valid calendar date/i);
});

test("rejects evidence without a SHA-256 fingerprint", () => {
  const invalidEvidence: EvidenceLink[] = [{ ...evidence[0]!, sha256: "bad" }];
  assert.throws(() => new OreLot("lot-1", "tenant-gn", "simandou", 100, 65, "2026-08-17", invalidEvidence), /SHA-256/i);
});

test("preserves explicit truth class on commercial facts", () => {
  const sale = new SaleContract(
    "sale-1",
    "tenant-gn",
    "simandou",
    "shipment-1",
    "Synthetic Steel Buyer",
    10_000,
    "USD",
    "2026-08-17",
    "HYPOTHESIS",
    evidence,
  );
  assert.equal(sale.truthClass, "HYPOTHESIS");
  assert.equal(sale.grossSaleValue, 10_000);
});

test("links grade and shipment to the originating ore lot", () => {
  const grade = new GradeCertificate("grade-1", "tenant-gn", "simandou", "lot-1", 65.3, 1.2, "2026-08-17", evidence);
  const shipment = new PortShipment("shipment-1", "tenant-gn", "simandou", "lot-1", 95, 65.3, "2026-08-17", evidence);
  assert.equal(grade.oreLotId, "lot-1");
  assert.equal(shipment.oreLotId, "lot-1");
});

test("rejects a value component without evidence", () => {
  assert.throws(
    () => new ValueCaptureComponent("vc1", "t1", "sim", "PUBLIC_REVENUE", 100, "USD", "receipt-1", []),
    /evidence/i,
  );
});
