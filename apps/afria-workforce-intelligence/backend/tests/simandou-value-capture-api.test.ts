import assert from "node:assert/strict";
import test from "node:test";
import { Identity, Tenant } from "../src/domain.js";
import {
  InMemoryAuthContextResolver,
  type ApiRequestGuard,
} from "../src/mining-local-content-api.js";
import {
  InMemoryEmergencyStopGuard,
  InMemoryIdempotencyStore,
} from "../src/mining-local-content-security-operations.js";
import { OreLot, ValueCaptureComponent, type EvidenceLink } from "../src/simandou-value-capture.js";
import {
  SimandouValueCaptureCommandService,
  type SimandouAuditEvent,
  type SimandouAuditSink,
  type SimandouMutationRepository,
} from "../src/simandou-value-capture-service.js";
import { createSimandouValueCaptureApi } from "../src/simandou-value-capture-api.js";

const tenant = new Tenant("tenant-gn", "tenant-gn", "Mining Authority", "GN");
const steward = new Identity("steward", tenant.id, "HUMAN", "Steward", ["DATA_STEWARD"]);
const analyst = new Identity("analyst", tenant.id, "HUMAN", "Analyst", ["VALUE_CAPTURE_ANALYST"]);
const auditor = new Identity("auditor", tenant.id, "HUMAN", "Auditor", ["AUDITOR"]);
const auth = new InMemoryAuthContextResolver([tenant], [steward, analyst, auditor]);

const evidence: EvidenceLink[] = [{
  evidenceId: "api-proof",
  source: "synthetic://simandou/api",
  sha256: "f".repeat(64),
  observedAt: "2026-08-17T00:00:00.000Z",
  truthClass: "FACT",
}];

class ApiRepository implements SimandouMutationRepository {
  readonly lots: OreLot[] = [];
  readonly components: ValueCaptureComponent[] = [];
  async saveOreLot(lot: OreLot): Promise<OreLot> { this.lots.push(lot); return lot; }
  async saveValueCaptureComponent(component: ValueCaptureComponent): Promise<ValueCaptureComponent> { this.components.push(component); return component; }
  async saveReconciliationException(exception: { code: string }): Promise<unknown> { return exception; }
}

class ApiAudit implements SimandouAuditSink {
  readonly events: SimandouAuditEvent[] = [];
  async append(event: SimandouAuditEvent): Promise<SimandouAuditEvent> { this.events.push(event); return event; }
}

function jsonRequest(path: string, actorId: string, body: unknown, key = "idem-api-0001"): Request {
  return new Request(`https://simandou.test${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tenant-id": tenant.id,
      "x-actor-id": actorId,
      "idempotency-key": key,
    },
    body: JSON.stringify(body),
  });
}

function lotBody() {
  return {
    id: "lot-api-1",
    projectId: "simandou",
    tonnage: 100,
    gradeFePercent: 65,
    extractedAt: "2026-08-17",
    evidence,
  };
}

test("health is public but explicitly identifies synthetic sandbox status", async () => {
  const repo = new ApiRepository();
  const api = createSimandouValueCaptureApi({
    service: new SimandouValueCaptureCommandService(repo, new ApiAudit()),
    auth,
  });
  const response = await api(new Request("https://simandou.test/health"));
  assert.equal(response.status, 200);
  const body = await response.json() as { status: string; environment: string };
  assert.equal(body.status, "healthy");
  assert.equal(body.environment, "SYNTHETIC_SANDBOX");
});

test("rejects unauthenticated mutation and never trusts tenant from body", async () => {
  const repo = new ApiRepository();
  const api = createSimandouValueCaptureApi({ service: new SimandouValueCaptureCommandService(repo, new ApiAudit()), auth });
  const unauthenticated = new Request("https://simandou.test/v1/simandou/ore-lots", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "idem-noauth-1" },
    body: JSON.stringify(lotBody()),
  });
  assert.equal((await api(unauthenticated)).status, 401);

  const injectedTenant = jsonRequest(
    "/v1/simandou/ore-lots",
    steward.id,
    { ...lotBody(), tenantId: "tenant-other" },
    "idem-inject-1",
  );
  const response = await api(injectedTenant);
  assert.equal(response.status, 400);
  const body = await response.json() as { error: { code: string } };
  assert.equal(body.error.code, "TENANT_BODY_FORBIDDEN");
  assert.equal(repo.lots.length, 0);
});

test("requires idempotency key for mutations and replays identical request once", async () => {
  const repo = new ApiRepository();
  const store = new InMemoryIdempotencyStore(() => "2026-08-17T00:00:00.000Z");
  const api = createSimandouValueCaptureApi({
    service: new SimandouValueCaptureCommandService(repo, new ApiAudit()),
    auth,
    idempotency: { store, ttlSeconds: 3600, requireForMutations: true },
  });

  const withoutKey = new Request("https://simandou.test/v1/simandou/ore-lots", {
    method: "POST",
    headers: { "content-type": "application/json", "x-tenant-id": tenant.id, "x-actor-id": steward.id },
    body: JSON.stringify(lotBody()),
  });
  assert.equal((await api(withoutKey)).status, 400);

  const first = await api(jsonRequest("/v1/simandou/ore-lots", steward.id, lotBody(), "idem-replay-1"));
  assert.equal(first.status, 201);
  const replay = await api(jsonRequest("/v1/simandou/ore-lots", steward.id, lotBody(), "idem-replay-1"));
  assert.equal(replay.status, 201);
  assert.equal(replay.headers.get("x-idempotent-replay"), "true");
  assert.equal(repo.lots.length, 1);
});

test("emergency-stop guard blocks a tenant before mutation", async () => {
  const repo = new ApiRepository();
  const stop = new InMemoryEmergencyStopGuard();
  stop.stopTenant(tenant.id, "CONTROL_TEST", "2026-08-17T00:00:00.000Z");
  const guards: ApiRequestGuard[] = [stop];
  const api = createSimandouValueCaptureApi({
    service: new SimandouValueCaptureCommandService(repo, new ApiAudit()),
    auth,
    guards,
    idempotency: { store: new InMemoryIdempotencyStore(), ttlSeconds: 3600, requireForMutations: true },
  });
  const response = await api(jsonRequest("/v1/simandou/ore-lots", steward.id, lotBody(), "idem-stop-1"));
  assert.equal(response.status, 503);
  const body = await response.json() as { error: { code: string } };
  assert.equal(body.error.code, "MODULE_EMERGENCY_STOP");
  assert.equal(repo.lots.length, 0);
});

test("records a value component only for VALUE_CAPTURE_ANALYST", async () => {
  const repo = new ApiRepository();
  const api = createSimandouValueCaptureApi({
    service: new SimandouValueCaptureCommandService(repo, new ApiAudit()),
    auth,
    idempotency: { store: new InMemoryIdempotencyStore(), ttlSeconds: 3600, requireForMutations: true },
  });
  const body = {
    id: "vc-api-1",
    projectId: "simandou",
    bucket: "PUBLIC_REVENUE",
    amount: 100,
    currency: "USD",
    sourceTransactionId: "receipt-1",
    evidence,
  };
  const denied = await api(jsonRequest("/v1/simandou/value-components", auditor.id, body, "idem-vc-denied"));
  assert.equal(denied.status, 403);
  const accepted = await api(jsonRequest("/v1/simandou/value-components", analyst.id, body, "idem-vc-ok"));
  assert.equal(accepted.status, 201);
  assert.equal(repo.components.length, 1);
});
