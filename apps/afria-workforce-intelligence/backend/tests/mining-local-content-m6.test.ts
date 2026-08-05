import assert from "node:assert/strict";
import test from "node:test";
import { Identity, Tenant } from "../src/domain.js";
import { ControlError } from "../src/living-core.js";
import {
  LocalContentComplianceEngine,
  LocalContentRule,
  SuccessionPlan,
  type ApprovalEvidenceRef,
  type LegalSourceRef,
} from "../src/mining-local-content.js";

const tenant = new Tenant("tenant-gn", "tenant-gn", "Guinea Mining Authority", "GN");
const legalApprover = new Identity(
  "legal-1",
  tenant.id,
  "HUMAN",
  "Legal Director",
  ["LEGAL_APPROVER"],
);
const hrApprover = new Identity(
  "hr-1",
  tenant.id,
  "HUMAN",
  "HR Director",
  ["HR_APPROVER"],
);

const source: LegalSourceRef = {
  id: "GN-LOCAL-CONTENT-2022",
  title: "Guinea local content legal source",
  url: "https://example.gov.gn/legal/local-content-2022",
  jurisdiction: "GN",
  version: "2022-01",
  effectiveFrom: "2022-01-01",
  sha256: "a".repeat(64),
};

const legalProof: ApprovalEvidenceRef = {
  id: "proof-legal-1",
  tenantId: tenant.id,
  kind: "LEGAL_RULE_APPROVAL",
  createdAt: "2026-08-05T00:00:00.000Z",
  sha256: "b".repeat(64),
};

const successionProof: ApprovalEvidenceRef = {
  id: "proof-hr-1",
  tenantId: tenant.id,
  kind: "SUCCESSION_PLAN_APPROVAL",
  createdAt: "2026-08-05T00:00:00.000Z",
  sha256: "c".repeat(64),
};

test("rejects a legal source without a valid SHA-256 content fingerprint", () => {
  assert.throws(
    () => new LocalContentRule(
      "rule-bad-hash",
      tenant.id,
      "project-simandou",
      "SKILLED",
      80,
      { ...source, sha256: "not-a-sha256" },
    ),
    /SHA-256 fingerprint/,
  );
});

test("rejects legal approval evidence belonging to another tenant", () => {
  const rule = new LocalContentRule(
    "rule-cross-tenant-proof",
    tenant.id,
    "project-simandou",
    "SKILLED",
    80,
    source,
  );

  assert.throws(
    () => rule.validate(legalApprover, { ...legalProof, tenantId: "tenant-other" }),
    (error: unknown) => error instanceof ControlError && /Evidence tenant isolation/.test(error.message),
  );
});

test("blocks a rule before its effective date and after its expiry date", () => {
  const engine = new LocalContentComplianceEngine();
  const futureRule = new LocalContentRule(
    "rule-future",
    tenant.id,
    "project-simandou",
    "SKILLED",
    80,
    { ...source, effectiveFrom: "2027-01-01" },
  ).validate(legalApprover, legalProof);

  assert.throws(
    () => engine.evaluate({ tenant, rule: futureRule, records: [], asOf: "2026-08-05" }),
    (error: unknown) => error instanceof ControlError && /not yet effective/.test(error.message),
  );

  const expiredRule = new LocalContentRule(
    "rule-expired",
    tenant.id,
    "project-simandou",
    "SKILLED",
    80,
    { ...source, effectiveTo: "2025-12-31" },
  ).validate(legalApprover, legalProof);

  assert.throws(
    () => engine.evaluate({ tenant, rule: expiredRule, records: [], asOf: "2026-08-05" }),
    (error: unknown) => error instanceof ControlError && /no longer effective/.test(error.message),
  );
});

test("rejects succession approval evidence belonging to another tenant", () => {
  const plan = new SuccessionPlan(
    "succession-cross-tenant-proof",
    tenant.id,
    "project-simandou",
    "workforce-expat-1",
    "employee-national-1",
    ["MINE_PLANNING"],
    ["MINE_PLANNING"],
    "2027-06-30",
  );

  assert.throws(
    () => plan.approve(hrApprover, { ...successionProof, tenantId: "tenant-other" }),
    (error: unknown) => error instanceof ControlError && /Evidence tenant isolation/.test(error.message),
  );
});
