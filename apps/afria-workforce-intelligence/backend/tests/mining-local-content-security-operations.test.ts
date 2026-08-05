import assert from "node:assert/strict";
import test from "node:test";
import { Identity, Tenant } from "../src/domain.js";
import {
  InMemoryAuthContextResolver,
  createMiningLocalContentApi,
} from "../src/mining-local-content-api.js";
import {
  BearerAuthContextResolver,
  InMemoryEmergencyStopGuard,
  InMemoryFixedWindowRateLimiter,
  InMemoryIdempotencyStore,
  type VerifiedAccessTokenClaims,
} from "../src/mining-local-content-security-operations.js";
import {
  InMemoryLocalContentRepository,
  MiningLocalContentService,
} from "../src/mining-local-content-service.js";

const tenant = new Tenant("tenant-gn", "tenant-gn", "Guinea Mining Authority", "GN");
const legalEditor = new Identity("legal-editor", tenant.id, "HUMAN", "Legal Editor", ["LEGAL_EDITOR"]);
const auditor = new Identity("auditor", tenant.id, "HUMAN", "Auditor", ["AUDITOR"]);

function service(): MiningLocalContentService {
  let sequence = 0;
  return new MiningLocalContentService(
    new InMemoryLocalContentRepository(),
    { now: () => "2026-08-05T12:00:00.000Z", nextId: () => `audit-${++sequence}` },
  );
}

function trustedRequest(
  path: string,
  actorId: string,
  options: { method?: string; body?: unknown; idempotencyKey?: string } = {},
): Request {
  const headers = new Headers({
    "x-tenant-id": tenant.id,
    "x-actor-id": actorId,
  });
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.idempotencyKey !== undefined) headers.set("idempotency-key", options.idempotencyKey);
  const init: RequestInit = { method: options.method ?? (options.body === undefined ? "GET" : "POST"), headers };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  return new Request(`https://module-06.test${path}`, init);
}

function rulePayload(id: string, thresholdPercent = 80): Record<string, unknown> {
  return {
    id,
    projectId: "project-simandou",
    category: "SKILLED",
    thresholdPercent,
    source: {
      id: `source-${id}`,
      title: "Synthetic source",
      url: "https://example.gov.gn/legal/synthetic",
      jurisdiction: "GN",
      version: "test-1",
      effectiveFrom: "2026-01-01",
      sha256: "a".repeat(64),
    },
  };
}

async function payload(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

test("uses cryptographically verified bearer claims instead of trusting identity headers", async () => {
  const claims: VerifiedAccessTokenClaims = {
    tokenId: "token-1",
    subject: auditor.id,
    tenantId: tenant.id,
    tenantName: tenant.name,
    jurisdiction: tenant.jurisdiction,
    actorKind: auditor.kind,
    actorDisplayName: auditor.displayName,
    roles: auditor.roles,
    issuedAt: "2026-08-05T11:00:00.000Z",
    expiresAt: "2026-08-05T13:00:00.000Z",
  };
  const resolver = new BearerAuthContextResolver(
    { verify: async (token) => token === "valid-token" ? claims : undefined },
    () => "2026-08-05T12:00:00.000Z",
  );
  const api = createMiningLocalContentApi({ service: service(), auth: resolver });

  const headerOnly = await api(trustedRequest("/v1/mission-control", auditor.id));
  assert.equal(headerOnly.status, 401);

  const authorized = await api(new Request("https://module-06.test/v1/mission-control", {
    headers: { authorization: "Bearer valid-token" },
  }));
  assert.equal(authorized.status, 200);
  assert.equal((await payload(authorized)).tenantId, tenant.id);
});

test("rejects expired verified bearer claims", async () => {
  const resolver = new BearerAuthContextResolver(
    {
      verify: async () => ({
        tokenId: "expired-token",
        subject: auditor.id,
        tenantId: tenant.id,
        tenantName: tenant.name,
        jurisdiction: tenant.jurisdiction,
        actorKind: auditor.kind,
        actorDisplayName: auditor.displayName,
        roles: auditor.roles,
        issuedAt: "2026-08-05T09:00:00.000Z",
        expiresAt: "2026-08-05T10:00:00.000Z",
      }),
    },
    () => "2026-08-05T12:00:00.000Z",
  );
  const api = createMiningLocalContentApi({ service: service(), auth: resolver });

  const response = await api(new Request("https://module-06.test/v1/mission-control", {
    headers: { authorization: "Bearer expired" },
  }));
  assert.equal(response.status, 401);
});

test("enforces a tenant emergency stop before executing protected routes", async () => {
  const stopGuard = new InMemoryEmergencyStopGuard();
  stopGuard.stopTenant(tenant.id, "SECURITY_INCIDENT", "2026-08-05T12:00:00.000Z");
  const api = createMiningLocalContentApi({
    service: service(),
    auth: new InMemoryAuthContextResolver([tenant], [auditor]),
    guards: [stopGuard],
  });

  const response = await api(trustedRequest("/v1/mission-control", auditor.id));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "MODULE_EMERGENCY_STOP",
    message: "MODULE 06 is suspended for this tenant",
  });
});

