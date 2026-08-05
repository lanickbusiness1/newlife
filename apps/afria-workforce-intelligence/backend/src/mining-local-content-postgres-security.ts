import type {
  ApiRequestGuard,
  AuthContext,
  GuardDecision,
  IdempotencyRecord,
  IdempotencyStore,
  PendingIdempotencyRecord,
} from "./mining-local-content-api.js";

export type SqlQueryResult = Readonly<{
  rows: readonly Record<string, unknown>[];
  rowCount: number | null;
}>;

export interface SqlClient {
  query(text: string, values?: unknown[]): Promise<SqlQueryResult>;
  release(): void;
}

export interface SqlPool {
  connect(): Promise<SqlClient>;
}

type IdempotencyScope = Readonly<{
  tenantId: string;
  actorIdentityId: string;
  httpMethod: "POST" | "PUT" | "PATCH" | "DELETE";
  route: string;
  idempotencyKey: string;
}>;

export class PostgresIdempotencyStore implements IdempotencyStore {
  constructor(
    private readonly pool: SqlPool,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async get(scopeKey: string): Promise<IdempotencyRecord | undefined> {
    const scope = parseScopeKey(scopeKey);
    const now = requireInstant(this.now(), "Idempotency clock returned an invalid timestamp");

    return await withTenantTransaction(this.pool, scope.tenantId, async (client) => {
      await client.query(
        `delete from local_content_idempotency_keys
         where tenant_id = $1
           and actor_identity_id = $2
           and http_method = $3
           and route = $4
           and idempotency_key = $5
           and expires_at <= $6::timestamptz`,
        [
          scope.tenantId,
          scope.actorIdentityId,
          scope.httpMethod,
          scope.route,
          scope.idempotencyKey,
          now,
        ],
      );

      const result = await client.query(
        `select request_sha256, response_status, response_headers, response_body,
                created_at, expires_at
         from local_content_idempotency_keys
         where tenant_id = $1
           and actor_identity_id = $2
           and http_method = $3
           and route = $4
           and idempotency_key = $5`,
        [
          scope.tenantId,
          scope.actorIdentityId,
          scope.httpMethod,
          scope.route,
          scope.idempotencyKey,
        ],
      );

      const row = result.rows[0];
      return row === undefined ? undefined : mapIdempotencyRecord(row);
    });
  }

  async put(
    scopeKey: string,
    record: PendingIdempotencyRecord,
    ttlSeconds: number,
  ): Promise<IdempotencyRecord> {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error("Idempotency TTL must be a positive integer");
    }
    const scope = parseScopeKey(scopeKey);
    const createdAt = requireInstant(this.now(), "Idempotency clock returned an invalid timestamp");
    const expiresAt = new Date(Date.parse(createdAt) + ttlSeconds * 1_000).toISOString();

    return await withTenantTransaction(this.pool, scope.tenantId, async (client) => {
      const result = await client.query(
        `insert into local_content_idempotency_keys (
           tenant_id, actor_identity_id, http_method, route, idempotency_key,
           request_sha256, response_status, response_headers, response_body,
           created_at, expires_at
         ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::timestamptz, $11::timestamptz)
         on conflict (tenant_id, actor_identity_id, http_method, route, idempotency_key)
         do update set
           response_status = excluded.response_status,
           response_headers = excluded.response_headers,
           response_body = excluded.response_body,
           expires_at = excluded.expires_at
         where local_content_idempotency_keys.request_sha256 = excluded.request_sha256
         returning request_sha256, response_status, response_headers, response_body,
                   created_at, expires_at`,
        [
          scope.tenantId,
          scope.actorIdentityId,
          scope.httpMethod,
          scope.route,
          scope.idempotencyKey,
          record.requestHash,
          record.responseStatus,
          JSON.stringify(record.responseHeaders),
          record.responseBody,
          createdAt,
          expiresAt,
        ],
      );

      const row = result.rows[0];
      if (row === undefined) throw new Error("Idempotency key conflict");
      return mapIdempotencyRecord(row);
    });
  }
}

