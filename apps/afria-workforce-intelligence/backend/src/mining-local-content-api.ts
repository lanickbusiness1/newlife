import { randomUUID } from "node:crypto";
import type { EmployeeState, EvidenceRef, Identity, Tenant } from "./domain.js";
import { ControlError } from "./living-core.js";
import {
  LocalContentRule,
  MiningWorkforceRecord,
  SuccessionPlan,
  type ApprovalEvidenceRef,
  type LegalSourceRef,
  type NationalityStatus,
  type WorkforceCategory,
} from "./mining-local-content.js";
import type { MiningLocalContentService } from "./mining-local-content-service.js";

export type AuthContext = Readonly<{
  tenant: Tenant;
  actor: Identity;
}>;

export interface AuthContextResolver {
  resolve(request: Request): AuthContext | undefined;
}

export class InMemoryAuthContextResolver implements AuthContextResolver {
  private readonly tenants = new Map<string, Tenant>();
  private readonly actors = new Map<string, Identity>();

  constructor(tenants: readonly Tenant[], actors: readonly Identity[]) {
    for (const tenant of tenants) this.tenants.set(tenant.id, tenant);
    for (const actor of actors) this.actors.set(contextKey(actor.tenantId, actor.id), actor);
  }

  resolve(request: Request): AuthContext | undefined {
    const tenantId = request.headers.get("x-tenant-id");
    const actorId = request.headers.get("x-actor-id");
    if (!tenantId || !actorId) return undefined;
    const tenant = this.tenants.get(tenantId);
    const actor = this.actors.get(contextKey(tenantId, actorId));
    if (!tenant || !actor) return undefined;
    return Object.freeze({ tenant, actor });
  }
}

export type MiningLocalContentApiConfig = Readonly<{
  service: MiningLocalContentService;
  auth: AuthContextResolver;
  maxBodyBytes?: number;
}>;

export type MiningLocalContentApi = (request: Request) => Promise<Response>;

export function createMiningLocalContentApi(config: MiningLocalContentApiConfig): MiningLocalContentApi {
  const maxBodyBytes = config.maxBodyBytes ?? 1_048_576;
  if (!Number.isInteger(maxBodyBytes) || maxBodyBytes <= 0) {
    throw new Error("maxBodyBytes must be a positive integer");
  }

  return async (request: Request): Promise<Response> => {
    const correlationId = request.headers.get("x-correlation-id")?.trim() || randomUUID();
    try {
      const url = new URL(request.url);
      const path = normalizePath(url.pathname);

      if (request.method === "GET" && path === "/health") {
        return jsonResponse({ status: "healthy", module: "MODULE-06" }, 200, correlationId);
      }

      const context = config.auth.resolve(request);
      if (!context) {
        throw new ApiFault(401, "AUTHENTICATION_REQUIRED", "Trusted tenant and actor context is required");
      }

      if (request.method === "POST" && path === "/v1/rules") {
        const body = await readJsonObject(request, maxBodyBytes);
        const rule = buildRule(body, context.tenant.id);
        return jsonResponse(
          config.service.registerRuleDraft({ ...context, rule }),
          201,
          correlationId,
        );
      }

      const validateRuleMatch = /^\/v1\/rules\/([^/]+)\/validate$/.exec(path);
      if (request.method === "POST" && validateRuleMatch) {
        const body = await readJsonObject(request, maxBodyBytes);
        const proofBody = requireObject(body.proof, "proof");
        const proof = buildApprovalEvidence(
          proofBody,
          context.tenant.id,
          "LEGAL_RULE_APPROVAL",
        );
        return jsonResponse(
          config.service.validateRule({
            ...context,
            ruleId: decodePathId(validateRuleMatch[1]),
            proof,
          }),
          200,
          correlationId,
        );
      }

      if (request.method === "POST" && path === "/v1/workforce/batch") {
        const body = await readJsonObject(request, maxBodyBytes);
        const rawRecords = requireArray(body.records, "records");
        const records = rawRecords.map((record, index) =>
          buildWorkforceRecord(requireObject(record, `records[${index}]`), context.tenant.id),
        );
        const accepted = config.service.ingestWorkforceRecords({ ...context, records });
        return jsonResponse({ accepted: accepted.length }, 202, correlationId);
      }

      if (request.method === "POST" && path === "/v1/assessments") {
        const body = await readJsonObject(request, maxBodyBytes);
        return jsonResponse(
          config.service.runAssessment({
            ...context,
            ruleId: requireString(body.ruleId, "ruleId"),
            asOf: requireString(body.asOf, "asOf"),
          }),
          200,
          correlationId,
        );
      }

      if (request.method === "POST" && path === "/v1/succession-plans") {
        const body = await readJsonObject(request, maxBodyBytes);
        const plan = buildSuccessionPlan(body, context.tenant.id);
        return jsonResponse(
          config.service.createSuccessionPlan({ ...context, plan }),
          201,
          correlationId,
        );
      }

      const approvePlanMatch = /^\/v1\/succession-plans\/([^/]+)\/approve$/.exec(path);
      if (request.method === "POST" && approvePlanMatch) {
        const body = await readJsonObject(request, maxBodyBytes);
        const proofBody = requireObject(body.proof, "proof");
        const proof = buildApprovalEvidence(
          proofBody,
          context.tenant.id,
          "SUCCESSION_PLAN_APPROVAL",
        );
        return jsonResponse(
          config.service.approveSuccessionPlan({
            ...context,
            planId: decodePathId(approvePlanMatch[1]),
            proof,
          }),
          200,
          correlationId,
        );
      }

      if (request.method === "GET" && path === "/v1/mission-control") {
        return jsonResponse(config.service.missionControlSnapshot(context), 200, correlationId);
      }

      if (request.method === "GET" && path === "/v1/audit-trail") {
        return jsonResponse(config.service.auditTrail(context), 200, correlationId);
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
  ) {
    super(message);
    this.name = "ApiFault";
  }
}

async function readJsonObject(request: Request, maxBodyBytes: number): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new ApiFault(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type application/json is required");
  }
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (!Number.isFinite(length) || length < 0) {
      throw new ApiFault(400, "INVALID_REQUEST", "Content-Length is invalid");
    }
    if (length > maxBodyBytes) {
      throw new ApiFault(413, "PAYLOAD_TOO_LARGE", "Request body exceeds the configured limit");
    }
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBodyBytes) {
    throw new ApiFault(413, "PAYLOAD_TOO_LARGE", "Request body exceeds the configured limit");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiFault(400, "INVALID_REQUEST", "Request body must contain valid JSON");
  }
  return requireObject(parsed, "body");
}

