import assert from "node:assert/strict";
import test from "node:test";
import { Identity, Tenant } from "../src/domain.js";
import { ControlError } from "../src/living-core.js";
import {
  LocalContentRule,
  MiningWorkforceRecord,
  SuccessionPlan,
  type ApprovalEvidenceRef,
  type LegalSourceRef,
} from "../src/mining-local-content.js";
import {
  InMemoryLocalContentRepository,
  MiningLocalContentService,
} from "../src/mining-local-content-service.js";

const tenant = new Tenant("tenant-gn", "tenant-gn", "Guinea Mining Authority", "GN");
const legalEditor = new Identity("legal-editor", tenant.id, "HUMAN", "Legal Editor", ["LEGAL_EDITOR"]);
const legalApprover = new Identity("legal-approver", tenant.id, "HUMAN", "Legal Director", ["LEGAL_APPROVER"]);
const dataService = new Identity("data-service", tenant.id, "SERVICE", "HR Import Service", ["DATA_STEWARD"]);
const complianceAgent = new Identity("compliance-agent", tenant.id, "AGENT", "Compliance Agent", ["COMPLIANCE_ANALYST"]);
const hrPlannerAgent = new Identity("hr-planner-agent", tenant.id, "AGENT", "Succession Agent", ["HR_PLANNER"]);
const hrApprover = new Identity("hr-approver", tenant.id, "HUMAN", "HR Director", ["HR_APPROVER"]);
const auditor = new Identity("auditor", tenant.id, "HUMAN", "Internal Auditor", ["AUDITOR"]);

const source: LegalSourceRef = {
  id: "GN-SOURCE-SYNTHETIC-001",
  title: "Synthetic legal source for controlled E2E testing",
  url: "https://example.gov.gn/legal/synthetic-source",
  jurisdiction: "GN",
  version: "test-1",
  effectiveFrom: "2026-01-01",
  sha256: "a".repeat(64),
};

const legalProof: ApprovalEvidenceRef = {
  id: "proof-legal",
  tenantId: tenant.id,
  kind: "LEGAL_RULE_APPROVAL",
  createdAt: "2026-08-05T10:00:00.000Z",
  sha256: "b".repeat(64),
};

const successionProof: ApprovalEvidenceRef = {
  id: "proof-succession",
  tenantId: tenant.id,
  kind: "SUCCESSION_PLAN_APPROVAL",
  createdAt: "2026-08-05T10:10:00.000Z",
  sha256: "c".repeat(64),
};

function workforceRecord(
  id: string,
  nationalityStatus: "NATIONAL" | "EXPATRIATE",
): MiningWorkforceRecord {
  return new MiningWorkforceRecord(
    id,
    tenant.id,
    "project-simandou",
    `employee-${id}`,
    `role-${id}`,
    "SKILLED",
    nationalityStatus,
    nationalityStatus === "EXPATRIATE" ? 12_000 : 4_000,
    "ACTIVE",
    [{ id: `evidence-${id}`, kind: "EMPLOYMENT_RECORD", createdAt: "2026-08-05T09:00:00.000Z" }],
  );
}

function createService(): MiningLocalContentService {
  let sequence = 0;
  return new MiningLocalContentService(
    new InMemoryLocalContentRepository(),
    {
      now: () => "2026-08-05T12:00:00.000Z",
      nextId: () => `audit-${++sequence}`,
    },
  );
}

test("executes a governed synthetic flow from legal source to assessment and succession approval", () => {
  const service = createService();
  const draftRule = new LocalContentRule(
    "rule-skilled-80",
    tenant.id,
    "project-simandou",
    "SKILLED",
    80,
    source,
  );

  service.registerRuleDraft({ tenant, actor: legalEditor, rule: draftRule });
  const validatedRule = service.validateRule({
    tenant,
    actor: legalApprover,
    ruleId: draftRule.id,
    proof: legalProof,
  });
  assert.equal(validatedRule.state, "VALIDATED");

  service.ingestWorkforceRecords({
    tenant,
    actor: dataService,
    records: [
      workforceRecord("workforce-1", "NATIONAL"),
      workforceRecord("workforce-2", "NATIONAL"),
      workforceRecord("workforce-3", "NATIONAL"),
      workforceRecord("workforce-4", "EXPATRIATE"),
    ],
  });

  const assessment = service.runAssessment({
    tenant,
    actor: complianceAgent,
    ruleId: validatedRule.id,
    asOf: "2026-08-05",
  });
  assert.equal(assessment.status, "NON_COMPLIANT");
  assert.equal(assessment.ratioPercent, 75);
  assert.equal(assessment.gapPercent, 5);
  assert.equal(assessment.assessmentType, "ADVISORY");

  const draftPlan = new SuccessionPlan(
    "succession-1",
    tenant.id,
    "project-simandou",
    "workforce-4",
    "employee-workforce-1",
    ["MINE_PLANNING", "HSE", "TEAM_LEADERSHIP"],
    ["MINE_PLANNING", "HSE"],
    "2027-06-30",
  );
  const proposed = service.createSuccessionPlan({ tenant, actor: hrPlannerAgent, plan: draftPlan });
  assert.equal(proposed.state, "DRAFT");

  const approved = service.approveSuccessionPlan({
    tenant,
    actor: hrApprover,
    planId: proposed.id,
    proof: successionProof,
  });
  assert.equal(approved.state, "APPROVED");
  assert.equal(approved.readinessPercent(), 67);

  const snapshot = service.missionControlSnapshot({ tenant, actor: auditor });
  assert.deepEqual(snapshot, {
    tenantId: tenant.id,
    rules: 1,
    workforceRecords: 4,
    assessments: 1,
    successionPlans: 1,
    auditEvents: 6,
    status: "HEALTHY",
  });

  assert.deepEqual(
    service.auditTrail({ tenant, actor: auditor }).map((event) => event.action),
    [
      "REGISTER_RULE_DRAFT",
      "VALIDATE_RULE",
      "INGEST_WORKFORCE_RECORDS",
      "RUN_COMPLIANCE_ASSESSMENT",
      "CREATE_SUCCESSION_PLAN",
      "APPROVE_SUCCESSION_PLAN",
    ],
  );
});

test("blocks unauthorized roles and cross-tenant operations", () => {
  const service = createService();
  const unauthorized = new Identity("viewer", tenant.id, "HUMAN", "Viewer", ["VIEWER"]);
  const foreignActor = new Identity("foreign-editor", "tenant-other", "HUMAN", "Foreign Editor", ["LEGAL_EDITOR"]);
  const draftRule = new LocalContentRule(
    "rule-auth",
    tenant.id,
    "project-simandou",
    "SKILLED",
    80,
    source,
  );

  assert.throws(
    () => service.registerRuleDraft({ tenant, actor: unauthorized, rule: draftRule }),
    (error: unknown) => error instanceof ControlError && /Required role/.test(error.message),
  );
  assert.throws(
    () => service.registerRuleDraft({ tenant, actor: foreignActor, rule: draftRule }),
    (error: unknown) => error instanceof ControlError && /Tenant isolation/.test(error.message),
  );
});

test("rejects duplicate object identities instead of silently overwriting evidence", () => {
  const service = createService();
  const rule = new LocalContentRule(
    "rule-duplicate",
    tenant.id,
    "project-simandou",
    "SKILLED",
    80,
    source,
  );

  service.registerRuleDraft({ tenant, actor: legalEditor, rule });
  assert.throws(
    () => service.registerRuleDraft({ tenant, actor: legalEditor, rule }),
    (error: unknown) => error instanceof ControlError && /Duplicate rule identity/.test(error.message),
  );
});
