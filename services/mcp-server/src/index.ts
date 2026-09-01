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
import { compileDeploymentRequest } from "./deploymentOrchestrator.js";
import { compileDomainIntent } from "./domainManager.js";
import { compileReleaseEvidenceBundle, verifyReleaseEvidenceBundle } from "./releaseCenter.js";
import { compileComputeEconomicsPlan, verifyAiEconomicsCertificate } from "./computeEconomics.js";
import {
  MARKET_CAPTURE_TOOL_SCOPES,
  calculateRMCC,
  compileMarketCaptureCell,
  decideCellScale,
  qualifyLead
} from "./marketCapture.js";
import {
  compileAssuranceReport,
  compileIndependentAssurance,
  verifyIndependentAssurance
} from "./independentAssurance.js";
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

const PACKAGE_VERSION = "0.6.0";
const CONTROL_PLANE_REVISION = "0.9.0";
const SOVEREIGN_DELIVERY_RUNTIME = "DEPLOYBOT_SOVEREIGN_DELIVERY_RUNTIME_0.6.0";
const COMPUTE_INFERENCE_ECONOMICS_LAYER = "COMPUTE_INFERENCE_ECONOMICS_LAYER_0.5.0";
const DISTRIBUTED_MARKET_CAPTURE_LAYER = "DISTRIBUTED_MARKET_CAPTURE_LAYER_0.1.0";
const RELEASE_EVIDENCE_SCHEMA = "1.2.0";
const INDEPENDENT_ASSURANCE_COUNCIL = "INDEPENDENT_ASSURANCE_COUNCIL_1.0.0";

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
      reason: "Scope validated; GENESIS V4 governed control plane active with Revenue Engine, Sovereign Delivery Runtime, Compute & Inference Economics Control Layer and Independent Assurance Council."
    },
    auditId,
    limitations: [
      "MCP package 0.6.0 / control-plane revision 0.9.0: internal agentic assurance is an internal rigor proof, not a statutory audit, certification or external attestation. Production proof still requires observed provider, DNS/HTTPS, rollback and economics evidence."
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

  register("genesis.market_capture.compile_cell", "Compile une Market Capture Cell provider-neutral et applique les invariants de vérité avant activation.", {
    context: RequestContext,
    payload: z.unknown()
  }, MARKET_CAPTURE_TOOL_SCOPES["genesis.market_capture.compile_cell"], async ({ context, payload }) => ({
    tenantId: context.tenantId,
    cell: compileMarketCaptureCell(payload as any)
  }));

  register("genesis.market_capture.qualify_lead", "Qualifie un lead uniquement à partir d'observations explicites sans fabriquer les champs absents.", {
    context: RequestContext,
    payload: z.unknown()
  }, MARKET_CAPTURE_TOOL_SCOPES["genesis.market_capture.qualify_lead"], async ({ context, payload }) => ({
    tenantId: context.tenantId,
    qualification: qualifyLead(payload as any)
  }));

  register("genesis.market_capture.evaluate_economics", "Calcule RMCC et ratios secondaires uniquement à partir des valeurs économiques observées fournies.", {
    context: RequestContext,
    payload: z.unknown()
  }, MARKET_CAPTURE_TOOL_SCOPES["genesis.market_capture.evaluate_economics"], async ({ context, payload }) => ({
    tenantId: context.tenantId,
    economics: calculateRMCC(payload as any)
  }));

  register("genesis.market_capture.decide_scale", "Décide KILL, HOLD ou SCALE selon les invariants M8 et les seuils économiques déterministes approuvés.", {
    context: RequestContext,
    payload: z.unknown()
  }, MARKET_CAPTURE_TOOL_SCOPES["genesis.market_capture.decide_scale"], async ({ context, payload }) => ({
    tenantId: context.tenantId,
    decision: decideCellScale(payload as any)
  }));

  register("deploybot.validation_relay.compile", "Compile une validation CEO en state machine DeployBot A1-A3 jusqu’au livrable final ou veto A4.", {
    context: RequestContext,
    payload: z.unknown()
  }, "deploy:plan", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    ...compileValidationRelay(payload)
  }));

  register("deploybot.deployment.compile", "Compile un contrat de déploiement provider-neutral avec gate de souveraineté.", {
    context: RequestContext,
    payload: z.unknown()
  }, "deploy:plan", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    deployment: compileDeploymentRequest(payload as any)
  }));

  register("deploybot.domain.compile", "Compile l'intention DNS canonique *.afriagenesis.com pour un environnement DeployBot.", {
    context: RequestContext,
    payload: z.unknown()
  }, "deploy:plan", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    domain: compileDomainIntent(payload as any)
  }));

  register("deploybot.compute.compile", "Calcule et sélectionne le meilleur couple modèle/compute selon coût, qualité, latence, souveraineté, énergie et marge.", {
    context: RequestContext,
    payload: z.unknown()
  }, "deploy:plan", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    computePlan: compileComputeEconomicsPlan(payload as any)
  }));

  register("deploybot.compute.verify_certificate", "Vérifie l'intégrité SHA-256 d'un AI Economics Certificate avant son inclusion au Release Evidence Bundle.", {
    context: RequestContext,
    payload: z.unknown()
  }, "deploy:plan", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    verification: verifyAiEconomicsCertificate((payload as any)?.certificate)
  }));

  register("deploybot.assurance.compile_report", "Scelle un rapport d'audit interne du Independent Assurance Council avec snapshot, findings et SHA-256.", {
    context: RequestContext,
    payload: z.unknown()
  }, "deploy:plan", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    report: compileAssuranceReport(payload as any)
  }));

  register("deploybot.assurance.compile_council", "Compile les cinq rapports spécialistes et l'arbitre en verdict d'assurance indépendant fail-closed.", {
    context: RequestContext,
    payload: z.unknown()
  }, "deploy:plan", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    assurance: compileIndependentAssurance(payload as any)
  }));

  register("deploybot.assurance.verify", "Vérifie l'intégrité et les invariants d'une preuve Independent Assurance Council avant release.", {
    context: RequestContext,
    payload: z.unknown()
  }, "deploy:plan", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    verification: verifyIndependentAssurance((payload as any)?.evidence)
  }));

  register("deploybot.release.compile", "Compile un Release Evidence Bundle immuable et hashé incluant économie IA et assurance indépendante avant livraison terminale.", {
    context: RequestContext,
    payload: z.unknown()
  }, "deploy:plan", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    release: compileReleaseEvidenceBundle(payload as any)
  }));

  register("deploybot.release.verify", "Vérifie l'intégrité, l'AI Economics Certificate et les gates d'assurance d'un Release Evidence Bundle avant DELIVERED_*.", {
    context: RequestContext,
    payload: z.unknown()
  }, "deploy:plan", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    verification: verifyReleaseEvidenceBundle((payload as any)?.bundle, (payload as any)?.policy)
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
      sovereignDeliveryRuntime: SOVEREIGN_DELIVERY_RUNTIME,
      computeInferenceEconomicsLayer: COMPUTE_INFERENCE_ECONOMICS_LAYER,
      distributedMarketCaptureLayer: DISTRIBUTED_MARKET_CAPTURE_LAYER,
      independentAssuranceCouncil: INDEPENDENT_ASSURANCE_COUNCIL,
      releaseEvidenceSchema: RELEASE_EVIDENCE_SCHEMA,
      worldModelRuntime: GENESIS_V4_WORLD_MODEL_RUNTIME_ANCHOR.proofMode,
      chatgptNativeControlPlane: GENESIS_V4_CHATGPT_CONTROL_PLANE_ANCHOR.assetId
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