export class PostgresEmergencyStopGuard implements ApiRequestGuard {
  constructor(private readonly pool: SqlPool) {}

  async evaluate(input: Readonly<{
    context: AuthContext;
    request: Request;
    path: string;
  }>): Promise<GuardDecision> {
    try {
      const result = await withTenantTransaction(
        this.pool,
        input.context.tenant.id,
        async (client) => await client.query(
          `select module_enabled, emergency_stop
           from local_content_module_controls
           where tenant_id = $1`,
          [input.context.tenant.id],
        ),
      );

      const row = result.rows[0];
      if (row === undefined) return Object.freeze({ allowed: true });
      const moduleEnabled = requireBoolean(row.module_enabled, "module_enabled");
      const emergencyStop = requireBoolean(row.emergency_stop, "emergency_stop");
      if (moduleEnabled && !emergencyStop) return Object.freeze({ allowed: true });

      return Object.freeze({
        allowed: false,
        status: 503,
        code: "MODULE_EMERGENCY_STOP",
        message: "MODULE 06 is suspended for this tenant",
      });
    } catch {
      return Object.freeze({
        allowed: false,
        status: 503,
        code: "EMERGENCY_CONTROL_UNAVAILABLE",
        message: "Emergency control is temporarily unavailable",
      });
    }
  }
}

async function withTenantTransaction<T>(
  pool: SqlPool,
  tenantId: string,
  work: (client: SqlClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query("begin");
    transactionStarted = true;
    await client.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error: unknown) {
    if (transactionStarted) {
      try {
        await client.query("rollback");
      } catch {
        // Preserve the original error.
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

function parseScopeKey(scopeKey: string): IdempotencyScope {
  const parts = scopeKey.split(":");
  if (parts.length < 5) throw new Error("Idempotency scope key is invalid");
  const tenantId = parts.shift();
  const actorIdentityId = parts.shift();
  const httpMethod = parts.shift();
  const route = parts.shift();
  const idempotencyKey = parts.join(":");

  if (!tenantId || !actorIdentityId || !route || !idempotencyKey) {
    throw new Error("Idempotency scope key is invalid");
  }
  if (httpMethod !== "POST" && httpMethod !== "PUT" && httpMethod !== "PATCH" && httpMethod !== "DELETE") {
    throw new Error("Idempotency HTTP method is invalid");
  }

  return Object.freeze({ tenantId, actorIdentityId, httpMethod, route, idempotencyKey });
}

function mapIdempotencyRecord(row: Record<string, unknown>): IdempotencyRecord {
  const headers = row.response_headers;
  if (typeof headers !== "object" || headers === null || Array.isArray(headers)) {
    throw new Error("Stored idempotency headers are invalid");
  }
  return Object.freeze({
    requestHash: requireString(row.request_sha256, "request_sha256"),
    responseStatus: requireInteger(row.response_status, "response_status"),
    responseHeaders: Object.freeze({ ...(headers as Record<string, string>) }),
    responseBody: requireString(row.response_body, "response_body", true),
    createdAt: requireInstant(row.created_at, "Stored idempotency created_at is invalid"),
    expiresAt: requireInstant(row.expires_at, "Stored idempotency expires_at is invalid"),
  });
}

function requireString(value: unknown, field: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) {
    throw new Error(`Stored ${field} is invalid`);
  }
  return value;
}

function requireInteger(value: unknown, field: string): number {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (typeof numeric !== "number" || !Number.isInteger(numeric)) {
    throw new Error(`Stored ${field} is invalid`);
  }
  return numeric;
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new Error(`Stored ${field} is invalid`);
  return value;
}

function requireInstant(value: unknown, message: string): string {
  const text = value instanceof Date ? value.toISOString() : typeof value === "string" ? value : "";
  if (!Number.isFinite(Date.parse(text))) throw new Error(message);
  return new Date(text).toISOString();
}
