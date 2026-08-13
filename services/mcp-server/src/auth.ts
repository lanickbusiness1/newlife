import {
  constants,
  createPublicKey,
  verify as verifySignature,
  type JsonWebKey,
  type KeyObject
} from "node:crypto";
import { z } from "zod";

export const GENESIS_AUTH_ANCHOR = "GEN-V4-OIDC-AUTH-001" as const;

export const InvocationContextSchema = z.object({
  correlationId: z.string().uuid(),
  purpose: z.string().min(3),
  dataClassification: z.enum(["public", "internal", "confidential", "restricted"]),
  approvalContext: z.string().min(1).optional()
}).strict();

export type InvocationContext = z.infer<typeof InvocationContextSchema>;

export interface OidcVerifierConfig {
  issuer: string;
  audience: string;
  jwksUri: string;
  clockToleranceSeconds: number;
  jwksCacheSeconds: number;
  allowInsecureJwks: boolean;
}

export interface AuthenticatedIdentity {
  issuer: string;
  tenantId: string;
  actorId: string;
  agentId: string;
  permissionScope: string[];
  roles: string[];
  amr: string[];
  tokenId?: string;
}

export interface BoundRequestContext extends InvocationContext, AuthenticatedIdentity {}

interface JwtHeader {
  alg: string;
  kid: string;
  typ?: string;
}

interface JwtClaims extends Record<string, unknown> {
  iss?: unknown;
  aud?: unknown;
  sub?: unknown;
  exp?: unknown;
  nbf?: unknown;
  iat?: unknown;
  jti?: unknown;
  tenant_id?: unknown;
  tenant?: unknown;
  agent_id?: unknown;
  azp?: unknown;
  client_id?: unknown;
  scope?: unknown;
  scp?: unknown;
  roles?: unknown;
  amr?: unknown;
}

interface JwksDocument {
  keys: JsonWebKey[];
}

type AlgorithmDefinition = {
  hash: string;
  kty: "RSA" | "EC";
  mode: "rsa" | "pss" | "ecdsa";
  saltLength?: number;
};

const ALGORITHMS: Record<string, AlgorithmDefinition> = {
  RS256: { hash: "RSA-SHA256", kty: "RSA", mode: "rsa" },
  RS384: { hash: "RSA-SHA384", kty: "RSA", mode: "rsa" },
  RS512: { hash: "RSA-SHA512", kty: "RSA", mode: "rsa" },
  PS256: { hash: "RSA-SHA256", kty: "RSA", mode: "pss", saltLength: 32 },
  PS384: { hash: "RSA-SHA384", kty: "RSA", mode: "pss", saltLength: 48 },
  PS512: { hash: "RSA-SHA512", kty: "RSA", mode: "pss", saltLength: 64 },
  ES256: { hash: "sha256", kty: "EC", mode: "ecdsa" },
  ES384: { hash: "sha384", kty: "EC", mode: "ecdsa" },
  ES512: { hash: "sha512", kty: "EC", mode: "ecdsa" }
};

const MFA_AUTHORITY_SCOPES = new Set([
  "genome:skill:m8",
  "genome:skill:review"
]);

const MFA_AMR_VALUES = new Set([
  "mfa",
  "otp",
  "hwk",
  "swk",
  "fido",
  "webauthn"
]);

const M8_AUTHORITY_ROLES = new Set([
  "M8 Committee",
  "M8_REVIEWER"
]);

const REVIEW_AUTHORITY_ROLES = new Set([
  "Reviewer",
  "M6 Reviewer",
  "S7+ Security Reviewer",
  "M8 Committee",
  "M8_REVIEWER",
  "S7_REVIEWER"
]);

const jwksCache = new Map<string, { expiresAt: number; document: JwksDocument }>();

function requiredEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`AUTH_CONFIG_REQUIRED:${key}`);
  return value;
}

function parsePositiveInteger(value: string | undefined, fallback: number, key: string): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`AUTH_CONFIG_INVALID:${key}`);
  return parsed;
}

