import assert from "node:assert/strict";
import test from "node:test";
import { Identity, Tenant } from "../src/domain.js";
import { ControlError, InMemoryEvidenceVault } from "../src/living-core.js";
import {
  LocalContentComplianceEngine,
  LocalContentRule,
  MiningWorkforceRecord,
  SuccessionPlan,
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
};

function workforceRecord(input: {
  id: string;
  nationality: "NATIONAL" | "EXPATRIATE";
  category?: "SKILLED" | "SENIOR_MANAGEMENT";
  tenantId?: string;
  projectId?: string;
  evidence?: boolean;
}): MiningWorkforceRecord {
  return new MiningWorkforceRecord(
    input.id,
    input.tenantId ?? tenant.id,
    input.projectId ?? "project-simandou",
    `employee-${input.id}`,
    `role-${input.id}`,
    input.category ?? "SKILLED",
    input.nationality,
    4_000,
    "ACTIVE",
    input.evidence
      ? [{ id: `evidence-${input.id}`, kind: "EMPLOYMENT_RECORD", createdAt: "2026-08-05T00:00:00.000Z" }]
      : [],
  );
}

test("blocks compliance evaluation until a sourced rule receives human legal approval", () => {
  const rule = new LocalContentRule(
    "rule-1",
    tenant.id,
    "project-simandou",
    "SKILLED",
    80,
    source,
  );
  const engine = new LocalContentComplianceEngine();

  assert.throws(
    () => engine.evaluate({ tenant, rule, records: [] }),
    (error: unknown) => error instanceof ControlError && /validated legal rule/.test(error.message),
  );

  const agent = new Identity("legal-agent", tenant.id, "AGENT", "Legal Agent", ["LEGAL_APPROVER"]);
  const proof = new InMemoryEvidenceVault().append({ kind: "LEGAL_RULE_APPROVAL" });
  assert.throws(
    () => rule.validate(agent, proof),
    (error: unknown) => error instanceof ControlError && /human legal approver/.test(error.message),
  );

  const validated = rule.validate(legalApprover, proof);
  assert.equal(validated.state, "VALIDATED");
  assert.equal(validated.version, 2);
  assert.equal(validated.evidence.length, 1);
});

test("calculates the national workforce ratio, compliance gap and evidence coverage", () => {
  const proof = new InMemoryEvidenceVault().append({ kind: "LEGAL_RULE_APPROVAL" });
  const rule = new LocalContentRule(
    "rule-2",
    tenant.id,
    "project-simandou",
    "SKILLED",
    80,
    source,
  ).validate(legalApprover, proof);
  const engine = new LocalContentComplianceEngine();

  const assessment = engine.evaluate({
    tenant,
    rule,
    records: [
      workforceRecord({ id: "1", nationality: "NATIONAL", evidence: true }),
      workforceRecord({ id: "2", nationality: "NATIONAL", evidence: true }),
      workforceRecord({ id: "3", nationality: "NATIONAL" }),
      workforceRecord({ id: "4", nationality: "EXPATRIATE", evidence: true }),
      workforceRecord({ id: "5", nationality: "NATIONAL", category: "SENIOR_MANAGEMENT", evidence: true }),
    ],
  });

  assert.equal(assessment.status, "NON_COMPLIANT");
  assert.equal(assessment.nationalCount, 3);
  assert.equal(assessment.expatriateCount, 1);
  assert.equal(assessment.ratioPercent, 75);
  assert.equal(assessment.gapPercent, 5);
  assert.equal(assessment.evidenceCoveragePercent, 75);
  assert.equal(assessment.assessmentType, "ADVISORY");
});

test("returns NO_DATA without falsely declaring compliance", () => {
  const proof = new InMemoryEvidenceVault().append({ kind: "LEGAL_RULE_APPROVAL" });
  const rule = new LocalContentRule(
    "rule-3",
    tenant.id,
    "project-simandou",
    "SKILLED",
    80,
    source,
  ).validate(legalApprover, proof);

  const assessment = new LocalContentComplianceEngine().evaluate({ tenant, rule, records: [] });

  assert.equal(assessment.status, "NO_DATA");
  assert.equal(assessment.ratioPercent, null);
  assert.equal(assessment.gapPercent, null);
});

test("blocks workforce records from another tenant or mining project", () => {
  const proof = new InMemoryEvidenceVault().append({ kind: "LEGAL_RULE_APPROVAL" });
  const rule = new LocalContentRule(
    "rule-4",
    tenant.id,
    "project-simandou",
    "SKILLED",
    80,
    source,
  ).validate(legalApprover, proof);
  const engine = new LocalContentComplianceEngine();

  assert.throws(
    () => engine.evaluate({
      tenant,
      rule,
      records: [workforceRecord({ id: "x", nationality: "NATIONAL", tenantId: "tenant-other" })],
    }),
    (error: unknown) => error instanceof ControlError && /Tenant isolation/.test(error.message),
  );

  assert.throws(
    () => engine.evaluate({
      tenant,
      rule,
      records: [workforceRecord({ id: "y", nationality: "NATIONAL", projectId: "project-other" })],
    }),
    (error: unknown) => error instanceof ControlError && /Project isolation/.test(error.message),
  );
});

test("requires human HR approval before activating an expatriate succession plan", () => {
  const vault = new InMemoryEvidenceVault();
  const proof = vault.append({ kind: "SUCCESSION_PLAN_APPROVAL" });
  const plan = new SuccessionPlan(
    "succession-1",
    tenant.id,
    "project-simandou",
    "workforce-expat-1",
    "employee-national-1",
    ["MINE_PLANNING", "HSE", "TEAM_LEADERSHIP"],
    ["MINE_PLANNING", "HSE"],
    "2027-06-30",
  );

  assert.equal(plan.readinessPercent(), 67);

  const agent = new Identity("hr-agent", tenant.id, "AGENT", "HR Agent", ["HR_APPROVER"]);
  assert.throws(
    () => plan.approve(agent, proof),
    (error: unknown) => error instanceof ControlError && /human HR approver/.test(error.message),
  );

  const approved = plan.approve(hrApprover, proof);
  assert.equal(approved.state, "APPROVED");
  assert.equal(approved.version, 2);
  assert.equal(approved.evidence[0]?.kind, "SUCCESSION_PLAN_APPROVAL");
});
