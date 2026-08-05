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

function isValidInstant(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}