function buildRule(body: Record<string, unknown>, tenantId: string): LocalContentRule {
  return new LocalContentRule(
    requireString(body.id, "id"),
    tenantId,
    requireString(body.projectId, "projectId"),
    requireCategory(body.category, true),
    requireNumber(body.thresholdPercent, "thresholdPercent"),
    buildLegalSource(requireObject(body.source, "source")),
  );
}

function buildLegalSource(body: Record<string, unknown>): LegalSourceRef {
  const base = {
    id: requireString(body.id, "source.id"),
    title: requireString(body.title, "source.title"),
    url: requireString(body.url, "source.url"),
    jurisdiction: requireString(body.jurisdiction, "source.jurisdiction"),
    version: requireString(body.version, "source.version"),
    effectiveFrom: requireString(body.effectiveFrom, "source.effectiveFrom"),
    sha256: requireString(body.sha256, "source.sha256"),
  };
  const effectiveTo = optionalString(body.effectiveTo, "source.effectiveTo");
  return effectiveTo === undefined ? base : { ...base, effectiveTo };
}

function buildApprovalEvidence(
  body: Record<string, unknown>,
  tenantId: string,
  expectedKind: "LEGAL_RULE_APPROVAL" | "SUCCESSION_PLAN_APPROVAL",
): ApprovalEvidenceRef {
  const kind = requireString(body.kind, "proof.kind");
  if (kind !== expectedKind) throw new Error(`proof.kind must be ${expectedKind}`);
  return {
    id: requireString(body.id, "proof.id"),
    tenantId,
    kind,
    createdAt: requireString(body.createdAt, "proof.createdAt"),
    sha256: requireString(body.sha256, "proof.sha256"),
  };
}

