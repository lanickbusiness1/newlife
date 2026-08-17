import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { Identity, Tenant } from "../src/domain.js";
import { ControlError } from "../src/living-core.js";
import { OreLot, ValueCaptureComponent, type EvidenceLink } from "../src/simandou-value-capture.js";
import {
  SimandouValueCaptureCommandService,
  type SimandouAuditEvent,
  type SimandouAuditSink,
  type SimandouMutationRepository,
} from "../src/simandou-value-capture-service.js";
import { PostgresSimandouAuditSink } from "../src/simandou-value-capture-operations.js";

const adminDatabaseUrl = process.env.DATABASE_URL;
const appDatabaseUrl = process.env.APP_DATABASE_URL;
const integrationEnabled = Boolean(adminDatabaseUrl && appDatabaseUrl);

const evidence: EvidenceLink[] = [{
  evidenceId: "service-proof",
  source: "synthetic://simandou/service",
  sha256: "e".repeat(64),
  observedAt: "2026-08-17T00:00:00.000Z",
  truthClass: "FACT",
}];

class MemoryRepository implements SimandouMutationRepository {
  readonly lots: OreLot[] = [];
  readonly components: ValueCaptureComponent[] = [];
  readonly exceptions: Array<{ code: string }> = [];

  async saveOreLot(lot: OreLot): Promise<OreLot> {
    this.lots.push(lot);
    return lot;
  }

  async saveValueCaptureComponent(component: ValueCaptureComponent): Promise<ValueCaptureComponent> {
    this.components.push(component);
    return component;
  }

  async saveReconciliationException(exception: { code: string }): Promise<{ code: string }> {
    this.exceptions.push(exception);
    return exception;
  }
}

class MemoryAuditSink implements SimandouAuditSink {
  readonly events: SimandouAuditEvent[] = [];
  async append(event: SimandouAuditEvent): Promise<SimandouAuditEvent> {
    this.events.push(event);
    return event;
  }
}

function contexts() {
  const tenant = new Tenant("tenant-gn", "tenant-gn", "Mining Authority", "GN");
  return {
    tenant,
    steward: new Identity("steward", tenant.id, "HUMAN", "Data Steward", ["DATA_STEWARD"]),
    analyst: new Identity("analyst", tenant.id, "HUMAN", "Value Analyst", ["VALUE_CAPTURE_ANALYST"]),
    outsider: new Identity("outsider", tenant.id, "HUMAN", "Outsider", ["AUDITOR"]),
  };
}

test("registers an ore lot only for an authorized tenant actor and appends audit", async () => {
  const repo = new MemoryRepository();
  const audit = new MemoryAuditSink();
  const service = new SimandouValueCaptureCommandService(repo, audit, {
    nextId: () => "audit-1",
    now: () => "2026-08-17T00:00:00.000Z",
  });
  const { tenant, steward, outsider } = contexts();
  const lot = new OreLot("lot-1", tenant.id, "simandou", 100, 65, "2026-08-17", evidence);

  await assert.rejects(
    () => service.registerOreLot({ tenant, actor: outsider, lot, correlationId: "corr-denied" }),
    (error: unknown) => error instanceof ControlError && /DATA_STEWARD/.test(error.message),
  );
  assert.equal(repo.lots.length, 0);
  assert.equal(audit.events.length, 0);

  await service.registerOreLot({ tenant, actor: steward, lot, correlationId: "corr-1" });
  assert.equal(repo.lots.length, 1);
  assert.equal(audit.events.length, 1);
  assert.equal(audit.events[0]?.action, "REGISTER_ORE_LOT");
  assert.equal(audit.events[0]?.aggregateId, "lot-1");
  assert.equal(audit.events[0]?.correlationId, "corr-1");
});

