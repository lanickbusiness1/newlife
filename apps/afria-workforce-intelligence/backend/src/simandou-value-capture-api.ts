import { createHash, randomUUID } from "node:crypto";
import type {
  ApiRequestGuard,
  AuthContext,
  AuthContextResolver,
  IdempotencyRecord,
  IdempotencyStore,
  PendingIdempotencyRecord,
} from "./mining-local-content-api.js";
import { ControlError } from "./living-core.js";
import {
  OreLot,
  ValueCaptureComponent,
  type EconomicValueBucket,
  type EvidenceLink,
  type TruthClass,
} from "./simandou-value-capture.js";
import type { SimandouValueCaptureCommandService } from "./simandou-value-capture-service.js";

export type SimandouValueCaptureApiConfig = Readonly<{
  service: SimandouValueCaptureCommandService;
  auth: AuthContextResolver;
  maxBodyBytes?: number;
  guards?: readonly ApiRequestGuard[];
  idempotency?: Readonly<{
    store: IdempotencyStore;
    requireForMutations?: boolean;
    ttlSeconds: number;
  }>;
}>;

export type SimandouValueCaptureApi = (request: Request) => Promise<Response>;

type PreparedIdempotency = Readonly<{
  scopeKey: string;
  requestHash: string;
  store: IdempotencyStore;
  ttlSeconds: number;
}>;

export function createSimandouValueCaptureApi(config: SimandouValueCaptureApiConfig): SimandouValueCaptureApi {
  const maxBodyBytes = config.maxBodyBytes ?? 1_048_576;
  if (!Number.isInteger(maxBodyBytes) || maxBodyBytes <= 0) throw new Error("maxBodyBytes must be a positive integer");
  if (config.idempotency !== undefined && (!Number.isInteger(config.idempotency.ttlSeconds) || config.idempotency.ttlSeconds <= 0)) {
    throw new Error("Idempotency ttlSeconds must be a positive integer");
  }

  return async (request: Request): Promise<Response> => {
    const correlationId = request.headers.get("x-correlation-id")?.trim() || randomUUID();
    try {
      const path = normalizePath(new URL(request.url).pathname);
      if (request.method === "GET" && path === "/health") {
        return jsonResponse(
          { status: "healthy", module: "SIMANDOU_VALUE_CAPTURE_V1", environment: "SYNTHETIC_SANDBOX" },
          200,
          correlationId,
        );
      }

      const context = await config.auth.resolve(request);
      if (!context) throw new ApiFault(401, "AUTHENTICATION_REQUIRED", "Verified tenant and actor context is required");

      for (const guard of config.guards ?? []) {
        const decision = await guard.evaluate({ context, request, path });
        if (!decision.allowed) {
          const headers = decision.retryAfterSeconds === undefined ? undefined : { "retry-after": String(decision.retryAfterSeconds) };
          throw new ApiFault(decision.status, decision.code, decision.message, headers);
        }
      }

      const prepared = await prepareIdempotency(request, path, context, config.idempotency, maxBodyBytes);
      if (prepared.replay !== undefined) return replayResponse(prepared.replay, correlationId);
      const respond = async (response: Response): Promise<Response> =>
        finalizeIdempotency(response, prepared.context, correlationId);

      if (request.method === "POST" && path === "/v1/simandou/ore-lots") {
        const body = await readJsonObject(request, maxBodyBytes);
        rejectBodyTenantAuthority(body);
        const lot = buildOreLot(body, context.tenant.id);
        const result = await config.service.registerOreLot({
          ...context,
          lot,
          correlationId,
        });
        return await respond(jsonResponse({
          id: result.id,
          projectId: result.projectId,
          tonnage: result.tonnage,
          gradeFePercent: result.gradeFePercent,
          extractedAt: result.extractedAt,
          version: result.version,
        }, 201, correlationId));
      }

      if (request.method === "POST" && path === "/v1/simandou/value-components") {
        const body = await readJsonObject(request, maxBodyBytes);
        rejectBodyTenantAuthority(body);
        const component = buildValueCaptureComponent(body, context.tenant.id);
        const result = await config.service.recordValueCaptureComponent({
          ...context,
          component,
          correlationId,
        });
        return await respond(jsonResponse({
          id: result.id,
          projectId: result.projectId,
          bucket: result.bucket,
          amount: result.amount,
          currency: result.currency,
          truthClass: result.truthClass,
          version: result.version,
        }, 201, correlationId));
      }

      throw new ApiFault(404, "NOT_FOUND", "API route not found");
    } catch (error: unknown) {
      return errorResponse(error, correlationId);
    }
  };
}