function buildWorkforceRecord(
  body: Record<string, unknown>,
  tenantId: string,
): MiningWorkforceRecord {
  return new MiningWorkforceRecord(
    requireString(body.id, "record.id"),
    tenantId,
    requireString(body.projectId, "record.projectId"),
    requireString(body.employeeId, "record.employeeId"),
    requireString(body.roleId, "record.roleId"),
    requireCategory(body.category, false),
    requireNationalityStatus(body.nationalityStatus),
    requireNumber(body.monthlyCostUsd, "record.monthlyCostUsd"),
    requireEmployeeState(body.state),
    optionalArray(body.evidence, "record.evidence").map((evidence, index) =>
      buildEvidence(requireObject(evidence, `record.evidence[${index}]`)),
    ),
  );
}

function buildEvidence(body: Record<string, unknown>): EvidenceRef {
  return Object.freeze({
    id: requireString(body.id, "evidence.id"),
    kind: requireString(body.kind, "evidence.kind"),
    createdAt: requireString(body.createdAt, "evidence.createdAt"),
  });
}

function buildSuccessionPlan(body: Record<string, unknown>, tenantId: string): SuccessionPlan {
  return new SuccessionPlan(
    requireString(body.id, "id"),
    tenantId,
    requireString(body.projectId, "projectId"),
    requireString(body.expatriateWorkforceRecordId, "expatriateWorkforceRecordId"),
    requireString(body.nationalCandidateEmployeeId, "nationalCandidateEmployeeId"),
    requireStringArray(body.requiredSkills, "requiredSkills"),
    requireStringArray(body.candidateSkills, "candidateSkills"),
    requireString(body.targetDate, "targetDate"),
  );
}

function requireCategory(value: unknown, allowAll: true): WorkforceCategory | "ALL";
function requireCategory(value: unknown, allowAll: false): WorkforceCategory;
function requireCategory(value: unknown, allowAll: boolean): WorkforceCategory | "ALL" {
  const category = requireString(value, "category");
  const allowed = ["UNSKILLED", "SKILLED", "MIDDLE_MANAGEMENT", "SENIOR_MANAGEMENT"] as const;
  if (allowed.includes(category as WorkforceCategory)) return category as WorkforceCategory;
  if (allowAll && category === "ALL") return "ALL";
  throw new Error("category is invalid");
}

function requireNationalityStatus(value: unknown): NationalityStatus {
  const status = requireString(value, "nationalityStatus");
  if (status === "NATIONAL" || status === "EXPATRIATE") return status;
  throw new Error("nationalityStatus is invalid");
}

function requireEmployeeState(value: unknown): EmployeeState {
  const state = requireString(value, "state");
  if (["DRAFT", "ACTIVE", "SUSPENDED", "EXITED"].includes(state)) return state as EmployeeState;
  throw new Error("state is invalid");
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function optionalArray(value: unknown, label: string): unknown[] {
  return value === undefined ? [] : requireArray(value, label);
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function optionalString(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : requireString(value, label);
}

function requireStringArray(value: unknown, label: string): string[] {
  return requireArray(value, label).map((item, index) => requireString(item, `${label}[${index}]`));
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return value;
}

function normalizePath(path: string): string {
  if (path === "/") return path;
  return path.replace(/\/+$/, "") || "/";
}

function decodePathId(value: string | undefined): string {
  if (!value) throw new Error("Path identifier is required");
  try {
    return requireString(decodeURIComponent(value), "path id");
  } catch {
    throw new Error("Path identifier is invalid");
  }
}

function errorResponse(error: unknown, correlationId: string): Response {
  if (error instanceof ApiFault) {
    return jsonResponse({ error: error.code, message: error.message }, error.status, correlationId);
  }
  if (error instanceof ControlError) {
    const message = error.message;
    if (/Tenant isolation|Required role/.test(message)) {
      return jsonResponse({ error: "FORBIDDEN", message }, 403, correlationId);
    }
    if (/not found/i.test(message)) {
      return jsonResponse({ error: "NOT_FOUND", message }, 404, correlationId);
    }
    if (/Duplicate/.test(message)) {
      return jsonResponse({ error: "CONFLICT", message }, 409, correlationId);
    }
    return jsonResponse({ error: "CONTROL_REJECTED", message }, 409, correlationId);
  }
  if (error instanceof Error) {
    return jsonResponse({ error: "INVALID_REQUEST", message: error.message }, 400, correlationId);
  }
  return jsonResponse({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" }, 500, correlationId);
}

function jsonResponse(payload: unknown, status: number, correlationId: string): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-correlation-id": correlationId,
    },
  });
}

function contextKey(tenantId: string, actorId: string): string {
  return `${tenantId}:${actorId}`;
}
