import { createServer } from "node:http";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
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

const contextPack = {
  languageSemantic: { status: "covered", evidenceRefs: ["SMOKE-LANG-GN"] },
  regulatoryLegal: { status: "covered", evidenceRefs: ["SMOKE-LEGAL-GN"] },
  institutional: { status: "covered", evidenceRefs: ["SMOKE-INST-GN"] },
  economicFinancialPayment: { status: "covered", evidenceRefs: ["SMOKE-ECO-GN"] },
  culturalHumanAdoption: { status: "covered", evidenceRefs: ["SMOKE-CULT-GN"] },
  infrastructureResilience: { status: "covered", evidenceRefs: ["SMOKE-INFRA-GN"] },
  marketBusinessRevenue: { status: "covered", evidenceRefs: ["SMOKE-MKT-GN"] },
  technologyDataAgenticAI: { status: "covered", evidenceRefs: ["SMOKE-TECH-GN"] },
  governanceSovereigntyAssurance: { status: "covered", evidenceRefs: ["SMOKE-GOV-GN"] }
};

function sensitiveSkillPayload() {
  return {
    id: "procurement.payment.release.http-smoke",
    version: "1.0.0",
    level: "L3",
    domain: "govtech.procurement",
    problem: "release governed procurement payment after verified milestone evidence",
    triggers: ["milestone approved"],
    inputs: ["milestone_evidence"],
    outputs: ["payment_release_decision"],
    dependencies: ["contract_registry"],
    connectors: ["treasury"],
    permissions: ["payment:propose"],
    procedure: ["verify milestone evidence", "prepare payment release"],
    verification: ["unit test", "human review"],
    remeEvidence: ["SMOKE-REME-PAY-001"],
    metrics: ["accuracy"],
    rollback: "revoke pending release and restore previous state",
    languages: ["fr"],
    countries: ["GN"],
    context: contextPack,
    stratex9: { status: "go", evidenceRefs: ["SMOKE-S9-GN"] },
    riskDomains: ["payment"],
    outcomeEvidencePresent: true,
    localRulesSeparated: true,
    permissionsBounded: true,
    doubleReviewPassed: true,
    secondContextTestPassed: true,
    configurableMetadata: {},
    universalInvariants: {}
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

function extractGovernedData(result, label) {
  if (result.isError) throw new Error(`${label}:${JSON.stringify(result.content)}`);
  const first = result.content[0];
  if (!first || first.type !== "text") throw new Error(`${label}_CONTENT`);
  const governed = JSON.parse(first.text);
  if (governed.eces?.status !== "allowed") throw new Error(`${label}_ECES`);
  return governed.data;
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
const clients = [];
const stderr = [];
const registryRoot = await mkdtemp(path.join(tmpdir(), "genesis-http-registry-"));
const approvalRoot = await mkdtemp(path.join(tmpdir(), "genesis-http-approvals-"));

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
      OIDC_ALLOW_INSECURE_JWKS: "true",
      SKILL_REGISTRY_DIR: registryRoot,
      GOVERNANCE_APPROVAL_DIR: approvalRoot,
      GOVERNANCE_APPROVAL_TTL_SECONDS: "3600"
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  child.stderr?.on("data", chunk => stderr.push(chunk.toString()));

  const health = await waitForHealth(mcpUrl, child, stderr);
  if (health.auth !== "GEN-V4-OIDC-AUTH-001") throw new Error("SMOKE_AUTH_HEALTH_MISSING");
  if (health.authorization !== "GEN-V4-ASIR-AUTHZ-001") throw new Error("SMOKE_AUTHZ_HEALTH_MISSING");
  if (health.approvalLedger !== "GENESIS_GOVERNANCE_APPROVAL_LEDGER_0.1.0") {
    throw new Error("SMOKE_APPROVAL_LEDGER_HEALTH_MISSING");
  }

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
  const allowedClient = await connectClient(mcpUrl, allowedToken, "smoke-allowed");
  clients.push(allowedClient);
  const tools = await allowedClient.listTools();
  if (!tools.tools.some(tool => tool.name === "genome.skill_registry.list")) {
    throw new Error("SMOKE_TOOL_LIST_MISSING");
  }
  if (!tools.tools.some(tool => tool.name === "genome.skill_approval.review_attest")) {
    throw new Error("SMOKE_REVIEW_ATTEST_TOOL_MISSING");
  }
  if (!tools.tools.some(tool => tool.name === "genome.skill_approval.m8_attest")) {
    throw new Error("SMOKE_M8_ATTEST_TOOL_MISSING");
  }

  const allowed = await allowedClient.callTool({
    name: "genome.skill_registry.list",
    arguments: { context: invocation() }
  });
  const visibleRegistry = extractGovernedData(allowed, "SMOKE_ALLOWED_TOOL_FAILED");
  if (!Array.isArray(visibleRegistry)) throw new Error("SMOKE_REGISTRY_LIST_NOT_ARRAY");

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
  const deniedClient = await connectClient(mcpUrl, deniedToken, "smoke-denied");
  clients.push(deniedClient);

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

  const skillPayload = sensitiveSkillPayload();
  const reviewerToken = createToken(
    issuer,
    "genome:skill:review genome:skill:install",
    {
      sub: "reviewer-1",
      agent_id: "review-agent",
      roles: ["Reviewer"],
      amr: ["pwd", "mfa"],
      countries: ["GN"],
      missions: ["govtech-procurement"]
    }
  );
  const reviewerClient = await connectClient(mcpUrl, reviewerToken, "smoke-reviewer");
  clients.push(reviewerClient);

  const m8Token = createToken(
    issuer,
    "genome:skill:m8",
    {
      sub: "m8-1",
      agent_id: "m8-agent",
      roles: ["M8 Committee"],
      amr: ["pwd", "mfa"],
      countries: ["GN"],
      missions: ["govtech-procurement"]
    }
  );
  const m8Client = await connectClient(mcpUrl, m8Token, "smoke-m8");
  clients.push(m8Client);

  const installerToken = createToken(
    issuer,
    "genome:skill:install",
    {
      sub: "installer-1",
      agent_id: "installer-agent",
      roles: ["Workflow Orchestrator"],
      countries: ["GN"],
      missions: ["govtech-procurement"]
    }
  );
  const installerClient = await connectClient(mcpUrl, installerToken, "smoke-installer");
  clients.push(installerClient);

  const reviewResult = await reviewerClient.callTool({
    name: "genome.skill_approval.review_attest",
    arguments: { context: invocation(), payload: skillPayload }
  });
  const reviewApproval = extractGovernedData(reviewResult, "SMOKE_REVIEW_ATTEST_FAILED");
  if (!reviewApproval?.approvalId) throw new Error("SMOKE_REVIEW_APPROVAL_ID_MISSING");

  const m8Result = await m8Client.callTool({
    name: "genome.skill_approval.m8_attest",
    arguments: { context: invocation(), payload: skillPayload }
  });
  const m8Approval = extractGovernedData(m8Result, "SMOKE_M8_ATTEST_FAILED");
  if (!m8Approval?.approvalId) throw new Error("SMOKE_M8_APPROVAL_ID_MISSING");

  const selfInstall = await reviewerClient.callTool({
    name: "genome.skill_factory.install",
    arguments: {
      context: invocation(),
      payload: skillPayload,
      approvalRefs: {
        reviewApprovalId: reviewApproval.approvalId,
        m8ApprovalId: m8Approval.approvalId
      }
    }
  });
  if (!selfInstall.isError) throw new Error("SMOKE_REVIEWER_SELF_INSTALL_ACCEPTED");

  const installResult = await installerClient.callTool({
    name: "genome.skill_factory.install",
    arguments: {
      context: invocation(),
      payload: skillPayload,
      approvalRefs: {
        reviewApprovalId: reviewApproval.approvalId,
        m8ApprovalId: m8Approval.approvalId
      }
    }
  });
  const installed = extractGovernedData(installResult, "SMOKE_THREE_ACTOR_INSTALL_FAILED");
  if (installed?.skill?.id !== skillPayload.id) throw new Error("SMOKE_INSTALLED_SKILL_MISMATCH");

  console.log(JSON.stringify({
    status: "ok",
    health: {
      auth: health.auth,
      authorization: health.authorization,
      approvalLedger: health.approvalLedger,
      version: health.version
    },
    authenticatedTool: "genome.skill_registry.list",
    territorialCountryAllowed: "GN",
    territorialCountryDenied: "CI",
    insufficientScopeDenied: true,
    forgedContextDenied: true,
    governance: {
      reviewer: reviewApproval.actorId,
      m8: m8Approval.actorId,
      installer: "installer-1",
      reviewerSelfInstallDenied: true,
      sensitiveInstallSucceeded: true
    }
  }));
} finally {
  for (const client of clients) {
    try { await client.close(); } catch {}
  }
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await new Promise(resolve => {
      child.once("exit", resolve);
      setTimeout(resolve, 1000).unref();
    });
  }
  await new Promise(resolve => jwksServer.close(resolve));
  await Promise.all([
    rm(registryRoot, { recursive: true, force: true }),
    rm(approvalRoot, { recursive: true, force: true })
  ]);
}