export function loadOidcVerifierConfig(env: NodeJS.ProcessEnv = process.env): OidcVerifierConfig {
  const issuer = requiredEnv(env, "OIDC_ISSUER");
  const audience = requiredEnv(env, "OIDC_AUDIENCE");
  const jwksUri = requiredEnv(env, "OIDC_JWKS_URI");
  const allowInsecureJwks = env.OIDC_ALLOW_INSECURE_JWKS === "true";

  let jwksUrl: URL;
  let issuerUrl: URL;
  try {
    jwksUrl = new URL(jwksUri);
    issuerUrl = new URL(issuer);
  } catch {
    throw new Error("AUTH_CONFIG_INVALID_URL");
  }

  if (issuerUrl.protocol !== "https:" && !allowInsecureJwks) {
    throw new Error("AUTH_ISSUER_HTTPS_REQUIRED");
  }
  if (jwksUrl.protocol !== "https:" && !allowInsecureJwks) {
    throw new Error("AUTH_JWKS_HTTPS_REQUIRED");
  }
  if (allowInsecureJwks && env.NODE_ENV === "production") {
    throw new Error("AUTH_INSECURE_JWKS_FORBIDDEN_IN_PRODUCTION");
  }

  return {
    issuer,
    audience,
    jwksUri,
    clockToleranceSeconds: parsePositiveInteger(env.OIDC_CLOCK_TOLERANCE_SECONDS, 30, "OIDC_CLOCK_TOLERANCE_SECONDS"),
    jwksCacheSeconds: parsePositiveInteger(env.OIDC_JWKS_CACHE_SECONDS, 300, "OIDC_JWKS_CACHE_SECONDS"),
    allowInsecureJwks
  };
}

function decodeJsonSegment<T>(segment: string, label: string): T {
  try {
    const decoded = Buffer.from(segment, "base64url").toString("utf8");
    return JSON.parse(decoded) as T;
  } catch {
    throw new Error(`AUTH_JWT_${label}_INVALID`);
  }
}

function parseJwt(token: string): {
  header: JwtHeader;
  claims: JwtClaims;
  signingInput: Buffer;
  signature: Buffer;
} {
  if (token.length > 32_768) throw new Error("AUTH_TOKEN_TOO_LARGE");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("AUTH_JWT_FORMAT_INVALID");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!encodedHeader || !encodedPayload || encodedSignature === undefined) {
    throw new Error("AUTH_JWT_FORMAT_INVALID");
  }

  const rawHeader = decodeJsonSegment<Record<string, unknown>>(encodedHeader, "HEADER");
  const claims = decodeJsonSegment<JwtClaims>(encodedPayload, "PAYLOAD");
  if (typeof rawHeader.alg !== "string" || !(rawHeader.alg in ALGORITHMS)) {
    throw new Error("AUTH_ALG_UNSUPPORTED");
  }
  if (typeof rawHeader.kid !== "string" || !rawHeader.kid.trim()) {
    throw new Error("AUTH_KID_REQUIRED");
  }
  if (
    rawHeader.typ !== undefined &&
    (typeof rawHeader.typ !== "string" || !["JWT", "at+jwt"].includes(rawHeader.typ))
  ) {
    throw new Error("AUTH_TYP_INVALID");
  }

  return {
    header: {
      alg: rawHeader.alg,
      kid: rawHeader.kid,
      ...(typeof rawHeader.typ === "string" ? { typ: rawHeader.typ } : {})
    },
    claims,
    signingInput: Buffer.from(`${encodedHeader}.${encodedPayload}`, "ascii"),
    signature: Buffer.from(encodedSignature, "base64url")
  };
}

