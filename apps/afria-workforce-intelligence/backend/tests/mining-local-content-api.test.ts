import assert from "node:assert/strict";
import test from "node:test";
import { Identity, Tenant } from "../src/domain.js";
import {
  InMemoryAuthContextResolver,
  createMiningLocalContentApi,
} from "../src/mining-local-content-api.js";
import {
  InMemoryLocalContentRepository,
  MiningLocalContentService,
} from "../src/mining-local-content-service.js";

const tenant = new Tenant("tenant-gn", "tenant-gn", "Guinea Mining Authority", "GN");
const identities = [
  new Identity("legal-editor", tenant.id, "HUMAN", "Legal Editor", ["LEGAL_EDITOR"]),
  new Identity("legal-approver", tenant.id, "HUMAN", "Legal Director", ["LEGAL_APPROVER"]),
  new Identity("data-service", tenant.id, "SERVICE", "HR Import Service", ["DATA_STEWARD"]),
  new Identity("compliance-agent", tenant.id, "AGENT", "Compliance Agent", ["COMPLIANCE_ANALYST"]),
  new Identity("hr-planner-agent", tenant.id, "AGENT", "Succession Agent", ["HR_PLANNER"]),
  new Identity("hr-approver", tenant.id, "HUMAN", "HR Director", ["HR_APPROVER"]),
  new Identity("auditor", tenant.id, "HUMAN", "Internal Auditor", ["AUDITOR"]),
];

function jsonRequest(
  path: string,
  actorId: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Request {
  const init: RequestInit = {
    method,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": tenant.id,
      "x-actor-id": actorId,
      "x-correlation-id": `corr-${actorId}-${path}`,
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(`https://module-06.test${path}`, init);
}

function createApi() {
  let auditSequence = 0;
  const service = new MiningLocalContentService(
    new InMemoryLocalContentRepository(),
    {
      now: () => "2026-08-05T12:00:00.000Z",
      nextId: () => `audit-${++auditSequence}`,
    },
  );
  const auth = new InMemoryAuthContextResolver([tenant], identities);
  return createMiningLocalContentApi({ service, auth, maxBodyBytes: 64_000 });
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

test("exposes a governed HTTP contract for the full synthetic local-content flow", async () => {
  const api = createApi();

  const health = await api(new Request("https://module-06.test/health"));
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "healthy", module: "MODULE-06" });

  const createRule = await api(jsonRequest("/v1/rules", "legal-editor", {
    id: "rule-skilled-80",
    projectId: "project-simandou",
    category: "SKILLED",
    thresholdPercent: 80,
    source: {
      id: "GN-SOURCE-SYNTHETIC-001",
      title: "Synthetic legal source for controlled API testing",
      url: "https://example.gov.gn/legal/synthetic-source",
      jurisdiction: "GN",
      version: "test-1",
      effectiveFrom: "2026-01-01",
      sha256: "a".repeat(64),
    },
  }));
  assert.equal(createRule.status, 201);

  const validateRule = await api(jsonRequest("/v1/rules/rule-skilled-80/validate", "legal-approver", {
    proof: {
      id: "proof-legal",
      kind: "LEGAL_RULE_APPROVAL",
      createdAt: "2026-08-05T10:00:00.000Z",
      sha256: "b".repeat(64),
    },
  }));
  assert.equal(validateRule.status, 200);

  const ingest = await api(jsonRequest("/v1/workforce/batch", "data-service", {
    records: [
      ["workforce-1", "NATIONAL", 4_000],
      ["workforce-2", "NATIONAL", 4_000],
      ["workforce-3", "NATIONAL", 4_000],
      ["workforce-4", "EXPATRIATE", 12_000],
    ].map(([id, nationalityStatus, monthlyCostUsd]) => ({
      id,
      projectId: "project-simandou",
      employeeId: `employee-${id}`,
      roleId: `role-${id}`,
      category: "SKILLED",
      nationalityStatus,
      monthlyCostUsd,
      state: "ACTIVE",
      evidence: [{
        id: `evidence-${id}`,
        kind: "EMPLOYMENT_RECORD",
        createdAt: "2026-08-05T09:00:00.000Z",
      }],
    })),
  }));
  assert.equal(ingest.status, 202);

  const assessmentResponse = await api(jsonRequest("/v1/assessments", "compliance-agent", {
    ruleId: "rule-skilled-80",
    asOf: "2026-08-05",
  }));
  assert.equal(assessmentResponse.status, 200);
  const assessment = await responseJson(assessmentResponse);
  assert.equal(assessment.status, "NON_COMPLIANT");
  assert.equal(assessment.ratioPercent, 75);
  assert.equal(assessment.gapPercent, 5);

  const createPlan = await api(jsonRequest("/v1/succession-plans", "hr-planner-agent", {
    id: "succession-1",
    projectId: "project-simandou",
    expatriateWorkforceRecordId: "workforce-4",
    nationalCandidateEmployeeId: "employee-workforce-1",
    requiredSkills: ["MINE_PLANNING", "HSE", "TEAM_LEADERSHIP"],
    candidateSkills: ["MINE_PLANNING", "HSE"],
    targetDate: "2027-06-30",
  }));
  assert.equal(createPlan.status, 201);

  const approvePlan = await api(jsonRequest("/v1/succession-plans/succession-1/approve", "hr-approver", {
    proof: {
      id: "proof-succession",
      kind: "SUCCESSION_PLAN_APPROVAL",
      createdAt: "2026-08-05T10:10:00.000Z",
      sha256: "c".repeat(64),
    },
  }));
  assert.equal(approvePlan.status, 200);

  const missionResponse = await api(jsonRequest("/v1/mission-control", "auditor"));
  assert.equal(missionResponse.status, 200);
  const mission = await responseJson(missionResponse);
  assert.equal(mission.rules, 1);
  assert.equal(mission.workforceRecords, 4);
  assert.equal(mission.assessments, 1);
  assert.equal(mission.successionPlans, 1);
  assert.equal(mission.auditEvents, 6);

  const auditResponse = await api(jsonRequest("/v1/audit-trail", "auditor"));
  assert.equal(auditResponse.status, 200);
  const audit = await auditResponse.json() as unknown[];
  assert.equal(audit.length, 6);
});

test("returns controlled authentication and validation errors without leaking internals", async () => {
  const api = createApi();

  const unauthenticated = await api(new Request("https://module-06.test/v1/mission-control"));
  assert.equal(unauthenticated.status, 401);
  assert.deepEqual(await unauthenticated.json(), {
    error: "AUTHENTICATION_REQUIRED",
    message: "Trusted tenant and actor context is required",
  });

  const invalidBody = await api(new Request("https://module-06.test/v1/rules", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tenant-id": tenant.id,
      "x-actor-id": "legal-editor",
    },
    body: "{not-json",
  }));
  assert.equal(invalidBody.status, 400);
  const invalidPayload = await responseJson(invalidBody);
  assert.equal(invalidPayload.error, "INVALID_REQUEST");
  assert.equal(typeof invalidPayload.message, "string");
  assert.equal(invalidPayload.stack, undefined);
});

test("rejects payloads above the configured body limit", async () => {
  const api = createMiningLocalContentApi({
    service: new MiningLocalContentService(new InMemoryLocalContentRepository()),
    auth: new InMemoryAuthContextResolver([tenant], identities),
    maxBodyBytes: 64,
  });

  const response = await api(jsonRequest("/v1/rules", "legal-editor", { padding: "x".repeat(1_000) }));
  assert.equal(response.status, 413);
  assert.equal((await responseJson(response)).error, "PAYLOAD_TOO_LARGE");
});
