import assert from "node:assert/strict";
import test from "node:test";
import { Identity } from "../src/domain.js";
import { ControlError } from "../src/living-core.js";
import { ValueCaptureComponent, type EconomicValueBucket, type EvidenceLink } from "../src/simandou-value-capture.js";
import { ValueCaptureLedger, ValueCaptureMethodology } from "../src/simandou-value-capture-service.js";

const evidence: EvidenceLink[] = [{
  evidenceId: "evidence-vc",
  source: "synthetic://simandou/value-capture",
  sha256: "c".repeat(64),
  observedAt: "2026-08-17T00:00:00.000Z",
  truthClass: "FACT",
}];

function component(input: { id: string; bucket: EconomicValueBucket; amount: number; source: string }) {
  return new ValueCaptureComponent(
    input.id,
    "tenant-gn",
    "simandou",
    input.bucket,
    input.amount,
    "USD",
    input.source,
    evidence,
  );
}

test("rejects exact duplicates and cross-bucket reuse of one economic source", () => {
  const ledger = new ValueCaptureLedger("tenant-gn", "simandou", "USD");
  ledger.add(component({ id: "vc-1", bucket: "PUBLIC_REVENUE", amount: 100, source: "receipt-1" }));

  assert.throws(
    () => ledger.add(component({ id: "vc-2", bucket: "PUBLIC_REVENUE", amount: 100, source: "receipt-1" })),
    (error: unknown) => error instanceof ControlError && /duplicate/i.test(error.message),
  );

  assert.throws(
    () => ledger.add(component({ id: "vc-3", bucket: "STATE_EQUITY", amount: 100, source: "receipt-1" })),
    (error: unknown) => error instanceof ControlError && /double counting/i.test(error.message),
  );
});

test("keeps FX retention visible but excludes it from retained economic value", () => {
  const ledger = new ValueCaptureLedger("tenant-gn", "simandou", "USD");
  ledger.add(component({ id: "vc-public", bucket: "PUBLIC_REVENUE", amount: 100, source: "receipt-1" }));
  ledger.add(component({ id: "vc-proc", bucket: "LOCAL_PROCUREMENT", amount: 200, source: "supplier-contract-1" }));
  ledger.add(component({ id: "vc-fx", bucket: "FX_RETENTION", amount: 500, source: "receipt-1" }));

  const noMethod = ledger.snapshot({ grossEconomicValue: 1_000, methodology: null });
  assert.equal(noMethod.status, "METHOD_NOT_APPROVED");
  assert.equal(noMethod.retainedEconomicValue, null);
  assert.equal(noMethod.valueCaptureRatioPercent, null);
  assert.equal(noMethod.byBucket.FX_RETENTION, 500);
});

test("requires human methodology approval before producing a Value Capture Ratio", () => {
  const methodology = new ValueCaptureMethodology(
    "method-1",
    "tenant-gn",
    "simandou",
    "v1",
    ["PUBLIC_REVENUE", "LOCAL_PROCUREMENT"],
    "DRAFT",
    evidence,
  );
  const agent = new Identity("method-agent", "tenant-gn", "AGENT", "Method Agent", ["METHODOLOGY_APPROVER"]);
  assert.throws(
    () => methodology.validate(agent, evidence[0]!),
    (error: unknown) => error instanceof ControlError && /human methodology approver/i.test(error.message),
  );

  const human = new Identity("method-human", "tenant-gn", "HUMAN", "Economic Method Approver", ["METHODOLOGY_APPROVER"]);
  const approved = methodology.validate(human, evidence[0]!);
  assert.equal(approved.state, "VALIDATED");
  assert.equal(approved.validatedByIdentityId, "method-human");
});

test("computes ratio only from approved non-overlapping economic buckets", () => {
  const human = new Identity("method-human", "tenant-gn", "HUMAN", "Economic Method Approver", ["METHODOLOGY_APPROVER"]);
  const methodology = new ValueCaptureMethodology(
    "method-1",
    "tenant-gn",
    "simandou",
    "v1",
    ["PUBLIC_REVENUE", "LOCAL_PROCUREMENT"],
    "DRAFT",
    evidence,
  ).validate(human, evidence[0]!);

  const ledger = new ValueCaptureLedger("tenant-gn", "simandou", "USD");
  ledger.add(component({ id: "vc-public", bucket: "PUBLIC_REVENUE", amount: 100, source: "receipt-1" }));
  ledger.add(component({ id: "vc-proc", bucket: "LOCAL_PROCUREMENT", amount: 200, source: "supplier-contract-1" }));
  ledger.add(component({ id: "vc-fx", bucket: "FX_RETENTION", amount: 500, source: "receipt-1" }));

  const snapshot = ledger.snapshot({ grossEconomicValue: 1_000, methodology });
  assert.equal(snapshot.status, "READY");
  assert.equal(snapshot.retainedEconomicValue, 300);
  assert.equal(snapshot.fxRetentionAmount, 500);
  assert.equal(snapshot.valueCaptureRatioPercent, 30);
});

test("blocks cross-tenant and cross-project value components", () => {
  const ledger = new ValueCaptureLedger("tenant-gn", "simandou", "USD");
  const wrongTenant = new ValueCaptureComponent("vc-x", "tenant-other", "simandou", "PUBLIC_REVENUE", 10, "USD", "r1", evidence);
  const wrongProject = new ValueCaptureComponent("vc-y", "tenant-gn", "other-project", "PUBLIC_REVENUE", 10, "USD", "r2", evidence);
  assert.throws(() => ledger.add(wrongTenant), /Tenant isolation/i);
  assert.throws(() => ledger.add(wrongProject), /Project isolation/i);
});
