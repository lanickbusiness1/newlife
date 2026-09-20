import { z } from "zod";

export const GENESIS_V4_OMNICHANNEL_RUNTIME_ANCHOR = {
  assetId: "GEN-V4-ALWAYS-ON-OMNICHANNEL-RUNTIME-001",
  version: "0.1.0",
  decisionDate: "2026-09-20",
  classification: "EXTEND_EXISTING",
  parent: "GENESIS_V4_CHATGPT_NATIVE_CONTROL_PLANE",
  truthState: "IMPLEMENTATION_CANDIDATE"
} as const;

const SUPPORTED_CHANNELS = [
  "chatgpt",
  "whatsapp",
  "telegram",
  "web",
  "mobile",
  "voice"
] as const;

const ProviderBindingSchema = z.object({
  status: z.enum(["bound", "unbound", "disabled"]),
  provider: z.string().min(1).optional(),
  bindingEvidenceRef: z.string().min(1).optional()
}).superRefine((value, ctx) => {
  if (value.status === "bound" && (!value.provider || !value.bindingEvidenceRef)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "OMNICHANNEL_BOUND_PROVIDER_EVIDENCE_REQUIRED"
    });
  }
});

const OmnichannelInputSchema = z.object({
  tenantId: z.string().min(1),
  actorId: z.string().min(1),
  requestId: z.string().min(1),
  channel: z.enum(SUPPORTED_CHANNELS),
  message: z.string().min(1).optional(),
  dataClassification: z.enum(["public", "internal", "confidential", "restricted"]),
  approvalContext: z.string().min(1).optional(),
  providerBinding: ProviderBindingSchema,
  voice: z.object({
    transcript: z.string().min(1),
    language: z.string().min(2).max(16)
  }).optional()
});

export type OmnichannelInput = z.infer<typeof OmnichannelInputSchema>;

export function compileOmnichannelCommand(input: unknown) {
  const raw = input as Record<string, unknown> | null;
  const channel = raw?.channel;

  if (!SUPPORTED_CHANNELS.includes(channel as (typeof SUPPORTED_CHANNELS)[number])) {
    throw new Error("OMNICHANNEL_CHANNEL_UNSUPPORTED");
  }

  const parsed = OmnichannelInputSchema.parse(input);

  if (parsed.channel === "voice" && !parsed.voice?.transcript) {
    throw new Error("OMNICHANNEL_VOICE_TRANSCRIPT_REQUIRED");
  }

  if (parsed.channel !== "voice" && !parsed.message) {
    throw new Error("OMNICHANNEL_MESSAGE_REQUIRED");
  }

  if (parsed.dataClassification === "restricted" && !parsed.approvalContext) {
    throw new Error("OMNICHANNEL_RESTRICTED_APPROVAL_REQUIRED");
  }

  const provider = parsed.providerBinding.status === "bound"
    ? parsed.providerBinding.provider ?? null
    : null;

  const state = parsed.providerBinding.status === "bound"
    ? "CONNECTOR_BINDING_REQUIRES_RUNTIME_VERIFICATION"
    : parsed.providerBinding.status === "disabled"
      ? "CONNECTOR_DISABLED"
      : "CONNECTOR_UNBOUND";

  const blockers = parsed.providerBinding.status === "bound"
    ? ["PROVIDER_BINDING_NOT_RUNTIME_VERIFIED"]
    : parsed.providerBinding.status === "disabled"
      ? ["PROVIDER_CONNECTOR_DISABLED"]
      : ["PROVIDER_CONNECTOR_NOT_BOUND"];

  return {
    assetId: GENESIS_V4_OMNICHANNEL_RUNTIME_ANCHOR.assetId,
    version: GENESIS_V4_OMNICHANNEL_RUNTIME_ANCHOR.version,
    input: {
      tenantId: parsed.tenantId,
      actorId: parsed.actorId,
      requestId: parsed.requestId,
      channel: parsed.channel,
      normalizedText: parsed.channel === "voice"
        ? parsed.voice!.transcript
        : parsed.message!,
      language: parsed.voice?.language ?? null
    },
    authority: {
      controlPlane: "GENESIS_V4",
      memory: "REME_NOTION_EVIDENCE_LEDGER",
      channelIsMemory: false,
      workerIsAuthority: false
    },
    execution: {
      state,
      provider,
      canDispatchExternally: false,
      bindingEvidenceRef: parsed.providerBinding.bindingEvidenceRef ?? null,
      blockers,
      idempotencyKey: `${parsed.tenantId}:${parsed.requestId}`
    },
    dataHandling: {
      classification: parsed.dataClassification,
      channelPersistence: ["confidential", "restricted"].includes(parsed.dataClassification)
        ? "REFERENCE_ONLY"
        : "TRANSIENT_METADATA_ONLY",
      secretEcho: false,
      approvalContextRequired: parsed.dataClassification === "restricted"
    },
    evidenceContract: {
      correlationRequired: true,
      providerReceiptRequiredForExternalDispatch: true,
      outcomeEvidenceRequired: true
    }
  } as const;
}

