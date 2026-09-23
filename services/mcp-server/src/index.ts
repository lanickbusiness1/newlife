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
  compileCommunicationRoute,
  evaluateCommunicationProvider,
  GENESIS_V4_SOVEREIGN_COMMS_ANCHOR
} from "./communicationControlPlane.js";
import {
  adaptEduaRepresentation,
  GENESIS_V4_REPRESENTATION_RESOLVER_ANCHOR,
  resolveRepresentation
} from "./representationResolver.js";
import {
  EDUA_PHOTOSYNTHESIS_ARTIFACT,
  evaluateLearningOutcome,
  renderPhotosynthesisArtifact
} from "./eduaInteractiveRenderer.js";
import {
  compileRepresentationArtifact,
  GENESIS_REPRESENTATION_COMPILER_PROFILE
} from "./representationArtifactCompiler.js";
import {
  compileRepresentationFromEvidence,
  GENESIS_EVIDENCE_TO_CONTENT_ADAPTER
} from "./representationEvidenceAdapter.js";
import {
  OPENAI_CAPABILITY_REGISTRY_VERSION,
  recommendCreationCapabilities
} from "./openAICapabilityRegistry.js";
import {
  GENESIS_V4_MODEL_ROUTING_ANCHOR,
  routeOpenAIWorkload
} from "./modelRoutingPolicy.js";
import {
  compileNistCsfAiAssessment,
  NIST_CSF_AI_ASSESSMENT_ANCHOR
} from "./nistCsfAiAssessment.js";

