import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { Identity, Tenant } from "../src/domain.js";
import {
  PostgresEmergencyStopGuard,
  PostgresIdempotencyStore,
} from "../src/mining-local-content-postgres-security.js";

const adminDatabaseUrl = process.env.DATABASE_URL;
const appDatabaseUrl = process.env.APP_DATABASE_URL;
const integrationEnabled = Boolean(adminDatabaseUrl && appDatabaseUrl);

async function seedTenant(admin: Pool): Promise<{
  tenant: Tenant;
  auditor: Identity;
}> {
  const tenantId = randomUUID();
  const actorId = randomUUID();
  await admin.query(
    `insert into workforce_tenants (id, slug, name, jurisdiction)
     values ($1, $2, $3, $4)`,
    [tenantId, `tenant-${tenantId}`, "Mining Authority", "GN"],
  );
  await admin.query(
    `insert into workforce_identities (id, tenant_id, kind, display_name, roles)
     values ($1, $2, 'HUMAN', 'Auditor', '["AUDITOR"]'::jsonb)`,
    [actorId, tenantId],
  );
  return {
    tenant: new Tenant(tenantId, tenantId, "Mining Authority", "GN"),
    auditor: new Identity(actorId, tenantId, "HUMAN", "Auditor", ["AUDITOR"]),
  };
}

test("persists and reloads an idempotent response under the authenticated tenant", { skip: !integrationEnabled }, async () => {
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const app = new Pool({ connectionString: appDatabaseUrl });
  try {
    const { tenant, auditor } = await seedTenant(admin);
    const now = "2026-08-05T14:30:00.000Z";
    const store = new PostgresIdempotencyStore(app, () => now);
    const scopeKey = `${tenant.id}:${auditor.id}:POST:/v1/rules:idem-persist-001`;

    const stored = await store.put(scopeKey, {
      requestHash: "a".repeat(64),
      responseStatus: 201,
      responseHeaders: { "content-type": "application/json" },
      responseBody: "{\"id\":\"rule-1\"}",
    }, 3600);

    assert.equal(stored.createdAt, now);
    assert.equal(stored.expiresAt, "2026-08-05T15:30:00.000Z");

    const reloaded = await new PostgresIdempotencyStore(app, () => now).get(scopeKey);
    assert.deepEqual(reloaded, stored);
  } finally {
    await app.end();
    await admin.end();
  }
});

test("deletes an expired idempotency record instead of replaying it", { skip: !integrationEnabled }, async () => {
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const app = new Pool({ connectionString: appDatabaseUrl });
  try {
    const { tenant, auditor } = await seedTenant(admin);
    const scopeKey = `${tenant.id}:${auditor.id}:POST:/v1/rules:idem-expired-001`;
    await new PostgresIdempotencyStore(app, () => "2026-08-05T14:00:00.000Z").put(scopeKey, {
      requestHash: "b".repeat(64),
      responseStatus: 201,
      responseHeaders: {},
      responseBody: "{}",
    }, 60);

    const expired = await new PostgresIdempotencyStore(app, () => "2026-08-05T14:02:00.000Z").get(scopeKey);
    assert.equal(expired, undefined);
  } finally {
    await app.end();
    await admin.end();
  }
});

test("reads a tenant emergency stop from PostgreSQL and resumes when the control is cleared", { skip: !integrationEnabled }, async () => {
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const app = new Pool({ connectionString: appDatabaseUrl });
  try {
    const { tenant, auditor } = await seedTenant(admin);
    await admin.query(
      `insert into local_content_module_controls (
         tenant_id, module_enabled, emergency_stop, stop_reason,
         stopped_by_identity_id, stopped_at
       ) values ($1, true, true, 'SECURITY_INCIDENT', $2, $3)`,
      [tenant.id, auditor.id, "2026-08-05T14:00:00.000Z"],
    );

    const guard = new PostgresEmergencyStopGuard(app);
    const stopped = await guard.evaluate({
      context: { tenant, actor: auditor },
      request: new Request("https://module-06.test/v1/mission-control"),
      path: "/v1/mission-control",
    });
    assert.equal(stopped.allowed, false);
    if (!stopped.allowed) assert.equal(stopped.code, "MODULE_EMERGENCY_STOP");

    await admin.query(
      `update local_content_module_controls
       set emergency_stop = false, stop_reason = null, resumed_by_identity_id = $2,
           resumed_at = $3, updated_at = $3
       where tenant_id = $1`,
      [tenant.id, auditor.id, "2026-08-05T14:10:00.000Z"],
    );

    const resumed = await guard.evaluate({
      context: { tenant, actor: auditor },
      request: new Request("https://module-06.test/v1/mission-control"),
      path: "/v1/mission-control",
    });
    assert.deepEqual(resumed, { allowed: true });
  } finally {
    await app.end();
    await admin.end();
  }
});

test("fails closed when the emergency-control database is unavailable", async () => {
  const tenantId = randomUUID();
  const tenant = new Tenant(tenantId, tenantId, "Mining Authority", "GN");
  const actor = new Identity(randomUUID(), tenant.id, "HUMAN", "Auditor", ["AUDITOR"]);
  const guard = new PostgresEmergencyStopGuard({
    connect: async () => {
      throw new Error("database unavailable");
    },
  });

  const decision = await guard.evaluate({
    context: { tenant, actor },
    request: new Request("https://module-06.test/v1/mission-control"),
    path: "/v1/mission-control",
  });

  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.code, "EMERGENCY_CONTROL_UNAVAILABLE");
});
