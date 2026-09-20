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
  provider: z.string().min(1).optional()
}).superRefine((value, ctx) => {
  if (value.status === "bound" && !value.provider) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "OMNICHANNEL_BOUND_PROVIDER_REQUIRED"
    });
  }
});

const OmnichannelInputSchema = z.object({
  tenantId: z.string().min(1),
  actorId: z.string().min(1),
  requestId: z.string().min(1),
  channel: z.enum(SUPPORTED_CHANNELS),
  message: z.string().min(1),
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

  if (parsed.dataClassification === "restricted" && !parsed.approvalContext) {
    throw new Error("OMNICHANNEL_RESTRICTED_APPROVAL_REQUIRED");
  }

  const provider = parsed.providerBinding.status === "bound"
    ? parsed.providerBinding.provider ?? null
    : null;

  const state = parsed.providerBinding.status === "bound"
    ? "READY_FOR_AUTHORIZED_DISPATCH"
    : parsed.providerBinding.status === "disabled"
      ? "CONNECTOR_DISABLED"
      : "CONNECTOR_UNBOUND";

  const blockers = parsed.providerBinding.status === "bound"
    ? []
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
        : parsed.message,
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
      canDispatchExternally: parsed.providerBinding.status === "bound",
      blockers,
      idempotencyKey: `${parsed.tenantId}:${parsed.requestId}`
    },
    dataHandling: {
      classification: parsed.dataClassification,
      channelPersistence: parsed.dataClassification === "restricted"
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

  if (hardHumanBoundary && !parsed.approvalPresent) {
    return {
      decision: "HUMAN_APPROVAL_REQUIRED",
      autonomyClass: "A4",
      continueIndependentBranches: true,
      reason: `GENESIS_AUTHORITY_EDGE_${parsed.actionClass.toUpperCase()}`
    } as const;
  }

  if (!parsed.reversible && !parsed.approvalPresent) {
    return {
      decision: "HUMAN_APPROVAL_REQUIRED",
      autonomyClass: "A4",
      continueIndependentBranches: true,
      reason: "GENESIS_IRREVERSIBLE_ACTION_APPROVAL_REQUIRED"
    } as const;
  }

  return {
    decision: parsed.approvalPresent
      ? "APPROVED_EXECUTION_ALLOWED"
      : "AUTO_EXECUTE_ALLOWED",
    autonomyClass: "A1_A3",
    continueIndependentBranches: true,
    reason: parsed.approvalPresent
      ? "EXPLICIT_AUTHORITY_PRESENT"
      : "REVERSIBLE_WITHIN_DELEGATED_BOUNDARY"
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

  if (eligible.length === 0) {
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
    decision: "WORKER_SELECTED",
    workerId: eligible[0].workerId,
    blockers: [],
    authority: "GENESIS_V4",
    selectionPolicy: "FIRST_ELIGIBLE_DECLARED_CANDIDATE"
  } as const;
}