class ApiFault extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly headers?: Readonly<Record<string, string>>,
  ) {
    super(message);
    this.name = "ApiFault";
  }
}

async function prepareIdempotency(
  request: Request,
  path: string,
  context: AuthContext,
  config: SimandouValueCaptureApiConfig["idempotency"],
  maxBodyBytes: number,
): Promise<Readonly<{ context?: PreparedIdempotency; replay?: IdempotencyRecord }>> {
  if (config === undefined || !isMutation(request.method)) return Object.freeze({});

  const key = request.headers.get("idempotency-key")?.trim();
  if (!key) {
    if (config.requireForMutations === true) {
      throw new ApiFault(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required for mutating requests");
    }
    return Object.freeze({});
  }
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(key)) {
    throw new ApiFault(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key format is invalid");
  }

  const bodyText = await readBodyText(request.clone(), maxBodyBytes);
  const requestHash = createHash("sha256")
    .update([request.method.toUpperCase(), path, bodyText].join("\n"))
    .digest("hex");
  const scopeKey = [context.tenant.id, context.actor.id, request.method.toUpperCase(), path, key].join(":");

  let existing: IdempotencyRecord | undefined;
  try {
    existing = await config.store.get(scopeKey);
  } catch {
    throw new ApiFault(503, "IDEMPOTENCY_STORE_UNAVAILABLE", "Idempotency control is temporarily unavailable");
  }
  if (existing !== undefined) {
    if (existing.requestHash !== requestHash) {
      throw new ApiFault(409, "IDEMPOTENCY_CONFLICT", "Idempotency-Key was already used with a different request");
    }
    return Object.freeze({ replay: existing });
  }

  return Object.freeze({
    context: Object.freeze({ scopeKey, requestHash, store: config.store, ttlSeconds: config.ttlSeconds }),
  });
}

async function finalizeIdempotency(
  response: Response,
  prepared: PreparedIdempotency | undefined,
  correlationId: string,
): Promise<Response> {
  if (prepared === undefined || response.status < 200 || response.status >= 300) return response;
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    if (key !== "x-correlation-id" && key !== "x-idempotent-replay") responseHeaders[key] = value;
  });
  const record: PendingIdempotencyRecord = Object.freeze({
    requestHash: prepared.requestHash,
    responseStatus: response.status,
    responseHeaders: Object.freeze(responseHeaders),
    responseBody: await response.clone().text(),
  });
  try {
    await prepared.store.put(prepared.scopeKey, record, prepared.ttlSeconds);
  } catch {
    throw new ApiFault(503, "IDEMPOTENCY_STORE_UNAVAILABLE", "Idempotency control is temporarily unavailable");
  }
  return withCorrelationId(response, correlationId);
}

function replayResponse(record: IdempotencyRecord, correlationId: string): Response {
  return new Response(record.responseBody, {
    status: record.responseStatus,
    headers: {
      ...record.responseHeaders,
      "x-correlation-id": correlationId,
      "x-idempotent-replay": "true",
    },
  });
}

function buildOreLot(body: Record<string, unknown>, tenantId: string): OreLot {
  return new OreLot(
    requireString(body.id, "id"),
    tenantId,
    requireString(body.projectId, "projectId"),
    requireNumber(body.tonnage, "tonnage"),
    requireNumber(body.gradeFePercent, "gradeFePercent"),
    requireString(body.extractedAt, "extractedAt"),
    buildEvidenceArray(body.evidence),
  );
}

function buildValueCaptureComponent(body: Record<string, unknown>, tenantId: string): ValueCaptureComponent {
  return new ValueCaptureComponent(
    requireString(body.id, "id"),
    tenantId,
    requireString(body.projectId, "projectId"),
    requireEconomicValueBucket(body.bucket),
    requireNumber(body.amount, "amount"),
    requireString(body.currency, "currency"),
    requireString(body.sourceTransactionId, "sourceTransactionId"),
    buildEvidenceArray(body.evidence),
    optionalTruthClass(body.truthClass) ?? "FACT",
  );
}