test("rate limits repeated requests within a fixed tenant-actor window", async () => {
  const limiter = new InMemoryFixedWindowRateLimiter({
    maxRequests: 2,
    windowMs: 60_000,
    now: () => 1_000_000,
  });
  const api = createMiningLocalContentApi({
    service: service(),
    auth: new InMemoryAuthContextResolver([tenant], [auditor]),
    guards: [limiter],
  });

  assert.equal((await api(trustedRequest("/v1/mission-control", auditor.id))).status, 200);
  assert.equal((await api(trustedRequest("/v1/mission-control", auditor.id))).status, 200);
  const limited = await api(trustedRequest("/v1/mission-control", auditor.id));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
});

test("replays successful mutating responses without executing the command twice", async () => {
  const store = new InMemoryIdempotencyStore(() => "2026-08-05T12:00:00.000Z");
  const api = createMiningLocalContentApi({
    service: service(),
    auth: new InMemoryAuthContextResolver([tenant], [legalEditor, auditor]),
    idempotency: { store, requireForMutations: true, ttlSeconds: 3_600 },
  });

  const first = await api(trustedRequest("/v1/rules", legalEditor.id, {
    body: rulePayload("rule-idempotent"),
    idempotencyKey: "idem-001",
  }));
  assert.equal(first.status, 201);
  assert.equal(first.headers.get("x-idempotent-replay"), null);

  const replay = await api(trustedRequest("/v1/rules", legalEditor.id, {
    body: rulePayload("rule-idempotent"),
    idempotencyKey: "idem-001",
  }));
  assert.equal(replay.status, 201);
  assert.equal(replay.headers.get("x-idempotent-replay"), "true");

  const mission = await api(trustedRequest("/v1/mission-control", auditor.id));
  assert.equal((await payload(mission)).auditEvents, 1);
});

test("rejects reuse of an idempotency key with a different command payload", async () => {
  const api = createMiningLocalContentApi({
    service: service(),
    auth: new InMemoryAuthContextResolver([tenant], [legalEditor]),
    idempotency: {
      store: new InMemoryIdempotencyStore(() => "2026-08-05T12:00:00.000Z"),
      requireForMutations: true,
      ttlSeconds: 3_600,
    },
  });

  assert.equal((await api(trustedRequest("/v1/rules", legalEditor.id, {
    body: rulePayload("rule-conflict", 80),
    idempotencyKey: "idem-conflict",
  }))).status, 201);

  const conflict = await api(trustedRequest("/v1/rules", legalEditor.id, {
    body: rulePayload("rule-conflict", 90),
    idempotencyKey: "idem-conflict",
  }));
  assert.equal(conflict.status, 409);
  assert.equal((await payload(conflict)).error, "IDEMPOTENCY_CONFLICT");
});

test("requires an idempotency key for mutations when the production policy enables it", async () => {
  const api = createMiningLocalContentApi({
    service: service(),
    auth: new InMemoryAuthContextResolver([tenant], [legalEditor]),
    idempotency: {
      store: new InMemoryIdempotencyStore(() => "2026-08-05T12:00:00.000Z"),
      requireForMutations: true,
      ttlSeconds: 3_600,
    },
  });

  const response = await api(trustedRequest("/v1/rules", legalEditor.id, {
    body: rulePayload("rule-no-key"),
  }));
  assert.equal(response.status, 400);
  assert.equal((await payload(response)).error, "IDEMPOTENCY_KEY_REQUIRED");
});