const AutonomyBoundarySchema = z.object({
  actionClass: z.enum([
    "internal_reversible",
    "external_reversible",
    "financial",
    "regulated",
    "destructive",
    "external_sensitive"
  ]),
  reversible: z.boolean(),
  approvalPresent: z.boolean()
});

export function evaluateAutonomyBoundary(input: unknown) {
  const parsed = AutonomyBoundarySchema.parse(input);
  const hardHumanBoundary = [
    "financial",
    "regulated",
    "destructive",
    "external_sensitive"
  ].includes(parsed.actionClass);

  if (hardHumanBoundary) {
    return {
      decision: parsed.approvalPresent
        ? "HUMAN_APPROVAL_VERIFICATION_REQUIRED"
        : "HUMAN_APPROVAL_REQUIRED",
      autonomyClass: "A4",
      continueIndependentBranches: true,
      reason: `GENESIS_AUTHORITY_EDGE_${parsed.actionClass.toUpperCase()}`
    } as const;
  }

  if (!parsed.reversible) {
    return {
      decision: parsed.approvalPresent
        ? "HUMAN_APPROVAL_VERIFICATION_REQUIRED"
        : "HUMAN_APPROVAL_REQUIRED",
      autonomyClass: "A4",
      continueIndependentBranches: true,
      reason: "GENESIS_IRREVERSIBLE_ACTION_APPROVAL_REQUIRED"
    } as const;
  }

  return {
    decision: "AUTO_EXECUTE_ALLOWED",
    autonomyClass: "A1_A3",
    continueIndependentBranches: true,
    reason: "REVERSIBLE_WITHIN_DELEGATED_BOUNDARY"
  } as const;
}

const HeartbeatSchema = z.object({
  heartbeatId: z.string().min(1),
  cadenceSeconds: z.number().int().positive(),
  purpose: z.string().min(3),
  enabled: z.boolean()
});

export function compileHeartbeatContract(input: unknown) {
  const parsed = HeartbeatSchema.parse(input);

  if (parsed.cadenceSeconds < 60) {
    throw new Error("OMNICHANNEL_HEARTBEAT_TOO_FREQUENT");
  }

  if (parsed.cadenceSeconds > 86400) {
    throw new Error("OMNICHANNEL_HEARTBEAT_OUT_OF_RANGE");
  }

  return {
    heartbeatId: parsed.heartbeatId,
    mode: "ALWAYS_ON_EVENT_LOOP",
    enabled: parsed.enabled,
    cadenceSeconds: parsed.cadenceSeconds,
    purpose: parsed.purpose,
    requiresDurableState: true,
    requiresIdempotency: true,
    requiresLeaseOrLock: true,
    requiresRetryPolicy: true,
    requiresDeadLetterHandling: true,
    requiresHealthcheck: true,
    requiresRollback: true,
    externalSideEffects: "GOVERNED_SEPARATELY"
  } as const;
}

const WorkerRouteSchema = z.object({
  taskId: z.string().min(1),
  taskClass: z.enum(["extract", "reason", "code", "multimodal", "voice", "control"]),
  dataClassification: z.enum(["public", "internal", "confidential", "restricted"]),
  requiredCapabilities: z.array(z.string().min(1)).default([]),
  candidates: z.array(z.object({
    workerId: z.string().min(1),
    capabilities: z.array(z.string().min(1)),
    allowedClassifications: z.array(z.enum(["public", "internal", "confidential", "restricted"])),
    enabled: z.boolean()
  }))
});

export function compileWorkerRoute(input: unknown) {
  const parsed = WorkerRouteSchema.parse(input);
  const eligible = parsed.candidates.filter(candidate =>
    candidate.enabled
    && candidate.allowedClassifications.includes(parsed.dataClassification)
    && parsed.requiredCapabilities.every(capability => candidate.capabilities.includes(capability))
  );

  const selected = eligible[0];

  if (!selected) {
    return {
      taskId: parsed.taskId,
      decision: "WORKER_UNBOUND",
      workerId: null,
      blockers: ["NO_ELIGIBLE_WORKER"],
      authority: "GENESIS_V4"
    } as const;
  }

  return {
    taskId: parsed.taskId,
    decision: "WORKER_CANDIDATE_SELECTED",
    workerId: selected.workerId,
    blockers: [],
    authority: "GENESIS_V4",
    requiresRegistryVerification: true,
    selectionPolicy: "FIRST_ELIGIBLE_DECLARED_CANDIDATE"
  } as const;
}


