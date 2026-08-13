import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  InvocationContextSchema,
  authenticateBearerHeader,
  bindAuthenticatedContext,
  type OidcVerifierConfig
} from "../src/auth";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: "jwk" });
const kid = "test-key-1";

const config: OidcVerifierConfig = {
  issuer: "https://id.afriagenesis.test",
  audience: "afriagenesis-mcp",
  jwksUri: "https://id.afriagenesis.test/.well-known/jwks.json",
  clockToleranceSeconds: 30,
  jwksCacheSeconds: 60,
  allowInsecureJwks: false
};

function jwt(overrides: Record<string, unknown> = {}, headerOverrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", kid, ...headerOverrides };
  const payload = {
    iss: config.issuer,
    aud: config.audience,
    sub: "user-123",
    tenant_id: "tenant-gn",
    agent_id: "agent-skill-factory",
    scope: "genome:skill:compile genome:skill:read",
    roles: ["Analyst"],
    amr: ["pwd"],
    iat: now - 5,
    nbf: now - 5,
    exp: now + 300,
    ...overrides
  };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = sign("RSA-SHA256", Buffer.from(signingInput), privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}

const fetchJwks: typeof fetch = async () => new Response(JSON.stringify({
  keys: [{ ...publicJwk, kid, alg: "RS256", use: "sig" }]
}), {
  status: 200,
  headers: { "content-type": "application/json" }
});

describe("OIDC-bound MCP identity", () => {
  test("verifies JWT signature and derives tenant, actor, agent and scopes from claims", async () => {
    const identity = await authenticateBearerHeader(`Bearer ${jwt()}`, config, fetchJwks);

    expect(identity).toMatchObject({
      tenantId: "tenant-gn",
      actorId: "user-123",
      agentId: "agent-skill-factory"
    });
    expect(identity.permissionScope).toContain("genome:skill:compile");
    expect(identity.roles).toEqual(["Analyst"]);
  });

  test("rejects expired tokens and wrong audiences", async () => {
    const now = Math.floor(Date.now() / 1000);
    await expect(authenticateBearerHeader(`Bearer ${jwt({ exp: now - 120 })}`, config, fetchJwks))
      .rejects.toThrow(/AUTH_TOKEN_EXPIRED/);
    await expect(authenticateBearerHeader(`Bearer ${jwt({ aud: "other-service" })}`, config, fetchJwks))
      .rejects.toThrow(/AUTH_AUDIENCE_MISMATCH/);
  });

  test("rejects unsigned or unsupported JWT algorithms", async () => {
    const parts = jwt().split(".");
    const noneHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT", kid })).toString("base64url");
    await expect(authenticateBearerHeader(`Bearer ${noneHeader}.${parts[1]}.`, config, fetchJwks))
      .rejects.toThrow(/AUTH_ALG_UNSUPPORTED/);
  });

  test("requires MFA evidence for M8 and double-review authority scopes", async () => {
    await expect(authenticateBearerHeader(
      `Bearer ${jwt({
        scope: "genome:skill:install genome:skill:m8",
        roles: ["M8 Committee"],
        amr: ["pwd"]
      })}`,
      config,
      fetchJwks
    )).rejects.toThrow(/AUTH_MFA_REQUIRED/);

    const identity = await authenticateBearerHeader(
      `Bearer ${jwt({
        scope: "genome:skill:install genome:skill:m8 genome:skill:review",
        roles: ["M8 Committee", "Reviewer"],
        amr: ["pwd", "mfa"]
      })}`,
      config,
      fetchJwks
    );
    expect(identity.permissionScope).toContain("genome:skill:m8");
  });

  test("requires canonical human authority roles for sensitive authority scopes", async () => {
    await expect(authenticateBearerHeader(
      `Bearer ${jwt({
        scope: "genome:skill:install genome:skill:m8",
        roles: ["Analyst"],
        amr: ["pwd", "mfa"]
      })}`,
      config,
      fetchJwks
    )).rejects.toThrow(/AUTH_ROLE_REQUIRED:M8/);

    await expect(authenticateBearerHeader(
      `Bearer ${jwt({
        scope: "genome:skill:install genome:skill:review",
        roles: ["Analyst"],
        amr: ["pwd", "mfa"]
      })}`,
      config,
      fetchJwks
    )).rejects.toThrow(/AUTH_ROLE_REQUIRED:REVIEW/);
  });

  test("client invocation context cannot declare identity or permission scopes", () => {
    expect(() => InvocationContextSchema.parse({
      correlationId: "06d8d70b-f038-4272-858c-f60a78263e13",
      purpose: "compile governed skill",
      dataClassification: "internal",
      permissionScope: ["genome:skill:m8"],
      actorId: "forged-admin",
      tenantId: "other-tenant"
    })).toThrow();
  });

  test("bound context always uses verified identity and preserves only business invocation fields", async () => {
    const identity = await authenticateBearerHeader(`Bearer ${jwt()}`, config, fetchJwks);
    const invocation = InvocationContextSchema.parse({
      correlationId: "06d8d70b-f038-4272-858c-f60a78263e13",
      purpose: "compile governed skill",
      dataClassification: "internal"
    });
    const bound = bindAuthenticatedContext(identity, invocation);

    expect(bound.tenantId).toBe("tenant-gn");
    expect(bound.actorId).toBe("user-123");
    expect(bound.permissionScope).toEqual(identity.permissionScope);
    expect(bound.purpose).toBe("compile governed skill");
  });
});