function buildEvidenceArray(value: unknown): EvidenceLink[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("evidence must be a non-empty array");
  return value.map((item, index) => {
    const body = requireObject(item, `evidence[${index}]`);
    return Object.freeze({
      evidenceId: requireString(body.evidenceId, `evidence[${index}].evidenceId`),
      source: requireString(body.source, `evidence[${index}].source`),
      sha256: requireString(body.sha256, `evidence[${index}].sha256`),
      observedAt: requireString(body.observedAt, `evidence[${index}].observedAt`),
      truthClass: requireTruthClass(body.truthClass),
    });
  });
}

function rejectBodyTenantAuthority(body: Record<string, unknown>): void {
  if (Object.prototype.hasOwnProperty.call(body, "tenantId") || Object.prototype.hasOwnProperty.call(body, "tenant_id")) {
    throw new ApiFault(400, "TENANT_BODY_FORBIDDEN", "Tenant authority must come from verified identity context, never request body");
  }
}

async function readJsonObject(request: Request, maxBodyBytes: number): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new ApiFault(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type application/json is required");
  const text = await readBodyText(request, maxBodyBytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiFault(400, "INVALID_REQUEST", "Request body must contain valid JSON");
  }
  return requireObject(parsed, "body");
}

async function readBodyText(request: Request, maxBodyBytes: number): Promise<string> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (!Number.isFinite(length) || length < 0) throw new ApiFault(400, "INVALID_REQUEST", "Content-Length is invalid");
    if (length > maxBodyBytes) throw new ApiFault(413, "PAYLOAD_TOO_LARGE", "Request body exceeds the configured limit");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBodyBytes) {
    throw new ApiFault(413, "PAYLOAD_TOO_LARGE", "Request body exceeds the configured limit");
  }
  return text;
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return value;
}

function requireTruthClass(value: unknown): TruthClass {
  const truthClass = requireString(value, "truthClass");
  if (truthClass === "FACT" || truthClass === "HYPOTHESIS" || truthClass === "SIMULATION") return truthClass;
  throw new Error("truthClass is invalid");
}

function optionalTruthClass(value: unknown): TruthClass | undefined {
  return value === undefined ? undefined : requireTruthClass(value);
}

function requireEconomicValueBucket(value: unknown): EconomicValueBucket {
  const bucket = requireString(value, "bucket");
  const allowed: readonly EconomicValueBucket[] = [
    "PUBLIC_REVENUE",
    "STATE_EQUITY",
    "LOCAL_PAYROLL",
    "LOCAL_PROCUREMENT",
    "DOMESTIC_TRANSFORMATION",
    "FX_RETENTION",
  ];
  if (allowed.includes(bucket as EconomicValueBucket)) return bucket as EconomicValueBucket;
  throw new Error("bucket is invalid");
}

function normalizePath(path: string): string {
  if (path === "/") return path;
  return path.replace(/\/+$/, "") || "/";
}

function isMutation(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

function errorResponse(error: unknown, correlationId: string): Response {
  if (error instanceof ApiFault) {
    return jsonError(error.code, error.message, error.status, correlationId, error.headers);
  }
  if (error instanceof ControlError) {
    if (/Tenant isolation|Required role/.test(error.message)) {
      return jsonError("FORBIDDEN", error.message, 403, correlationId);
    }
    if (/not found/i.test(error.message)) return jsonError("NOT_FOUND", error.message, 404, correlationId);
    if (/Duplicate|double counting|conflict/i.test(error.message)) return jsonError("CONFLICT", error.message, 409, correlationId);
    return jsonError("CONTROL_REJECTED", error.message, 409, correlationId);
  }
  if (error instanceof Error) return jsonError("INVALID_REQUEST", error.message, 400, correlationId);
  return jsonError("INTERNAL_ERROR", "Unexpected server error", 500, correlationId);
}

function jsonError(
  code: string,
  message: string,
  status: number,
  correlationId: string,
  headers?: Readonly<Record<string, string>>,
): Response {
  return jsonResponse({ error: { code, message } }, status, correlationId, headers);
}

function jsonResponse(
  payload: unknown,
  status: number,
  correlationId: string,
  headers?: Readonly<Record<string, string>>,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-correlation-id": correlationId,
      ...headers,
    },
  });
}

function withCorrelationId(response: Response, correlationId: string): Response {
  const headers = new Headers(response.headers);
  headers.set("x-correlation-id", correlationId);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
