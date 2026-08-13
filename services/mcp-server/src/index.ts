import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import {
  GENESIS_AUTH_ANCHOR,
  InvocationContextSchema,
  authenticateBearerHeader,
  bindAuthenticatedContext,
  loadOidcVerifierConfig,
  loadTrustedStdioIdentity,
  type AuthenticatedIdentity,
  type BoundRequestContext
} from "./auth.js";
import { authorizeContext, GENESIS_AUTHZ_ANCHOR } from "./authorization.js";
import { registerSkillMcpTools, SKILL_MCP_HEALTH } from "./mcpSkillTools.js";
import { compileRevenueEngine } from "./revenueEngine.js";

const SERVICE_VERSION = "0.4.0";

type Context = BoundRequestContext;

function safeAuthErrorCode(error: unknown): string {
  if (
    error instanceof Error &&
    /^AUTH_[A-Z0-9_]+(?::[A-Za-z0-9_.+-]+)?$/.test(error.message)
  ) {
    return error.message;
  }
  return "AUTH_FAILED";
}

function governed(ctx: Context, tool: string, data: unknown) {
  const auditId = randomUUID();
  console.error(JSON.stringify({
    auditId,
    at: new Date().toISOString(),
    tenantId: ctx.tenantId,
    actorId: ctx.actorId,
    agentId: ctx.agentId,
    issuer: ctx.issuer,
    roles: ctx.roles,
    correlationId: ctx.correlationId,
    purpose: ctx.purpose,
    tool,
    status: "allowed"
  }));
  return {
    data,
    provenance: [],
    confidence: 0.72,
    freshness: { status: "generated", checkedAt: new Date().toISOString() },
    contradictions: [],
    eces: {
      status: "allowed",
      gate: "G8.2",
      reason: "OIDC identity + ASIR authorization validated; GENESIS V4 governed MCP active."
    },
    auditId,
    limitations: [
      "MCP v0.4.0 binds HTTP identity/scopes to verified OIDC/JWKS claims. Production still requires a real institutional IdP, durable registry storage, monitoring, backup/restore, rollback and multi-tenant environment proof."
    ]
  };
}

function buildServer(identity: AuthenticatedIdentity) {
  const server = new McpServer({
    name: "afriagenesis-intelligence-mcp",
    version: SERVICE_VERSION
  });

  function register(
    name: string,
    description: string,
    inputSchema: Record<string, z.ZodTypeAny>,
    requiredScope: string,
    handler: (args: any) => Promise<unknown>
  ) {
    server.tool(name, description, inputSchema, async (args: any) => {
      const invocation = InvocationContextSchema.parse(args.context);
      const ctx = bindAuthenticatedContext(identity, invocation);
      authorizeContext(ctx, requiredScope);
      const data = await handler({ ...args, context: ctx });
      return {
        content: [{ type: "text", text: JSON.stringify(governed(ctx, name, data)) }]
      };
    });
  }

  register("entity.search", "Recherche des entités dans le tenant.", {
    context: InvocationContextSchema, query: z.string().min(2)
  }, "entity:read", async ({ context, query }) => ({
    tenantId: context.tenantId, query, items: []
  }));

  register("entity.get", "Retourne une entité par identifiant.", {
    context: InvocationContextSchema, entityId: z.string().min(1)
  }, "entity:read", async ({ context, entityId }) => ({
    tenantId: context.tenantId, entityId, status: "mock"
  }));

  register("evidence.search", "Recherche des preuves.", {
    context: InvocationContextSchema, query: z.string().min(2)
  }, "evidence:read", async ({ context, query }) => ({
    tenantId: context.tenantId, query, items: []
  }));

  register("evidence.get_lineage", "Retourne le lineage d’une preuve.", {
    context: InvocationContextSchema, evidenceId: z.string().min(1)
  }, "evidence:read", async ({ context, evidenceId }) => ({
    tenantId: context.tenantId, evidenceId, lineage: []
  }));

  register("signal.ingest", "Ingestion contrôlée d’un signal non sensible.", {
    context: InvocationContextSchema, payload: z.unknown()
  }, "signal:write", async ({ context, payload }) => ({
    tenantId: context.tenantId, accepted: true, payload
  }));

  register("opportunity.score", "Calcule un score explicable.", {
    context: InvocationContextSchema, payload: z.unknown()
  }, "opportunity:score", async ({ context, payload }) => ({
    tenantId: context.tenantId, score: 0, factors: [], payload
  }));

  register("opportunity.explain_score", "Explique un score d’opportunité.", {
    context: InvocationContextSchema, opportunityId: z.string().min(1)
  }, "opportunity:read", async ({ context, opportunityId }) => ({
    tenantId: context.tenantId, opportunityId, explanation: []
  }));

  register("executive.generate_brief", "Produit un brief exécutif gouverné.", {
    context: InvocationContextSchema, topic: z.string().min(3)
  }, "executive:brief", async ({ context, topic }) => ({
    tenantId: context.tenantId, topic, priorities: [], risks: [], evidence: []
  }));

  register("genome.revenue_engine.compile", "Compile un produit AfrIAgenesis® en moteur Release-to-Revenue GENESIS V4.", {
    context: InvocationContextSchema,
    payload: z.unknown()
  }, "revenue:plan", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    ...compileRevenueEngine(payload)
  }));

  registerSkillMcpTools(register, InvocationContextSchema);

  return server;
}

const mode = process.argv.find(v => v.startsWith("--transport="))?.split("=")[1]
  ?? process.env.MCP_TRANSPORT
  ?? "http";

if (mode === "stdio") {
  const identity = loadTrustedStdioIdentity();
  const server = buildServer(identity);
  await server.connect(new StdioServerTransport());
} else {
  const oidcConfig = loadOidcVerifierConfig();
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "afriagenesis-intelligence-mcp",
      version: SERVICE_VERSION,
      genome: "GENESIS_V4",
      auth: GENESIS_AUTH_ANCHOR,
      authorization: GENESIS_AUTHZ_ANCHOR,
      revenueEngine: "GEN-V4-REV-ENGINE-001",
      ...SKILL_MCP_HEALTH
    });
  });

  app.post("/mcp", async (req, res) => {
    let identity: AuthenticatedIdentity;
    try {
      identity = await authenticateBearerHeader(req.get("authorization"), oidcConfig);
    } catch (error) {
      const auditId = randomUUID();
      const errorCode = safeAuthErrorCode(error);
      console.error(JSON.stringify({
        auditId,
        at: new Date().toISOString(),
        route: "/mcp",
        status: "denied",
        reason: errorCode
      }));
      res.setHeader("WWW-Authenticate", "Bearer");
      res.status(401).json({ error: errorCode, auditId });
      return;
    }

    const server = buildServer(identity);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    res.on("close", () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) {
        res.status(500).json({ error: "MCP_INTERNAL_ERROR" });
      }
    }
  });

  const port = Number(process.env.PORT ?? 10000);
  app.listen(port, "0.0.0.0", () => {
    console.error(`AFRIAGENESIS MCP HTTP listening on 0.0.0.0:${port}`);
  });
}