const REQUIRED_RUNTIME_LOGICAL_TABLES = [
  "object_events",
  "object_runtime_bindings",
  "object_execution_contexts",
  "loop_instances",
  "loop_actions",
  "loop_results",
  "loop_evidence"
] as const;

const RuntimeReadinessSchema = z.object({
  persistence: z.object({
    backend: z.enum(["canonical_postgres", "unbound"]),
    migrationEvidenceRefs: z.array(z.string().min(1)),
    requiredLogicalTables: z.array(z.string().min(1))
  }),
  provider: z.object({
    status: z.enum(["verified", "unverified"]),
    healthEvidenceRef: z.string().min(1).optional(),
    rollbackEvidenceRef: z.string().min(1).optional(),
    continuityStatus: z.enum(["verified", "payment_failed", "unknown"]).default("unknown"),
    billingEvidenceRef: z.string().min(1).optional()
  }),
  connectors: z.object({
    registryEvidenceRef: z.string().min(1).nullable(),
    secretsManagerEvidenceRef: z.string().min(1).nullable()
  })
});

export function compileRuntimeReadinessCandidate(input: unknown) {
  const parsed = RuntimeReadinessSchema.parse(input);
  const blockers: string[] = [];

  if (parsed.persistence.backend !== "canonical_postgres") {
    blockers.push("CANONICAL_PERSISTENCE_UNBOUND");
  }

  if (parsed.persistence.migrationEvidenceRefs.length === 0) {
    blockers.push("CANONICAL_MIGRATION_EVIDENCE_MISSING");
  }

  const missingTables = REQUIRED_RUNTIME_LOGICAL_TABLES.filter(
    table => !parsed.persistence.requiredLogicalTables.includes(table)
  );
  if (missingTables.length > 0) {
    blockers.push("CANONICAL_RUNTIME_TABLE_EVIDENCE_INCOMPLETE");
  }

  if (
    parsed.provider.status !== "verified"
    || !parsed.provider.healthEvidenceRef
  ) {
    blockers.push("PROVIDER_HEALTH_UNVERIFIED");
  }

  if (!parsed.provider.rollbackEvidenceRef) {
    blockers.push("ROLLBACK_EVIDENCE_MISSING");
  }

  if (parsed.provider.continuityStatus === "payment_failed") {
    blockers.push("PROVIDER_PAYMENT_FAILED");
  } else if (
    parsed.provider.continuityStatus !== "verified"
    || !parsed.provider.billingEvidenceRef
  ) {
    blockers.push("PROVIDER_CONTINUITY_UNVERIFIED");
  }

  if (
    parsed.provider.continuityStatus === "payment_failed"
    && !parsed.provider.billingEvidenceRef
  ) {
    blockers.push("PROVIDER_BILLING_EVIDENCE_MISSING");
  }

  if (!parsed.connectors.registryEvidenceRef) {
    blockers.push("CONNECTOR_REGISTRY_EVIDENCE_MISSING");
  }

  if (!parsed.connectors.secretsManagerEvidenceRef) {
    blockers.push("SECRETS_MANAGER_EVIDENCE_MISSING");
  }

  return {
    assetId: GENESIS_V4_OMNICHANNEL_RUNTIME_ANCHOR.assetId,
    decision: blockers.length === 0
      ? "READY_FOR_M8_RELEASE_REVIEW"
      : "BLOCKED_EVIDENCE_INCOMPLETE",
    blockers,
    missingLogicalTables: missingTables,
    providerContinuityStatus: parsed.provider.continuityStatus,
    billingEvidencePresent: Boolean(parsed.provider.billingEvidenceRef),
    operationalClaimAllowed: false,
    requiredCanonicalSql: [
      "065_enterprise_object_model.sql",
      "070_runtime.sql",
      "071_v4_object_runtime_bridge.sql",
      "072_world_model.sql",
      "074_loop_engineering.sql",
      "076_self_improvement.sql"
    ],
    requiredLogicalTables: [...REQUIRED_RUNTIME_LOGICAL_TABLES],
    evidenceBoundary: "REFERENCES_REQUIRE_INDEPENDENT_VERIFICATION",
    nextTruthStateIfApproved: "RELEASE_CANDIDATE"
  } as const;
}