async function fetchJwksDocument(
  config: OidcVerifierConfig,
  fetchImpl: typeof fetch
): Promise<JwksDocument> {
  const cached = jwksCache.get(config.jwksUri);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.document;

  let response: Response;
  try {
    response = await fetchImpl(config.jwksUri, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5_000)
    });
  } catch {
    throw new Error("AUTH_JWKS_FETCH_FAILED");
  }
  if (!response.ok) throw new Error(`AUTH_JWKS_HTTP_${response.status}`);

  const text = await response.text();
  if (text.length > 1_048_576) throw new Error("AUTH_JWKS_TOO_LARGE");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("AUTH_JWKS_INVALID_JSON");
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { keys?: unknown }).keys)) {
    throw new Error("AUTH_JWKS_INVALID_DOCUMENT");
  }

  const keys = (parsed as { keys: unknown[] }).keys.filter(
    (key): key is JsonWebKey => Boolean(key && typeof key === "object")
  );
  if (keys.length === 0 || keys.length > 100) throw new Error("AUTH_JWKS_INVALID_KEY_COUNT");

  const document = { keys };
  jwksCache.set(config.jwksUri, {
    expiresAt: now + config.jwksCacheSeconds * 1000,
    document
  });
  return document;
}

function selectJwk(document: JwksDocument, header: JwtHeader): JsonWebKey {
  const algorithm = ALGORITHMS[header.alg];
  if (!algorithm) throw new Error("AUTH_ALG_UNSUPPORTED");

  const matches = document.keys.filter(key => {
    if (key.kid !== header.kid) return false;
    if (key.use !== undefined && key.use !== "sig") return false;
    if (key.alg !== undefined && key.alg !== header.alg) return false;
    if (key.kty !== algorithm.kty) return false;
    return true;
  });

  if (matches.length === 0) throw new Error("AUTH_JWK_NOT_FOUND");
  if (matches.length > 1) throw new Error("AUTH_JWK_AMBIGUOUS");
  const selected = matches[0];
  if (!selected) throw new Error("AUTH_JWK_NOT_FOUND");
  return selected;
}

function verifyJwtSignature(
  header: JwtHeader,
  signingInput: Buffer,
  signature: Buffer,
  jwk: JsonWebKey
): void {
  const algorithm = ALGORITHMS[header.alg];
  if (!algorithm) throw new Error("AUTH_ALG_UNSUPPORTED");

  let key: KeyObject;
  try {
    key = createPublicKey({ key: jwk, format: "jwk" });
  } catch {
    throw new Error("AUTH_JWK_INVALID");
  }

  let valid = false;
  if (algorithm.mode === "rsa") {
    valid = verifySignature(algorithm.hash, signingInput, key, signature);
  } else if (algorithm.mode === "pss") {
    valid = verifySignature(algorithm.hash, signingInput, {
      key,
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: algorithm.saltLength
    }, signature);
  } else {
    valid = verifySignature(algorithm.hash, signingInput, {
      key,
      dsaEncoding: "ieee-p1363"
    }, signature);
  }

  if (!valid) throw new Error("AUTH_SIGNATURE_INVALID");
}

function nonEmptyString(value: unknown, errorCode: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(errorCode);
  return value.trim();
}

function validateAudience(audience: unknown, expected: string): void {
  if (typeof audience === "string") {
    if (audience !== expected) throw new Error("AUTH_AUDIENCE_MISMATCH");
    return;
  }
  if (Array.isArray(audience) && audience.every(value => typeof value === "string")) {
    if (!audience.includes(expected)) throw new Error("AUTH_AUDIENCE_MISMATCH");
    return;
  }
  throw new Error("AUTH_AUDIENCE_MISMATCH");
}

function validateTimeClaims(claims: JwtClaims, config: OidcVerifierConfig): void {
  const now = Math.floor(Date.now() / 1000);
  const tolerance = config.clockToleranceSeconds;

  if (typeof claims.exp !== "number" || !Number.isFinite(claims.exp)) {
    throw new Error("AUTH_EXP_REQUIRED");
  }
  if (now - tolerance >= claims.exp) throw new Error("AUTH_TOKEN_EXPIRED");
  if (claims.nbf !== undefined) {
    if (typeof claims.nbf !== "number" || !Number.isFinite(claims.nbf)) {
      throw new Error("AUTH_NBF_INVALID");
    }
    if (now + tolerance < claims.nbf) throw new Error("AUTH_TOKEN_NOT_YET_VALID");
  }
  if (claims.iat !== undefined) {
    if (typeof claims.iat !== "number" || !Number.isFinite(claims.iat)) {
      throw new Error("AUTH_IAT_INVALID");
    }
    if (claims.iat > now + tolerance) throw new Error("AUTH_IAT_IN_FUTURE");
  }
}

