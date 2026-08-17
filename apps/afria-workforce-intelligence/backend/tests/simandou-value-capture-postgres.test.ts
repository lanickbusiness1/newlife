import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { ControlError } from "../src/living-core.js";
import { OreLot, ValueCaptureComponent, type EvidenceLink } from "../src/simandou-value-capture.js";
import {
  PostgresSimandouRepository,
  type StoredReconciliationException,
} from "../src/simandou-value-capture-postgres.js";

const adminDatabaseUrl = process.env.DATABASE_URL;
const appDatabaseUrl = process.env.APP_DATABASE_URL;
const integrationEnabled = Boolean(adminDatabaseUrl && appDatabaseUrl);

const evidence: EvidenceLink[] = [{
  evidenceId: "evidence-pg",
  source: "synthetic://simandou/postgres",
  sha256: "d".repeat(64),
  observedAt: "2026-08-17T00:00:00.000Z",
  truthClass: "FACT",
}];

async function seedProject(admin: Pool): Promise<{ tenantId: string; projectId: string }> {
  const tenantId = randomUUID();
  const projectId = randomUUID();
  await admin.query(
    `insert into workforce_tenants (id, slug, name, jurisdiction) values ($1, $2, 'Mining Authority', 'GN')`,
    [tenantId, `tenant-${tenantId}`],
  );
  await admin.query(
    `insert into mining_projects (id, tenant_id, project_code, name, state) values ($1, $2, $3, 'Simandou Test', 'ACTIVE')`,
    [projectId, tenantId, `SIM-${projectId}`],
  );
  return { tenantId, projectId };
}

test("persists and reloads an OreLot under tenant/project RLS", { skip: !integrationEnabled }, async () => {
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const app = new Pool({ connectionString: appDatabaseUrl });
  try {
    const { tenantId, projectId } = await seedProject(admin);
    const repo = new PostgresSimandouRepository(app);
    const lot = new OreLot(randomUUID(), tenantId, projectId, 123.45, 65.3, "2026-08-17", evidence);
    await repo.saveOreLot(lot);
    const reloaded = await repo.getOreLot(tenantId, projectId, lot.id);
    assert.ok(reloaded);
    assert.equal(reloaded.tonnage, 123.45);
    assert.equal(reloaded.gradeFePercent, 65.3);
    assert.equal(reloaded.version, 1);
  } finally {
    await app.end();
    await admin.end();
  }
});

test("blocks stale optimistic updates", { skip: !integrationEnabled }, async () => {
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const app = new Pool({ connectionString: appDatabaseUrl });
  try {
    const { tenantId, projectId } = await seedProject(admin);
    const repo = new PostgresSimandouRepository(app);
    const id = randomUUID();
    await repo.saveOreLot(new OreLot(id, tenantId, projectId, 100, 65, "2026-08-17", evidence));
    await repo.replaceOreLot(new OreLot(id, tenantId, projectId, 110, 65.1, "2026-08-17", evidence, 2), 1);
    await assert.rejects(
      () => repo.replaceOreLot(new OreLot(id, tenantId, projectId, 120, 65.2, "2026-08-17", evidence, 2), 1),
      (error: unknown) => error instanceof ControlError && /optimistic version conflict/i.test(error.message),
    );
  } finally {
    await app.end();
    await admin.end();
  }
});

test("persists value components while preserving database anti-double-counting", { skip: !integrationEnabled }, async () => {
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const app = new Pool({ connectionString: appDatabaseUrl });
  try {
    const { tenantId, projectId } = await seedProject(admin);
    const repo = new PostgresSimandouRepository(app);
    await repo.saveValueCaptureComponent(new ValueCaptureComponent(randomUUID(), tenantId, projectId, "PUBLIC_REVENUE", 100, "USD", "receipt-1", evidence));
    await assert.rejects(
      () => repo.saveValueCaptureComponent(new ValueCaptureComponent(randomUUID(), tenantId, projectId, "STATE_EQUITY", 100, "USD", "receipt-1", evidence)),
      (error: unknown) => error instanceof ControlError && /double counting/i.test(error.message),
    );
    const components = await repo.listValueCaptureComponents(tenantId, projectId);
    assert.equal(components.length, 1);
    assert.equal(components[0]?.bucket, "PUBLIC_REVENUE");
  } finally {
    await app.end();
    await admin.end();
  }
});

test("persists reconciliation exceptions without fraud semantics", { skip: !integrationEnabled }, async () => {
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const app = new Pool({ connectionString: appDatabaseUrl });
  try {
    const { tenantId, projectId } = await seedProject(admin);
    const repo = new PostgresSimandouRepository(app);
    const exception: StoredReconciliationException = {
      id: randomUUID(),
      tenantId,
      projectId,
      shipmentId: null,
      code: "PAYMENT_MISMATCH",
      message: "Synthetic payment variance",
      sourceObjectIds: ["invoice-1", "payment-1"],
      evidenceIds: ["evidence-pg"],
      state: "OPEN",
    };
    await repo.saveReconciliationException(exception);
    const rows = await repo.listReconciliationExceptions(tenantId, projectId, "OPEN");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.code, "PAYMENT_MISMATCH");
    assert.equal(rows[0]?.message.includes("fraud"), false);
  } finally {
    await app.end();
    await admin.end();
  }
});

test("does not expose another tenant through repository reads", { skip: !integrationEnabled }, async () => {
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const app = new Pool({ connectionString: appDatabaseUrl });
  try {
    const a = await seedProject(admin);
    const b = await seedProject(admin);
    const repo = new PostgresSimandouRepository(app);
    const lotA = new OreLot(randomUUID(), a.tenantId, a.projectId, 100, 65, "2026-08-17", evidence);
    const lotB = new OreLot(randomUUID(), b.tenantId, b.projectId, 200, 66, "2026-08-17", evidence);
    await repo.saveOreLot(lotA);
    await repo.saveOreLot(lotB);
    assert.equal(await repo.getOreLot(a.tenantId, a.projectId, lotB.id), undefined);
  } finally {
    await app.end();
    await admin.end();
  }
});
