import assert from "node:assert/strict";
import test from "node:test";
import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto";
import {
  Rs256JwtAccessTokenVerifier,
  type JwtSigningKeyProvider,
} from "../src/mining-local-content-security-operations.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

class StaticKeyProvider implements JwtSigningKeyProvider {
  constructor(private readonly keys: ReadonlyMap<string, KeyObject>) {}

  async getKey(keyId: string): Promise<KeyObject | undefined> {
    return this.keys.get(keyId);
  }
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function signJwt(payload: Record<string, unknown>, options: { kid?: string; alg?: string } = {}): string {
  const header = encode({ alg: options.alg ?? "RS256", typ: "JWT", kid: options.kid ?? "key-1" });
  const body = encode(payload);
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${body}`);
  signer.end();
  return `${header}.${body}.${signer.sign(privateKey).toString("base64url")}`;
}

function claims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: "https://identity.afriagenesis.test",
    aud: "mining-local-content-module-06",
    sub: "auditor-1",
    jti: "token-1",
    iat: 1_785_927_000,
    exp: 1_785_934_200,
    tenant_id: "tenant-gn",
    tenant_name: "Guinea Mining Authority",
    jurisdiction: "GN",
    actor_kind: "HUMAN",
    actor_display_name: "Internal Auditor",
    roles: ["AUDITOR"],
    ...overrides,
  };
}

function verifier(keys = new Map<string, KeyObject>([["key-1", publicKey]])): Rs256JwtAccessTokenVerifier {
  return new Rs256JwtAccessTokenVerifier({
    issuer: "https://identity.afriagenesis.test",
    audience: "mining-local-content-module-06",
    keyProvider: new StaticKeyProvider(keys),
    nowSeconds: () => 1_785_930_000,
    clockSkewSeconds: 30,
  });
}

test("verifies an RS256 signature and maps governed tenant and actor claims", async () => {
  const result = await verifier().verify(signJwt(claims()));

  assert.deepEqual(result, {
    tokenId: "token-1",
    subject: "auditor-1",
    tenantId: "tenant-gn",
    tenantName: "Guinea Mining Authority",
    jurisdiction: "GN",
    actorKind: "HUMAN",
    actorDisplayName: "Internal Auditor",
    roles: ["AUDITOR"],
    issuedAt: new Date(1_785_927_000 * 1_000).toISOString(),
    expiresAt: new Date(1_785_934_200 * 1_000).toISOString(),
  });
});

test("rejects a JWT whose signed payload was tampered after signature creation", async () => {
  const token = signJwt(claims());
  const [header, , signature] = token.split(".");
  const tampered = `${header}.${encode(claims({ roles: ["AUDITOR", "LEGAL_APPROVER"] }))}.${signature}`;

  assert.equal(await verifier().verify(tampered), undefined);
});

test("rejects wrong issuer, audience, unknown signing key and unsupported algorithm", async () => {
  assert.equal(await verifier().verify(signJwt(claims({ iss: "https://attacker.test" }))), undefined);
  assert.equal(await verifier().verify(signJwt(claims({ aud: "different-service" }))), undefined);
  assert.equal(await verifier().verify(signJwt(claims(), { kid: "unknown-key" })), undefined);
  assert.equal(await verifier().verify(signJwt(claims(), { alg: "HS256" })), undefined);
});

test("rejects expired, future and structurally invalid governed claims", async () => {
  assert.equal(await verifier().verify(signJwt(claims({ exp: 1_785_929_000 }))), undefined);
  assert.equal(await verifier().verify(signJwt(claims({ iat: 1_785_931_000 }))), undefined);
  assert.equal(await verifier().verify(signJwt(claims({ roles: [] }))), undefined);
  assert.equal(await verifier().verify(signJwt(claims({ actor_kind: "ROOT" }))), undefined);
});