function stringList(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (typeof value === "string") {
    return value.split(/\s+/).map(item => item.trim()).filter(Boolean);
  }
  if (Array.isArray(value) && value.every(item => typeof item === "string")) {
    return value.map(item => item.trim()).filter(Boolean);
  }
  return [];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function hasAnyRole(roles: string[], allowed: Set<string>): boolean {
  return roles.some(role => allowed.has(role));
}

function identityFromClaims(claims: JwtClaims, config: OidcVerifierConfig): AuthenticatedIdentity {
  const issuer = nonEmptyString(claims.iss, "AUTH_ISSUER_REQUIRED");
  if (issuer !== config.issuer) throw new Error("AUTH_ISSUER_MISMATCH");
  validateAudience(claims.aud, config.audience);
  validateTimeClaims(claims, config);

  const actorId = nonEmptyString(claims.sub, "AUTH_SUBJECT_REQUIRED");
  const tenantValue = claims.tenant_id ?? claims.tenant;
  const tenantId = nonEmptyString(tenantValue, "AUTH_TENANT_REQUIRED");
  const agentValue = claims.agent_id ?? claims.azp ?? claims.client_id ?? claims.sub;
  const agentId = nonEmptyString(agentValue, "AUTH_AGENT_REQUIRED");
  const permissionScope = unique([
    ...stringList(claims.scope),
    ...stringList(claims.scp)
  ]);
  const roles = unique(stringList(claims.roles));
  const amr = unique(stringList(claims.amr));

  if (permissionScope.includes("genome:skill:m8") && !hasAnyRole(roles, M8_AUTHORITY_ROLES)) {
    throw new Error("AUTH_ROLE_REQUIRED:M8");
  }
  if (permissionScope.includes("genome:skill:review") && !hasAnyRole(roles, REVIEW_AUTHORITY_ROLES)) {
    throw new Error("AUTH_ROLE_REQUIRED:REVIEW");
  }

  const requiresMfa = permissionScope.some(scope => MFA_AUTHORITY_SCOPES.has(scope));
  if (requiresMfa && !amr.some(method => MFA_AMR_VALUES.has(method.toLowerCase()))) {
    throw new Error("AUTH_MFA_REQUIRED");
  }

  return {
    issuer,
    tenantId,
    actorId,
    agentId,
    permissionScope,
    roles,
    amr,
    ...(typeof claims.jti === "string" && claims.jti.trim() ? { tokenId: claims.jti.trim() } : {})
  };
}

export async function authenticateBearerHeader(
  authorizationHeader: string | undefined,
  config: OidcVerifierConfig,
  fetchImpl: typeof fetch = fetch
): Promise<AuthenticatedIdentity> {
  if (!authorizationHeader) throw new Error("AUTH_BEARER_REQUIRED");
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorizationHeader.trim());
  if (!match?.[1]) throw new Error("AUTH_BEARER_INVALID");

  const parsed = parseJwt(match[1]);
  const document = await fetchJwksDocument(config, fetchImpl);
  const jwk = selectJwk(document, parsed.header);
  verifyJwtSignature(parsed.header, parsed.signingInput, parsed.signature, jwk);
  return identityFromClaims(parsed.claims, config);
}

export function bindAuthenticatedContext(
  identity: AuthenticatedIdentity,
  invocation: InvocationContext
): BoundRequestContext {
  return {
    ...invocation,
    ...identity,
    permissionScope: [...identity.permissionScope],
    roles: [...identity.roles],
    amr: [...identity.amr]
  };
}