test("blocks cross-tenant command execution before repository mutation", async () => {
  const repo = new MemoryRepository();
  const audit = new MemoryAuditSink();
  const service = new SimandouValueCaptureCommandService(repo, audit);
  const { tenant, steward } = contexts();
  const foreignLot = new OreLot("lot-x", "tenant-other", "simandou", 100, 65, "2026-08-17", evidence);
  await assert.rejects(
    () => service.registerOreLot({ tenant, actor: steward, lot: foreignLot, correlationId: "corr-x" }),
    (error: unknown) => error instanceof ControlError && /Tenant isolation/i.test(error.message),
  );
  assert.equal(repo.lots.length, 0);
});

test("records value-capture components with analyst role and audit evidence", async () => {
  const repo = new MemoryRepository();
  const audit = new MemoryAuditSink();
  const service = new SimandouValueCaptureCommandService(repo, audit, {
    nextId: () => "audit-vc",
    now: () => "2026-08-17T00:00:00.000Z",
  });
  const { tenant, analyst } = contexts();
  const component = new ValueCaptureComponent("vc-1", tenant.id, "simandou", "PUBLIC_REVENUE", 100, "USD", "receipt-1", evidence);
  await service.recordValueCaptureComponent({ tenant, actor: analyst, component, correlationId: "corr-vc" });
  assert.equal(repo.components.length, 1);
  assert.equal(audit.events[0]?.action, "RECORD_VALUE_CAPTURE_COMPONENT");
  assert.deepEqual(audit.events[0]?.payload, { bucket: "PUBLIC_REVENUE", amount: 100, currency: "USD", sourceTransactionId: "receipt-1" });
});

async function seedAuditProject(admin: Pool): Promise<{ tenantId: string; projectId: string; actorId: string }> {
  const tenantId = randomUUID();
  const projectId = randomUUID();
  const actorId = randomUUID();
  await admin.query(`insert into workforce_tenants (id, slug, name, jurisdiction) values ($1,$2,'Mining Authority','GN')`, [tenantId, `tenant-${tenantId}`]);
  await admin.query(`insert into workforce_identities (id, tenant_id, kind, display_name, roles) values ($1,$2,'HUMAN','Auditor','["AUDITOR"]'::jsonb)`, [actorId, tenantId]);
  await admin.query(`insert into mining_projects (id, tenant_id, project_code, name, state) values ($1,$2,$3,'Simandou Audit','ACTIVE')`, [projectId, tenantId, `SIM-${projectId}`]);
  return { tenantId, projectId, actorId };
}

test("persists a hash-chained append-only audit trail under RLS", { skip: !integrationEnabled }, async () => {
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const app = new Pool({ connectionString: appDatabaseUrl });
  try {
    const seeded = await seedAuditProject(admin);
    const sink = new PostgresSimandouAuditSink(app);
    const base = {
      tenantId: seeded.tenantId,
      projectId: seeded.projectId,
      actorId: seeded.actorId,
      actorKind: "HUMAN" as const,
      correlationId: "corr-audit",
      occurredAt: "2026-08-17T00:00:00.000Z",
    };
    const first = await sink.append({ ...base, id: randomUUID(), action: "REGISTER_ORE_LOT", aggregateId: "lot-1", payload: { tonnage: 100 } });
    const second = await sink.append({ ...base, id: randomUUID(), action: "RECORD_VALUE_CAPTURE_COMPONENT", aggregateId: "vc-1", payload: { amount: 10 } });
    assert.equal(first.previousHash, null);
    assert.equal(first.eventHash.length, 64);
    assert.equal(second.previousHash, first.eventHash);

    const events = await sink.list(seeded.tenantId, seeded.projectId);
    assert.equal(events.length, 2);
    assert.equal(events[1]?.previousHash, events[0]?.eventHash);

    await assert.rejects(
      () => admin.query(`update local_content_audit_events set action = 'TAMPERED' where id = $1`, [first.id]),
      /append-only/i,
    );
  } finally {
    await app.end();
    await admin.end();
  }
});
