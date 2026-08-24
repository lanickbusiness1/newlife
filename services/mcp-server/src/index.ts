import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import {
  compileRevenueEngine,
  GENESIS_V4_REVENUE_ENGINE_ANCHOR,
  GENESIS_V4_TODAY_INNOVATIONS
} from "./revenueEngine.js";
import { compileValidationRelay, GENESIS_V4_VALIDATION_RELAY_ANCHOR } from "./validationRelay.js";
import {
  decideNextAction,
  evaluateOutcome,
  GENESIS_V4_WORLD_MODEL_RUNTIME_ANCHOR,
  reconstructWorldState,
  simulateScenarios
} from "./worldModelRuntime.js";
import {
  compileControlTransition,
  compileGenesisContext,
  evaluateKnowledgePromotion,
  GENESIS_V4_CHATGPT_CONTROL_PLANE_ANCHOR
} from "./chatgptControlPlane.js";
import {
  attestCapitalizationPlan,
  compileCapitalizationPlan,
  compileChatSignal,
  evaluateEditorialSignal,
  GENESIS_V4_LIVING_INTELLECTUAL_CAPITALIZATION_ANCHOR,
  recordCapitalizationEvidence
} from "./livingIntellectualCapitalization.js";
import { compileRemePromotion } from "./remePromotion.js";

const PACKAGE_VERSION = "0.3.0";
const CONTROL_PLANE_REVISION = "0.9.0";

const RequestContext = z.object({
  tenantId: z.string().min(1),
  actorId: z.string().min(1),
  agentId: z.string().min(1),
  correlationId: z.string().uuid(),
  purpose: z.string().min(3),
  permissionScope: z.array(z.string()).default([]),
  dataClassification: z.enum(["public", "internal", "confidential", "restricted"]),
  approvalContext: z.string().optional()
});

type Context = z.infer<typeof RequestContext>;

function authorize(ctx: Context, requiredScope: string) {
  if (!ctx.permissionScope.includes(requiredScope)) {
    throw new Error(`ECES_DENY: scope '${requiredScope}' absent`);
  }
  if (ctx.dataClassification === "restricted" && !ctx.approvalContext) {
    throw new Error("ECES_REVIEW_REQUIRED: approvalContext absent");
  }
}

function governed(ctx: Context, tool: string, data: unknown) {
  const auditId = randomUUID();
  console.error(JSON.stringify({
    auditId,
    at: new Date().toISOString(),
    tenantId: ctx.tenantId,
    actorId: ctx.actorId,
    agentId: ctx.agentId,
    correlationId: ctx.correlationId,
    purpose: ctx.purpose,
    tool,
    status: "allowed"
  }));
  return {
    data,
    provenance: [],
    confidence: 0.78,
    freshness: { status: "generated", checkedAt: new Date().toISOString() },
    contradictions: [],
    eces: {
      status: "allowed",
      gate: "G8.3",
      reason: "Scope validated; GENESIS V4 governed control plane active with Living Intellectual Capitalization revision 0.9.0."
    },
    auditId,
    limitations: [
      "MCP package 0.3.0 / control-plane revision 0.9.0: external writes remain connector-owned; evidence closure requires both a planning-authority HMAC attestation and tenant-bound HMAC-SHA256 connector receipts."
    ]
  };
}

