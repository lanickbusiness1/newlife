import { createHash } from "node:crypto";
import type { SqlClient, SqlPool } from "./mining-local-content-postgres-security.js";
import type {
  SimandouAuditAction,
  SimandouAuditEvent,
  SimandouAuditSink,
} from "./simandou-value-capture-service.js";

export type PersistedSimandouAuditEvent = SimandouAuditEvent & Readonly<{
  previousHash: string | null;
  eventHash: string;
}>;

type AuditRow = Readonly<{
  id: unknown;
  tenant_id: unknown;
  project_id: unknown;
  actor_identity_id: unknown;
  actor_kind: unknown;
  action: unknown;
  aggregate_id: unknown;
  correlation_id: unknown;
  payload: unknown;
  previous_hash: unknown;
  event_hash: unknown;
  occurred_at: unknown;
}>;

export class PostgresSimandouAuditSink implements SimandouAuditSink {
  constructor(private readonly pool: SqlPool) {}

  async append(event: SimandouAuditEvent): Promise<PersistedSimandouAuditEvent> {
    validateAuditEvent(event);
    return withTenantTransaction(this.pool, event.tenantId, async (client) => {
      await client.query(
        "select pg_advisory_xact_lock(hashtext($1), hashtext($2))",
        [event.tenantId, event.projectId],
      );
      const previous = await client.query(
        `select event_hash
         from local_content_audit_events
         where tenant_id = $1 and project_id = $2
         order by occurred_at desc, id desc
         limit 1`,
        [event.tenantId, event.projectId],
      );
      const previousHash = previous.rows[0] === undefined
        ? null
        : requireHash(previous.rows[0].event_hash, "previous event hash");
      const eventHash = hashEvent(event, previousHash);

      await client.query(
        `insert into local_content_audit_events (
           id, tenant_id, project_id, actor_identity_id, actor_kind, action,
           aggregate_id, correlation_id, payload, previous_hash, event_hash, occurred_at
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12::timestamptz)`,
        [
          event.id,
          event.tenantId,
          event.projectId,
          event.actorId,
          event.actorKind,
          event.action,
          event.aggregateId,
          event.correlationId,
          JSON.stringify(event.payload),
          previousHash,
          eventHash,
          event.occurredAt,
        ],
      );

      return Object.freeze({ ...event, previousHash, eventHash });
    });
  }

  async list(tenantId: string, projectId: string): Promise<readonly PersistedSimandouAuditEvent[]> {
    return withTenantTransaction(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `select id, tenant_id, project_id, actor_identity_id, actor_kind, action,
                aggregate_id, correlation_id, payload, previous_hash, event_hash, occurred_at
         from local_content_audit_events
         where tenant_id = $1 and project_id = $2
         order by occurred_at, id`,
        [tenantId, projectId],
      );
      return Object.freeze(result.rows.map((row) => mapAuditRow(row as AuditRow)));
    });
  }
}

async function withTenantTransaction<T>(
  pool: SqlPool,
  tenantId: string,
  work: (client: SqlClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let started = false;
  try {
    await client.query("begin");
    started = true;
    await client.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
    const value = await work(client);
    await client.query("commit");
    return value;
  } catch (error: unknown) {
    if (started) {
      try {
        await client.query("rollback");
      } catch {
        // Preserve the original failure.
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

function hashEvent(event: SimandouAuditEvent, previousHash: string | null): string {
  return createHash("sha256")
    .update(canonicalJson({
      id: event.id,
      tenantId: event.tenantId,
      projectId: event.projectId,
      actorId: event.actorId,
      actorKind: event.actorKind,
      action: event.action,
      aggregateId: event.aggregateId,
      correlationId: event.correlationId,
      payload: event.payload,
      occurredAt: new Date(event.occurredAt).toISOString(),
      previousHash,
    }))
    .digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  throw new Error("Audit payload contains a non-serializable value");
}

function validateAuditEvent(event: SimandouAuditEvent): void {
  for (const [label, value] of [
    ["audit id", event.id],
    ["tenant id", event.tenantId],
    ["project id", event.projectId],
    ["actor id", event.actorId],
    ["aggregate id", event.aggregateId],
    ["correlation id", event.correlationId],
  ] as const) {
    if (!value.trim()) throw new Error(`${label} is required`);
  }
  if (!Number.isFinite(Date.parse(event.occurredAt))) throw new Error("Audit timestamp is invalid");
  canonicalJson(event.payload);
}

function mapAuditRow(row: AuditRow): PersistedSimandouAuditEvent {
  const payload = row.payload;
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("Stored audit payload is invalid");
  }
  const actorKind = requireString(row.actor_kind, "actor kind");
  if (actorKind !== "HUMAN" && actorKind !== "AGENT" && actorKind !== "SERVICE") {
    throw new Error("Stored audit actor kind is invalid");
  }
  const action = requireString(row.action, "action");
  if (!isAuditAction(action)) throw new Error("Stored Simandou audit action is invalid");
  return Object.freeze({
    id: requireString(row.id, "id"),
    tenantId: requireString(row.tenant_id, "tenant id"),
    projectId: requireString(row.project_id, "project id"),
    actorId: requireString(row.actor_identity_id, "actor id"),
    actorKind,
    action,
    aggregateId: requireString(row.aggregate_id, "aggregate id"),
    correlationId: requireString(row.correlation_id, "correlation id"),
    payload: Object.freeze({ ...(payload as Record<string, unknown>) }),
    occurredAt: requireInstant(row.occurred_at),
    previousHash: row.previous_hash === null ? null : requireHash(row.previous_hash, "previous hash"),
    eventHash: requireHash(row.event_hash, "event hash"),
  });
}

function isAuditAction(value: string): value is SimandouAuditAction {
  return value === "REGISTER_ORE_LOT"
    || value === "RECORD_VALUE_CAPTURE_COMPONENT"
    || value === "RECORD_RECONCILIATION_EXCEPTION";
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Stored audit ${label} is invalid`);
  return value;
}

function requireHash(value: unknown, label: string): string {
  const hash = requireString(value, label);
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error(`Stored audit ${label} is invalid`);
  return hash;
}

function requireInstant(value: unknown): string {
  const text = value instanceof Date ? value.toISOString() : typeof value === "string" ? value : "";
  if (!Number.isFinite(Date.parse(text))) throw new Error("Stored audit timestamp is invalid");
  return new Date(text).toISOString();
}
