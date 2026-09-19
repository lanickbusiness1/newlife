import { createHmac, timingSafeEqual } from "node:crypto";

export type McpTransportClaims = {
  tenantId: string;
  actorId: string;
  agentId: string;
  permissionScope: string[];
  expiresAt: number;
};

export type McpVerifiedPrincipal = Readonly<McpTransportClaims>;

type CallerContext = {
  tenantId: string;
  actorId: string;
  agentId: string;
  correlationId: string;
  purpose: string;
  permissionScope: string[];
  dataClassification: "public" | "internal" | "confidential" | "restricted";
  approvalContext?: string;
};

function requireSecret(secret: string): string {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("MCP_TRANSPORT_AUTH_UNAVAILABLE");
  }
  return secret;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeClaims(value: unknown): McpTransportClaims {
  if (!value || typeof value !== "object") throw new Error("MCP_TRANSPORT_AUTH_INVALID");
  const raw = value as Partial<McpTransportClaims>;
  if (!nonEmpty(raw.tenantId) || !nonEmpty(raw.actorId) || !nonEmpty(raw.agentId)) {
    throw new Error("MCP_TRANSPORT_AUTH_INVALID");
  }
  if (!Array.isArray(raw.permissionScope) || !raw.permissionScope.every(nonEmpty)) {
    throw new Error("MCP_TRANSPORT_AUTH_INVALID");
  }
  if (!Number.isSafeInteger(raw.expiresAt) || (raw.expiresAt ?? 0) <= 0) {
    throw new Error("MCP_TRANSPORT_AUTH_INVALID");
  }
  return {
    tenantId: raw.tenantId.trim(),
    actorId: raw.actorId.trim(),
    agentId: raw.agentId.trim(),
    permissionScope: [...new Set(raw.permissionScope.map(scope => scope.trim()))].sort(),
    expiresAt: raw.expiresAt!
  };
}

function signPayload(payload: string, secret: string): Buffer {
  return createHmac("sha256", requireSecret(secret)).update(payload).digest();
}

export function issueMcpTransportToken(claims: McpTransportClaims, secret: string): string {
  const normalized = normalizeClaims(claims);
  const payload = Buffer.from(JSON.stringify(normalized), "utf8").toString("base64url");
  const signature = signPayload(payload, secret).toString("base64url");
  return `${payload}.${signature}`;
}

export function verifyMcpTransportBearer(
  authorizationHeader: string | undefined,
  secret: string,
  nowEpochSeconds = Math.floor(Date.now() / 1000)
): McpVerifiedPrincipal {
  requireSecret(secret);
  if (!nonEmpty(authorizationHeader) || !authorizationHeader.startsWith("Bearer ")) {
    throw new Error("MCP_TRANSPORT_AUTH_REQUIRED");
  }
  const token = authorizationHeader.slice("Bearer ".length).trim();
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error("MCP_TRANSPORT_AUTH_INVALID");
  const [payload, encodedSignature] = parts;

  let actual: Buffer;
  try {
    actual = Buffer.from(encodedSignature, "base64url");
  } catch {
    throw new Error("MCP_TRANSPORT_AUTH_INVALID");
  }
  const expected = signPayload(payload, secret);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("MCP_TRANSPORT_AUTH_INVALID");
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new Error("MCP_TRANSPORT_AUTH_INVALID");
  }
  const claims = normalizeClaims(decoded);
  if (claims.expiresAt <= nowEpochSeconds) throw new Error("MCP_TRANSPORT_AUTH_EXPIRED");
  return Object.freeze({ ...claims, permissionScope: Object.freeze([...claims.permissionScope]) as unknown as string[] });
}

export function bindVerifiedPrincipalToContext<T extends CallerContext>(
  principal: McpVerifiedPrincipal,
  callerContext: T
): T {
  if (
    callerContext.tenantId !== principal.tenantId
    || callerContext.actorId !== principal.actorId
    || callerContext.agentId !== principal.agentId
  ) {
    throw new Error("MCP_CONTEXT_IDENTITY_MISMATCH");
  }
  return {
    ...callerContext,
    tenantId: principal.tenantId,
    actorId: principal.actorId,
    agentId: principal.agentId,
    permissionScope: [...principal.permissionScope]
  };
}
