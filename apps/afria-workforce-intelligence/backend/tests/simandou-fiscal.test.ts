import assert from "node:assert/strict";
import test from "node:test";
import { Identity } from "../src/domain.js";
import { ControlError } from "../src/living-core.js";
import {
  FiscalRule,
  GovernmentReceipt,
  SaleContract,
  computeFiscalObligation,
  type EvidenceLink,
  type FiscalFormula,
} from "../src/simandou-value-capture.js";
import { classifyFiscalReceipt } from "../src/simandou-reconciliation.js";

const evidence: EvidenceLink[] = [{
  evidenceId: "source-proof",
  source: "synthetic://legal/fiscal-rule",
  sha256: "a".repeat(64),
  observedAt: "2026-08-17T00:00:00.000Z",
  truthClass: "FACT",
}];

const approvalEvidence: EvidenceLink = {
  evidenceId: "approval-proof",
  source: "synthetic://approval/legal-director",
  sha256: "b".repeat(64),
  observedAt: "2026-08-17T01:00:00.000Z",
  truthClass: "FACT",
};

const formula: FiscalFormula = {
  kind: "AD_VALOREM_PERCENT",
  ratePercent: 5,
  base: "GROSS_SALE_VALUE",
};

function rule(input: { state?: "DRAFT" | "VALIDATED"; effectiveTo?: string | null; jurisdiction?: string } = {}) {
  return new FiscalRule(
    "rule-1",
    "tenant-gn",
    "simandou",
    "synthetic-rule-source",
    "v1",
    input.jurisdiction ?? "GN",
    "2026-01-01",
    input.effectiveTo ?? "2026-12-31",
    formula,
    input.state ?? "DRAFT",
    evidence,
  );
}

function sale() {
  return new SaleContract(
    "sale-1",
    "tenant-gn",
    "simandou",
    "shipment-1",
    "Synthetic Buyer",
    10_000,
    "USD",
    "2026-08-17",
    "FACT",
    evidence,
  );
}

test("blocks fiscal computation until a human legal approver validates the sourced rule", () => {
  const draft = rule();
  assert.throws(
    () => computeFiscalObligation({ rule: draft, sale: sale(), asOf: "2026-08-17", jurisdiction: "GN", obligationId: "obl-1", dueDate: "2026-09-17" }),
    (error: unknown) => error instanceof ControlError && /validated fiscal rule/i.test(error.message),
  );

  const agent = new Identity("agent-legal", "tenant-gn", "AGENT", "Legal Agent", ["LEGAL_APPROVER"]);
  assert.throws(
    () => draft.validate(agent, approvalEvidence),
    (error: unknown) => error instanceof ControlError && /human legal approver/i.test(error.message),
  );

  const human = new Identity("human-legal", "tenant-gn", "HUMAN", "Legal Director", ["LEGAL_APPROVER"]);
  const validated = draft.validate(human, approvalEvidence);
  assert.equal(validated.state, "VALIDATED");
  assert.equal(validated.validatedByIdentityId, "human-legal");
  assert.equal(validated.version, 2);
});

test("computes a typed ad-valorem obligation without any default rate", () => {
  const human = new Identity("human-legal", "tenant-gn", "HUMAN", "Legal Director", ["LEGAL_APPROVER"]);
  const validated = rule().validate(human, approvalEvidence);
  const obligation = computeFiscalObligation({
    rule: validated,
    sale: sale(),
    asOf: "2026-08-17",
    jurisdiction: "GN",
    obligationId: "obl-1",
    dueDate: "2026-09-17",
  });

  assert.equal(obligation.expectedAmount, 500);
  assert.equal(obligation.currency, "USD");
  assert.equal(obligation.fiscalRuleId, "rule-1");
  assert.equal(obligation.truthClass, "FACT");
});

test("rejects expired and wrong-jurisdiction fiscal rules", () => {
  const human = new Identity("human-legal", "tenant-gn", "HUMAN", "Legal Director", ["LEGAL_APPROVER"]);
  const expired = rule({ effectiveTo: "2026-06-30" }).validate(human, approvalEvidence);
  assert.throws(
    () => computeFiscalObligation({ rule: expired, sale: sale(), asOf: "2026-08-17", jurisdiction: "GN", obligationId: "obl-x", dueDate: "2026-09-17" }),
    /expired/i,
  );

  const wrongJurisdiction = rule({ jurisdiction: "ZZ" }).validate(human, approvalEvidence);
  assert.throws(
    () => computeFiscalObligation({ rule: wrongJurisdiction, sale: sale(), asOf: "2026-08-17", jurisdiction: "GN", obligationId: "obl-y", dueDate: "2026-09-17" }),
    /jurisdiction/i,
  );
});

test("rejects an invalid typed fiscal formula", () => {
  const invalidFormula: FiscalFormula = { kind: "AD_VALOREM_PERCENT", ratePercent: 101, base: "GROSS_SALE_VALUE" };
  assert.throws(
    () => new FiscalRule("rule-bad", "tenant-gn", "simandou", "source", "v1", "GN", "2026-01-01", null, invalidFormula, "DRAFT", evidence),
    /rate/i,
  );
});

test("classifies expected-versus-received revenue as pending, under, matched, over or contested", () => {
  const human = new Identity("human-legal", "tenant-gn", "HUMAN", "Legal Director", ["LEGAL_APPROVER"]);
  const obligation = computeFiscalObligation({
    rule: rule().validate(human, approvalEvidence),
    sale: sale(),
    asOf: "2026-08-17",
    jurisdiction: "GN",
    obligationId: "obl-1",
    dueDate: "2026-09-17",
  });

  assert.equal(classifyFiscalReceipt({ obligation, receipts: [], tolerance: 0 }).status, "PENDING");
  assert.equal(classifyFiscalReceipt({ obligation, receipts: [new GovernmentReceipt("r-under", "tenant-gn", "simandou", "obl-1", 400, "USD", "2026-09-01", evidence)], tolerance: 0 }).status, "UNDER");
  assert.equal(classifyFiscalReceipt({ obligation, receipts: [new GovernmentReceipt("r-match", "tenant-gn", "simandou", "obl-1", 500, "USD", "2026-09-01", evidence)], tolerance: 0 }).status, "MATCHED");
  assert.equal(classifyFiscalReceipt({ obligation, receipts: [new GovernmentReceipt("r-over", "tenant-gn", "simandou", "obl-1", 600, "USD", "2026-09-01", evidence)], tolerance: 0 }).status, "OVER");
  assert.equal(classifyFiscalReceipt({ obligation, receipts: [], tolerance: 0, contested: true }).status, "CONTESTED");
});
