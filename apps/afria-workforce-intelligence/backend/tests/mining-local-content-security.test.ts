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
const otherTenant = new Tenant("tenant-rw", "tenant-rw", "Rwanda Mining Authority", "RW");
const identities = [
  new Identity("legal-editor", tenant.id, "HUMAN", "Legal Editor", ["LEGAL_EDITOR"]),
  new Identity("viewer", tenant.id, "HUMAN", "Viewer", ["VIEWER"]),
  new Identity("foreign-auditor", otherTenant.id, "HUMAN", "Foreign Auditor", ["AUDITOR"]),
];

function createApi() {
  return createMiningLocalContentApi({
    service: new MiningLocalContentService(new InMemoryLocalContentRepository()),
    auth: new InMemoryAuthContextResolver([tenant, otherTenant], identities),
    maxBodyBytes: 16_384,
  });
}

function request(
  path: string,
  options: {
    tenantId?: string;
    actorId?: string;
    method?: string;
    contentType?: string;
    correlationId?: string;
    body?: unknown;
  } = {},
): Request {
  const headers = new Headers();
  if (options.tenantId !== undefined) headers.set("x-tenant-id", options.tenantId);
  if (options.actorId !== undefined) headers.set("x-actor-id", options.actorId);
  if (options.contentType !== undefined) headers.set("content-type", options.contentType);
  if (options.correlationId !== undefined) headers.set("x-correlation-id", options.correlationId);
  const init: RequestInit = { method: options.method ?? (options.body === undefined ? "GET" : "POST"), headers };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  return new Request(`https://module-06.test${path}`, init);
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

test("does not allow a valid actor identity to be replayed under another tenant", async () => {
  const response = await createApi()(request("/v1/audit-trail", {
    tenantId: otherTenant.id,
    actorId: "legal-editor",
  }));

  assert.equal(response.status, 401);
  assert.equal((await json(response)).error, "AUTHENTICATION_REQUIRED");
});

test("enforces auditor role on privileged read endpoints", async () => {
  const response = await createApi()(request("/v1/audit-trail", {
    tenantId: tenant.id,
    actorId: "viewer",
  }));

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "FORBIDDEN",
    message: "Required role missing: AUDITOR",
  });
});

test("ignores tenant and role fields injected in a command payload", async () => {
  const response = await createApi()(request("/v1/rules", {
    tenantId: tenant.id,
    actorId: "legal-editor",
    contentType: "application/json",
    body: {
      id: "rule-payload-injection",
      tenantId: otherTenant.id,
      actor: { id: "attacker", roles: ["LEGAL_APPROVER", "AUDITOR"] },
      projectId: "project-simandou",
      category: "SKILLED",
      thresholdPercent: 80,
      source: {
        id: "GN-SYNTHETIC",
        title: "Synthetic source",
        url: "https://example.gov.gn/legal/synthetic",
        jurisdiction: "GN",
        version: "test-1",
        effectiveFrom: "2026-01-01",
        sha256: "a".repeat(64),
      },
    },
  }));

  assert.equal(response.status, 201);
  assert.equal((await json(response)).tenantId, tenant.id);
});

test("rejects unsupported content types before parsing command bodies", async () => {
  const response = await createApi()(request("/v1/rules", {
    tenantId: tenant.id,
    actorId: "legal-editor",
    contentType: "text/plain",
    body: { id: "rule" },
  }));

  assert.equal(response.status, 415);
  assert.equal((await json(response)).error, "UNSUPPORTED_MEDIA_TYPE");
});

test("returns a controlled not-found response for unknown routes", async () => {
  const response = await createApi()(request("/v1/internal/secrets", {
    tenantId: tenant.id,
    actorId: "legal-editor",
  }));

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: "NOT_FOUND",
    message: "API route not found",
  });
});

test("returns correlation and defensive response headers without enabling CORS implicitly", async () => {
  const response = await createApi()(request("/health", { correlationId: "corr-security-001" }));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-correlation-id"), "corr-security-001");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});
