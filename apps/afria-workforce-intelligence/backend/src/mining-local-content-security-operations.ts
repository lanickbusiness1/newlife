import { createVerify, type KeyObject } from "node:crypto";
import { Identity, Tenant, type IdentityKind } from "./domain.js";
import type {
  ApiRequestGuard,
  AuthContext,
  AuthContextResolver,
  GuardDecision,
  IdempotencyRecord,
  IdempotencyStore,
  PendingIdempotencyRecord,
} from "./mining-local-content-api.js";

export type VerifiedAccessTokenClaims = Readonly<{
  tokenId: string;
  subject: string;
  tenantId: string;
  tenantName: string;
  jurisdiction: string;
  actorKind: IdentityKind;
  actorDisplayName: string;
  roles: readonly string[];
  issuedAt: string;
  expiresAt: string;
}>;

export interface AccessTokenVerifier {
  verify(token: string): Promise<VerifiedAccessTokenClaims | undefined>;
}

export interface JwtSigningKeyProvider {
  getKey(keyId: string): Promise<KeyObject | undefined>;
}

export type Rs256JwtVerifierConfig = Readonly<{
  issuer: string;
  audience: string;
  keyProvider: JwtSigningKeyProvider;
  nowSeconds?: () => number;
  clockSkewSeconds?: number;
}>;

export class Rs256JwtAccessTokenVerifier implements AccessTokenVerifier {
  private readonly nowSeconds: () => number;
  private readonly clockSkewSeconds: number;

  constructor(private readonly config: Rs256JwtVerifierConfig) {
    if (!config.issuer.trim() || !config.audience.trim()) {
      throw new Error("JWT issuer and audience are required");
    }
    const clockSkewSeconds = config.clockSkewSeconds ?? 60;
    if (!Number.isInteger(clockSkewSeconds) || clockSkewSeconds < 0 || clockSkewSeconds > 300) {
      throw new Error("JWT clockSkewSeconds must be an integer between 0 and 300");
    }
    this.clockSkewSeconds = clockSkewSeconds;
    this.nowSeconds = config.nowSeconds ?? (() => Math.floor(Date.now() / 1_000));
  }

  async verify(token: string): Promise<VerifiedAccessTokenClaims | undefined> {
    try {
      const segments = token.split(".");
      if (segments.length !== 3) return undefined;
      const [headerSegment, payloadSegment, signatureSegment] = segments;
      if (!headerSegment || !payloadSegment || !signatureSegment) return undefined;
      if (![headerSegment, payloadSegment, signatureSegment].every(isBase64Url)) return undefined;

      const header = parseJsonObject(headerSegment);
      if (header.alg !== "RS256") return undefined;
      if (header.typ !== undefined && header.typ !== "JWT") return undefined;
      const keyId = requiredClaimString(header.kid);
      if (!keyId) return undefined;

      const key = await this.config.keyProvider.getKey(keyId);
      if (!key) return undefined;
      const verifier = createVerify("RSA-SHA256");
      verifier.update(`${headerSegment}.${payloadSegment}`);
      verifier.end();
      const signature = Buffer.from(signatureSegment, "base64url");
      if (!verifier.verify(key, signature)) return undefined;

      const payload = parseJsonObject(payloadSegment);
      if (payload.iss !== this.config.issuer || !audienceContains(payload.aud, this.config.audience)) {
        return undefined;
      }

      const now = this.nowSeconds();
      if (!Number.isFinite(now)) return undefined;
      const issuedAt = requiredNumericDate(payload.iat);
      const expiresAt = requiredNumericDate(payload.exp);
      const notBefore = optionalNumericDate(payload.nbf);
      if (issuedAt === undefined || expiresAt === undefined) return undefined;
      if (issuedAt > now + this.clockSkewSeconds) return undefined;
      if (expiresAt <= now - this.clockSkewSeconds) return undefined;
      if (notBefore !== undefined && notBefore > now + this.clockSkewSeconds) return undefined;
      if (issuedAt >= expiresAt) return undefined;

      const tokenId = requiredClaimString(payload.jti);
      const subject = requiredClaimString(payload.sub);
      const tenantId = requiredClaimString(payload.tenant_id);
      const tenantName = requiredClaimString(payload.tenant_name);
      const jurisdiction = requiredClaimString(payload.jurisdiction);
      const actorDisplayName = requiredClaimString(payload.actor_display_name);
      const actorKind = parseIdentityKind(payload.actor_kind);
      const roles = parseRoles(payload.roles);
      if (!tokenId || !subject || !tenantId || !tenantName || !jurisdiction || !actorDisplayName || !actorKind || !roles) {
        return undefined;
      }

      return Object.freeze({
        tokenId,
        subject,
        tenantId,
        tenantName,
        jurisdiction,
        actorKind,
        actorDisplayName,
        roles: Object.freeze([...roles]),
        issuedAt: new Date(issuedAt * 1_000).toISOString(),
        expiresAt: new Date(expiresAt * 1_000).toISOString(),
      });
    } catch {
      return undefined;
    }
  }
}