function buildServer() {
  const server = new McpServer({
    name: "afriagenesis-intelligence-mcp",
    version: PACKAGE_VERSION
  });

  function register(
    name: string,
    description: string,
    inputSchema: Record<string, z.ZodTypeAny>,
    requiredScope: string,
    handler: (args: any) => Promise<unknown>
  ) {
    server.tool(name, description, inputSchema, async (args: any) => {
      const ctx = RequestContext.parse(args.context);
      authorize(ctx, requiredScope);
      const data = await handler(args);
      return {
        content: [{ type: "text", text: JSON.stringify(governed(ctx, name, data)) }]
      };
    });
  }

  register("entity.search", "Recherche des entités dans le tenant.", {
    context: RequestContext, query: z.string().min(2)
  }, "entity:read", async ({ context, query }) => ({
    tenantId: context.tenantId, query, items: []
  }));

  register("entity.get", "Retourne une entité par identifiant.", {
    context: RequestContext, entityId: z.string().min(1)
  }, "entity:read", async ({ context, entityId }) => ({
    tenantId: context.tenantId, entityId, status: "mock"
  }));

  register("evidence.search", "Recherche des preuves.", {
    context: RequestContext, query: z.string().min(2)
  }, "evidence:read", async ({ context, query }) => ({
    tenantId: context.tenantId, query, items: []
  }));

  register("evidence.get_lineage", "Retourne le lineage d’une preuve.", {
    context: RequestContext, evidenceId: z.string().min(1)
  }, "evidence:read", async ({ context, evidenceId }) => ({
    tenantId: context.tenantId, evidenceId, lineage: []
  }));

  register("signal.ingest", "Ingestion contrôlée d’un signal non sensible.", {
    context: RequestContext, payload: z.unknown()
  }, "signal:write", async ({ context, payload }) => ({
    tenantId: context.tenantId, accepted: true, payload
  }));

  register("opportunity.score", "Calcule un score explicable.", {
    context: RequestContext, payload: z.unknown()
  }, "opportunity:score", async ({ context, payload }) => ({
    tenantId: context.tenantId, score: 0, factors: [], payload
  }));

  register("opportunity.explain_score", "Explique un score d’opportunité.", {
    context: RequestContext, opportunityId: z.string().min(1)
  }, "opportunity:read", async ({ context, opportunityId }) => ({
    tenantId: context.tenantId, opportunityId, explanation: []
  }));

  register("executive.generate_brief", "Produit un brief exécutif gouverné.", {
    context: RequestContext, topic: z.string().min(3)
  }, "executive:brief", async ({ context, topic }) => ({
    tenantId: context.tenantId, topic, priorities: [], risks: [], evidence: []
  }));

  register("genome.revenue_engine.compile", "Compile un produit AfrIAgenesis® en moteur Release-to-Revenue GENESIS V4.", {
    context: RequestContext,
    payload: z.unknown()
  }, "revenue:plan", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    ...compileRevenueEngine(payload)
  }));

  register("deploybot.validation_relay.compile", "Compile une validation CEO en state machine DeployBot A1-A3 jusqu’au livrable final ou veto A4.", {
    context: RequestContext,
    payload: z.unknown()
  }, "deploy:plan", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    ...compileValidationRelay(payload)
  }));

  register("world.reconstruct_state", "Reconstruit un World State depuis des observations explicitement sourcées et conserve leur lineage de preuve.", {
    context: RequestContext,
    payload: z.unknown()
  }, "world:read", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    state: reconstructWorldState((payload as any)?.observations)
  }));

  register("world.simulate", "Simule et classe des scénarios contrefactuels à partir d’inputs explicites, sans imputation silencieuse.", {
    context: RequestContext,
    payload: z.unknown()
  }, "world:simulate", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    simulations: simulateScenarios((payload as any)?.state, (payload as any)?.scenarios)
  }));

  register("world.decide", "Sélectionne la meilleure action réversible autorisée après consultation du World Model.", {
    context: RequestContext,
    payload: z.unknown()
  }, "world:decide", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    decision: decideNextAction((payload as any)?.state, (payload as any)?.simulations)
  }));

  register("world.evaluate_outcome", "Compare une prévision à un résultat observé avec preuve et émet un apprentissage borné.", {
    context: RequestContext,
    payload: z.unknown()
  }, "world:evaluate", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    evaluation: evaluateOutcome((payload as any)?.decision, (payload as any)?.actual)
  }));

  register("genesis.context.compile", "Compile GENOME, R.E.M.E et World Model en Context Packet borné pour une tâche ChatGPT/agentique.", {
    context: RequestContext,
    payload: z.unknown()
  }, "context:compile", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    packet: compileGenesisContext(payload as any)
  }));

  register("genesis.control.compile_transition", "Compile une interaction exécutive en contrat de transition d’état GENESIS gouverné et fail-closed.", {
    context: RequestContext,
    payload: z.unknown()
  }, "control:compile", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    transition: compileControlTransition(payload as any)
  }));

  register("genesis.knowledge.evaluate_promotion", "Évalue la promotion d’un candidat ChatGPT/Research vers Project Context, World Model, R.E.M.E ou GENOME sans contourner les gates.", {
    context: RequestContext,
    payload: z.unknown()
  }, "knowledge:promote", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    promotion: evaluateKnowledgePromotion(payload as any)
  }));

  register("genesis.capitalization.evaluate_signal", "Normalise un signal conversationnel tenant-bound et applique l’Editorial Signal Gate™ de V4-DEC-016 sans promouvoir ChatGPT Memory comme source canonique.", {
    context: RequestContext,
    payload: z.unknown()
  }, "capitalization:evaluate", async ({ context, payload }) => {
    const signal = compileChatSignal({ ...(payload as any), tenantId: context.tenantId });
    const gate = evaluateEditorialSignal(signal, (payload as any)?.existingFingerprints);
    return { tenantId: context.tenantId, signal, gate };
  });

  register("genesis.capitalization.compile_plan", "Compile un signal approuvé en contrats d’écriture tenant-bound et signe le plan avec l’autorité capitalization:plan.", {
    context: RequestContext,
    payload: z.unknown()
  }, "capitalization:plan", async ({ context, payload }) => {
    const signal = compileChatSignal({ ...(payload as any), tenantId: context.tenantId });
    const gate = evaluateEditorialSignal(signal, (payload as any)?.existingFingerprints);
    const plan = compileCapitalizationPlan(signal, gate);
    const planHmacSecret = process.env.GENESIS_CAPITALIZATION_PLAN_HMAC_SECRET ?? "";
    const planAttestation = attestCapitalizationPlan(plan, planHmacSecret);
    return { tenantId: context.tenantId, signal, gate, plan, planAttestation };
  });

  register("genesis.capitalization.record_evidence", "Ferme V4-DEC-016 uniquement pour un plan authentifié émis par l’autorité de planification et des reçus attestés par les connecteurs autorisés.", {
    context: RequestContext,
    payload: z.unknown()
  }, "capitalization:evidence", async ({ context, payload }) => {
    const plan = (payload as any)?.plan;
    if (plan?.tenantId !== context.tenantId) throw new Error("CAPITALIZATION_PLAN_TENANT_MISMATCH");

    const planHmacSecret = process.env.GENESIS_CAPITALIZATION_PLAN_HMAC_SECRET ?? "";
    const hmacSecret = process.env.GENESIS_CAPITALIZATION_RECEIPT_HMAC_SECRET ?? "";
    const allowedConnectorIds = process.env.GENESIS_CAPITALIZATION_TRUSTED_CONNECTORS
      ?.split(",")
      .map(value => value.trim())
      .filter(Boolean);
    const proof = recordCapitalizationEvidence(
      plan,
      (payload as any)?.receipts ?? [],
      {
        hmacSecret,
        planHmacSecret,
        planAttestation: (payload as any)?.planAttestation ?? "",
        allowedConnectorIds
      }
    );
    const remePromotion = proof.status === "COMPLETE"
      ? compileRemePromotion(plan, proof, (payload as any)?.remeDestinationRef ?? "R.E.M.E-VAL-001")
      : null;
    return { tenantId: context.tenantId, proof, remePromotion };
  });

  return server;
}

