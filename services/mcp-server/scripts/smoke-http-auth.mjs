import { createServer } from "node:http";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const audience = "afriagenesis-mcp";
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: "jwk" });
const kid = "smoke-http-auth-key";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address()));
  });
}

function createToken(issuer, scope, extraClaims = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", kid };
  const payload = {
    iss: issuer,
    aud: audience,
    sub: "smoke-user",
    tenant_id: "smoke-tenant",
    agent_id: "smoke-client",
    scope,
    roles: ["Analyst"],
    amr: ["pwd"],
    iat: now - 1,
    nbf: now - 1,
    exp: now + 300,
    jti: randomUUID(),
    ...extraClaims
  };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = sign("RSA-SHA256", Buffer.from(signingInput), privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}

async function waitForHealth(url, child, stderr) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`SMOKE_MCP_EXITED:${child.exitCode}:${stderr.join("")}`);
    }
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return await response.json();
    } catch {
      // Server is not listening yet.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`SMOKE_MCP_HEALTH_TIMEOUT:${stderr.join("")}`);
}

function invocation(extra = {}) {
  return {
    correlationId: randomUUID(),
    purpose: "verify OIDC-bound MCP authorization",
    dataClassification: "internal",
    ...extra
  };
}

function matchRequest(country) {
  return {
    level: "L3",
    domain: "govtech.procurement",
    problem: "verify supplier eligibility before procurement submission",
    triggers: ["supplier onboarding"],
    inputs: ["supplier_profile"],
    outputs: ["eligibility_status"],
    dependencies: [],
    connectors: [],
    permissions: ["supplier:read"],
    countries: [country]
  };
}

async function connectClient(url, token, name) {
  const client = new Client({ name, version: "1.0.0" }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(`${url}/mcp`), {
    requestInit: {
      headers: { Authorization: `Bearer ${token}` }
    }
  });
  await client.connect(transport);
  return client;
}

const jwksServer = createServer((req, res) => {
  if (req.url === "/jwks") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      keys: [{ ...publicJwk, kid, alg: "RS256", use: "sig" }]
    }));
    return;
  }
  res.writeHead(404);
  res.end();
});

let child;
let allowedClient;
let deniedClient;
const stderr = [];

try {
  const address = await listen(jwksServer);
  if (!address || typeof address === "string") throw new Error("SMOKE_JWKS_LISTEN_FAILED");
  const issuer = `http://127.0.0.1:${address.port}`;

  const probe = createServer();
  const probeAddress = await listen(probe);
  if (!probeAddress || typeof probeAddress === "string") throw new Error("SMOKE_PORT_PROBE_FAILED");
  const mcpPort = probeAddress.port;
  await new Promise(resolve => probe.close(resolve));
  const mcpUrl = `http://127.0.0.1:${mcpPort}`;

  child = spawn(process.execPath, ["dist/index.js", "--transport=http"], {
    env: {
      ...process.env,
      PORT: String(mcpPort),
      NODE_ENV: "test",
      OIDC_ISSUER: issuer,
      OIDC_AUDIENCE: audience,
      OIDC_JWKS_URI: `${issuer}/jwks`,
      OIDC_ALLOW_INSECURE_JWKS: "true"
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  child.stderr?.on("data", chunk => stderr.push(chunk.toString()));

  const health = await waitForHealth(mcpUrl, child, stderr);
  if (health.auth !== "GEN-V4-OIDC-AUTH-001") throw new Error("SMOKE_AUTH_HEALTH_MISSING");
  if (health.authorization !== "GEN-V4-ASIR-AUTHZ-001") throw new Error("SMOKE_AUTHZ_HEALTH_MISSING");

  const unauthenticated = await fetch(`${mcpUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" })
  });
  if (unauthenticated.status !== 401) throw new Error(`SMOKE_UNAUTH_STATUS:${unauthenticated.status}`);

  const allowedToken = createToken(
    issuer,
    "genome:skill:read",
    { countries: ["GN"], organizations: ["PPCC"], missions: ["govtech-procurement"] }
  );
  allowedClient = await connectClient(mcpUrl, allowedToken, "smoke-allowed");
  const tools = await allowedClient.listTools();
  if (!tools.tools.some(tool => tool.name === "genome.skill_registry.list")) {
    throw new Error("SMOKE_TOOL_LIST_MISSING");
  }

  const allowed = await allowedClient.callTool({
    name: "genome.skill_registry.list",
    arguments: { context: invocation() }
  });
  if (allowed.isError) throw new Error(`SMOKE_ALLOWED_TOOL_FAILED:${JSON.stringify(allowed.content)}`);
  const first = allowed.content[0];
  if (!first || first.type !== "text") throw new Error("SMOKE_ALLOWED_TOOL_CONTENT");
  const governed = JSON.parse(first.text);
  if (governed.eces?.status !== "allowed") throw new Error("SMOKE_ECES_NOT_ALLOWED");
  if (!Array.isArray(governed.data)) throw new Error("SMOKE_REGISTRY_LIST_NOT_ARRAY");

  const matchGn = await allowedClient.callTool({
    name: "genome.skill_factory.match",
    arguments: { context: invocation(), request: matchRequest("GN") }
  });
  if (matchGn.isError) throw new Error(`SMOKE_GN_ABAC_DENIED:${JSON.stringify(matchGn.content)}`);

  const matchCi = await allowedClient.callTool({
    name: "genome.skill_factory.match",
    arguments: { context: invocation(), request: matchRequest("CI") }
  });
  if (!matchCi.isError) throw new Error("SMOKE_CI_ABAC_ACCEPTED");

  const deniedToken = createToken(issuer, "genome:skill:compile", { countries: ["GN"] });
  deniedClient = await connectClient(mcpUrl, deniedToken, "smoke-denied");

  const insufficient = await deniedClient.callTool({
    name: "genome.skill_registry.list",
    arguments: { context: invocation() }
  });
  if (!insufficient.isError) throw new Error("SMOKE_INSUFFICIENT_SCOPE_ACCEPTED");

  const forged = await deniedClient.callTool({
    name: "genome.skill_registry.list",
    arguments: {
      context: invocation({
        permissionScope: ["genome:skill:read"],
        tenantId: "forged-tenant",
        actorId: "forged-admin",
        allowedCountries: ["CI"]
      })
    }
  });
  if (!forged.isError) throw new Error("SMOKE_FORGED_CONTEXT_ACCEPTED");

  console.log(JSON.stringify({
    status: "ok",
    health: {
      auth: health.auth,
      authorization: health.authorization,
      version: health.version
    },
    authenticatedTool: "genome.skill_registry.list",
    territorialCountryAllowed: "GN",
    territorialCountryDenied: "CI",
    insufficientScopeDenied: true,
    forgedContextDenied: true
  }));
} finally {
  try { await allowedClient?.close(); } catch {}
  try { await deniedClient?.close(); } catch {}
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await new Promise(resolve => {
      child.once("exit", resolve);
      setTimeout(resolve, 1000).unref();
    });
  }
  await new Promise(resolve => jwksServer.close(resolve));
}