export class BearerAuthContextResolver implements AuthContextResolver {
  constructor(
    private readonly verifier: AccessTokenVerifier,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async resolve(request: Request): Promise<AuthContext | undefined> {
    const authorization = request.headers.get("authorization");
    const match = /^Bearer\s+([^\s]+)$/i.exec(authorization ?? "");
    if (!match?.[1]) return undefined;

    const claims = await this.verifier.verify(match[1]);
    if (!claims) return undefined;
    if (!isValidInstant(claims.issuedAt) || !isValidInstant(claims.expiresAt)) return undefined;

    const now = Date.parse(this.now());
    const issuedAt = Date.parse(claims.issuedAt);
    const expiresAt = Date.parse(claims.expiresAt);
    if (!Number.isFinite(now) || issuedAt > now || expiresAt <= now || issuedAt >= expiresAt) return undefined;
    if (!claims.tokenId.trim() || !claims.subject.trim() || !claims.roles.length) return undefined;

    try {
      const tenant = new Tenant(
        claims.tenantId,
        claims.tenantId,
        claims.tenantName,
        claims.jurisdiction,
      );
      const actor = new Identity(
        claims.subject,
        claims.tenantId,
        claims.actorKind,
        claims.actorDisplayName,
        claims.roles,
      );
      return Object.freeze({ tenant, actor });
    } catch {
      return undefined;
    }
  }
}

export class InMemoryEmergencyStopGuard implements ApiRequestGuard {
  private readonly stoppedTenants = new Map<string, Readonly<{ reason: string; stoppedAt: string }>>();

  stopTenant(tenantId: string, reason: string, stoppedAt: string): void {
    if (!tenantId.trim() || !reason.trim() || !isValidInstant(stoppedAt)) {
      throw new Error("A tenant, reason and valid stop timestamp are required");
    }
    this.stoppedTenants.set(tenantId, Object.freeze({ reason, stoppedAt }));
  }

  resumeTenant(tenantId: string): void {
    this.stoppedTenants.delete(tenantId);
  }

  evaluate(input: { context: AuthContext }): GuardDecision {
    return this.stoppedTenants.has(input.context.tenant.id)
      ? Object.freeze({
          allowed: false,
          status: 503,
          code: "MODULE_EMERGENCY_STOP",
          message: "MODULE 06 is suspended for this tenant",
        })
      : Object.freeze({ allowed: true });
  }
}

export class InMemoryFixedWindowRateLimiter implements ApiRequestGuard {
  private readonly windows = new Map<string, { windowStart: number; count: number }>();

  constructor(
    private readonly config: Readonly<{
      maxRequests: number;
      windowMs: number;
      now?: () => number;
    }>,
  ) {
    if (!Number.isInteger(config.maxRequests) || config.maxRequests <= 0) {
      throw new Error("maxRequests must be a positive integer");
    }
    if (!Number.isInteger(config.windowMs) || config.windowMs <= 0) {
      throw new Error("windowMs must be a positive integer");
    }
  }

  evaluate(input: { context: AuthContext; request: Request; path: string }): GuardDecision {
    const now = (this.config.now ?? Date.now)();
    const key = [input.context.tenant.id, input.context.actor.id, input.request.method, input.path].join(":");
    const current = this.windows.get(key);
    if (!current || now - current.windowStart >= this.config.windowMs) {
      this.windows.set(key, { windowStart: now, count: 1 });
      return Object.freeze({ allowed: true });
    }
    if (current.count >= this.config.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.windowStart + this.config.windowMs - now) / 1_000));
      return Object.freeze({
        allowed: false,
        status: 429,
        code: "RATE_LIMITED",
        message: "Request rate limit exceeded",
        retryAfterSeconds,
      });
    }
    current.count += 1;
    return Object.freeze({ allowed: true });
  }
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  get(scopeKey: string): IdempotencyRecord | undefined {
    const record = this.records.get(scopeKey);
    if (!record) return undefined;
    if (Date.parse(record.expiresAt) <= Date.parse(this.now())) {
      this.records.delete(scopeKey);
      return undefined;
    }
    return record;
  }

  put(scopeKey: string, record: PendingIdempotencyRecord, ttlSeconds: number): IdempotencyRecord {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error("Idempotency TTL must be a positive integer");
    }
    const createdAt = this.now();
    const createdTime = Date.parse(createdAt);
    if (!Number.isFinite(createdTime)) throw new Error("Idempotency clock returned an invalid timestamp");
    const stored = Object.freeze({
      ...record,
      createdAt,
      expiresAt: new Date(createdTime + ttlSeconds * 1_000).toISOString(),
    });
    this.records.set(scopeKey, stored);
    return stored;
  }
}

function parseJsonObject(segment: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("JWT segment must contain a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function isBase64Url(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function requiredClaimString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function requiredNumericDate(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function optionalNumericDate(value: unknown): number | undefined {
  return value === undefined ? undefined : requiredNumericDate(value);
}

function audienceContains(value: unknown, expected: string): boolean {
  return value === expected || (Array.isArray(value) && value.some((item) => item === expected));
}

function parseIdentityKind(value: unknown): IdentityKind | undefined {
  return value === "HUMAN" || value === "AGENT" || value === "SERVICE" ? value : undefined;
}

function parseRoles(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const roles = value.filter((role): role is string => typeof role === "string" && Boolean(role.trim())).map((role) => role.trim());
  if (roles.length !== value.length || new Set(roles).size !== roles.length) return undefined;
  return roles;
}

function isValidInstant(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}