const mode = process.argv.find(v => v.startsWith("--transport="))?.split("=")[1]
  ?? process.env.MCP_TRANSPORT
  ?? "http";

if (mode === "stdio") {
  const server = buildServer();
  await server.connect(new StdioServerTransport());
} else {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "afriagenesis-intelligence-mcp",
      version: PACKAGE_VERSION,
      controlPlaneRevision: CONTROL_PLANE_REVISION,
      genome: GENESIS_V4_REVENUE_ENGINE_ANCHOR.genome,
      revenueEngine: GENESIS_V4_REVENUE_ENGINE_ANCHOR.assetId,
      revenueEngineVersion: GENESIS_V4_REVENUE_ENGINE_ANCHOR.version,
      revenueInnovations: GENESIS_V4_TODAY_INNOVATIONS,
      validationRelay: GENESIS_V4_VALIDATION_RELAY_ANCHOR.policyId,
      worldModelRuntime: GENESIS_V4_WORLD_MODEL_RUNTIME_ANCHOR.proofMode,
      chatgptNativeControlPlane: GENESIS_V4_CHATGPT_CONTROL_PLANE_ANCHOR.assetId,
      livingIntellectualCapitalization: GENESIS_V4_LIVING_INTELLECTUAL_CAPITALIZATION_ANCHOR.assetId,
      capitalizationPlanTrust: GENESIS_V4_LIVING_INTELLECTUAL_CAPITALIZATION_ANCHOR.planTrust,
      capitalizationReceiptTrust: GENESIS_V4_LIVING_INTELLECTUAL_CAPITALIZATION_ANCHOR.receiptTrust
    });
  });

  app.post("/mcp", async (req, res) => {
    const server = buildServer();
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
      if (!res.headersSent) res.status(500).json({ error: "MCP_INTERNAL_ERROR" });
    }
  });

  const port = Number(process.env.PORT ?? 10000);
  app.listen(port, "0.0.0.0", () => {
    console.error(`AFRIAGENESIS MCP HTTP listening on 0.0.0.0:${port}`);
  });
}