const PACKAGE_VERSION = "0.3.0";
const CONTROL_PLANE_REVISION = "0.15.0";

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
    eces: { status: "allowed", gate: "G8.3", reason: "Scope validated; GENESIS V4 governed control plane active with Revenue Engine v0.3.0." },
    auditId,
    limitations: ["MCP package 0.3.0 / control-plane revision 0.15.0: Revenue Engine, World Model Runtime, ChatGPT Native Control Plane, Representation Resolver, Representation Compiler Profile, Evidence Adapter, OpenAI Capability Registry, GPT-6 Model Routing Policy, NIST CSF AI Assessment Control and Cross-Pipeline Auto Representation are deterministic; external CRM, payment providers, provider-specific renderers, model-provider execution and canonical SQL persistence execute only when separately connected, migrated and authorized. NIST CSF AI outputs are drafts and never constitute cybersecurity assurance without human validation and referenced evidence."]
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

  register("representation.resolve", "Sélectionne et compose la représentation la plus adaptée à l’intention, au domaine et aux contraintes explicites, sans revendiquer l’efficacité avant mesure.", {
    context: RequestContext,
    payload: z.unknown()
  }, "representation:resolve", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    resolution: resolveRepresentation(payload as any)
  }));

  register("edua.representation.resolve", "Adapte V4-DEC-042 à EDUA V2 avec compréhension mesurée comme North Star.", {
    context: RequestContext,
    payload: z.unknown()
  }, "education:represent", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    resolution: adaptEduaRepresentation(payload as any)
  }));

  register("representation.artifact.compile", "Compile une décision du Representation Resolver et un contenu structuré sourcé en artifact HTML autonome avec manifest de traçabilité.", {
    context: RequestContext,
    payload: z.unknown()
  }, "representation:compile", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    compilation: compileRepresentationArtifact(payload as any)
  }));

  register("representation.evidence.compile", "Transforme un Evidence Packet sourcé en contenu structuré, résout la représentation et compile l'artifact sans inventer de faits manquants.", {
    context: RequestContext,
    payload: z.unknown()
  }, "representation:evidence:compile", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    result: compileRepresentationFromEvidence(payload as any)
  }));

  register("representation.capabilities.recommend", "Recommande automatiquement les capacités OpenAI documentées et recettes GENESIS adaptées au flux de création, avec confiance et politique d'exécution.", {
    context: RequestContext,
    payload: z.unknown()
  }, "representation:capabilities:recommend", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    recommendation: recommendCreationCapabilities(payload as any)
  }));

  register("genesis.model.route", "Route un workload vers GPT-6 Luna, Sol ou Astra selon complexité, risque, classification des données, coût et exigences de vérification.", {
    context: RequestContext,
    payload: z.unknown()
  }, "model:route", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    decision: routeOpenAIWorkload(payload as any)
  }));

  register("cyberaudit.csf_ai.compile", "Compile un plan d'assessment CSF 2.0 assisté par IA selon NIST SP 1353, avec couverture de preuves, hypothèses et lacunes explicites, sans claim d'assurance.", {
    context: RequestContext,
    payload: z.unknown()
  }, "cyber:audit:compile", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    plan: compileNistCsfAiAssessment(payload as any)
  }));

  register("edua.learning.evaluate_outcome", "Mesure un delta de compréhension de session EDUA et émet un candidat R.E.M.E borné sans revendiquer de causalité.", {
    context: RequestContext,
    payload: z.unknown()
  }, "education:measure", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    evaluation: evaluateLearningOutcome(payload as any)
  }));

  register("comms.provider.evaluate", "Évalue un fournisseur de communication selon les exigences de souveraineté et le niveau de preuve disponible.", {
    context: RequestContext,
    provider: z.unknown(),
    requirements: z.unknown()
  }, "comms:evaluate", async ({ context, provider, requirements }) => ({
    tenantId: context.tenantId,
    evaluation: evaluateCommunicationProvider(provider as any, requirements as any)
  }));

  register("comms.route.compile", "Compile une route de communication souveraine substituable sans transformer un fournisseur en dépendance structurelle.", {
    context: RequestContext,
    payload: z.unknown()
  }, "comms:route", async ({ context, payload }) => ({
    tenantId: context.tenantId,
    route: compileCommunicationRoute(payload as any)
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

  app.get("/demo/edua/photosynthesis", (req, res) => {
    const language = req.query.lang === "en" ? "en" : "fr";
    const learnerLevel = typeof req.query.level === "string" && req.query.level.trim()
      ? req.query.level.trim().slice(0, 64)
      : "secondary";

    res.type("html").send(renderPhotosynthesisArtifact({
      language,
      learnerLevel,
      representationEventId: "repr-demo-photosynthesis-v1"
    }));
  });

  app.post("/api/edua/outcome", (req, res) => {
    try {
      res.json({
        status: "measured",
        persistence: "none",
        evaluation: evaluateLearningOutcome(req.body)
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "EDUA_OUTCOME_INVALID_INPUT"
      });
    }
  });

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
      sovereignCommsControlPlane: GENESIS_V4_SOVEREIGN_COMMS_ANCHOR.capabilityId,
      representationResolver: GENESIS_V4_REPRESENTATION_RESOLVER_ANCHOR.decisionId,
      representationTruthState: GENESIS_V4_REPRESENTATION_RESOLVER_ANCHOR.truthState,
      eduaInteractiveArtifact: EDUA_PHOTOSYNTHESIS_ARTIFACT.assetId,
      eduaInteractiveTruthState: EDUA_PHOTOSYNTHESIS_ARTIFACT.truthState,
      representationCompilerProfile: GENESIS_REPRESENTATION_COMPILER_PROFILE.profileId,
      representationCompilerTruthState: GENESIS_REPRESENTATION_COMPILER_PROFILE.truthState,
      representationEvidenceAdapter: GENESIS_EVIDENCE_TO_CONTENT_ADAPTER.adapterId,
      representationEvidenceTruthState: GENESIS_EVIDENCE_TO_CONTENT_ADAPTER.truthState,
      openAICapabilityRegistryVersion: OPENAI_CAPABILITY_REGISTRY_VERSION,
      modelRoutingPolicyVersion: GENESIS_V4_MODEL_ROUTING_ANCHOR.policyVersion,
      modelRoutingTruthState: GENESIS_V4_MODEL_ROUTING_ANCHOR.truthState,
      nistCsfAiAssessmentPolicy: NIST_CSF_AI_ASSESSMENT_ANCHOR.publication,
      nistCsfAiAssessmentTruthState: NIST_CSF_AI_ASSESSMENT_ANCHOR.truthState,
      crossPipelineAutoRepresentationPolicy: "V4-DEC-042A"
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
