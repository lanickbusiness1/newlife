import { createHash } from "node:crypto";
import type {
  CorridorValueCaptureAssessment,
  CorridorValueCaptureInput
} from "./corridorValueCapture.js";

export interface CorridorPersistenceContext {
  tenantId: string;
  actorId: string;
  agentId: string;
  correlationId: string;
}

export interface CorridorPersistenceConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
}

export interface CorridorPersistenceRequest {
  inputHash: string;
  rpcPayload: {
    p_tenant_id: string;
    p_actor_id: string;
    p_agent_id: string;
    p_correlation_id: string;
    p_input_hash: string;
    p_input: CorridorValueCaptureInput;
    p_assessment: CorridorValueCaptureAssessment;
  };
}

export interface CorridorPersistenceReceipt {
  corridorId: string;
  assessmentId: string;
  inputHash: string;
  idempotent: boolean;
  remeEventCount: number;
}

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => stableJson(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

function requireText(value: string, code: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

export function buildCorridorPersistenceRequest(
  context: CorridorPersistenceContext,
  input: CorridorValueCaptureInput,
  assessment: CorridorValueCaptureAssessment
): CorridorPersistenceRequest {
  const tenantId = requireText(context.tenantId, "CORRIDOR_PERSISTENCE_TENANT_REQUIRED");
  const actorId = requireText(context.actorId, "CORRIDOR_PERSISTENCE_ACTOR_REQUIRED");
  const agentId = requireText(context.agentId, "CORRIDOR_PERSISTENCE_AGENT_REQUIRED");
  const correlationId = requireText(context.correlationId, "CORRIDOR_PERSISTENCE_CORRELATION_REQUIRED");

  const inputHash = createHash("sha256")
    .update(stableJson(input), "utf8")
    .digest("hex");

  return {
    inputHash,
    rpcPayload: {
      p_tenant_id: tenantId,
      p_actor_id: actorId,
      p_agent_id: agentId,
      p_correlation_id: correlationId,
      p_input_hash: inputHash,
      p_input: input,
      p_assessment: assessment
    }
  };
}

export async function persistCorridorAssessmentViaRpc(
  config: CorridorPersistenceConfig,
  context: CorridorPersistenceContext,
  input: CorridorValueCaptureInput,
  assessment: CorridorValueCaptureAssessment,
  fetcher: FetchLike = fetch
): Promise<CorridorPersistenceReceipt> {
  const supabaseUrl = config.supabaseUrl?.trim().replace(/\/+$/, "");
  const serviceRoleKey = config.serviceRoleKey?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("CORRIDOR_PERSISTENCE_CONFIG_REQUIRED");
  }

  const request = buildCorridorPersistenceRequest(context, input, assessment);
  const response = await fetcher(
    `${supabaseUrl}/rest/v1/rpc/persist_corridor_assessment_v1`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(request.rpcPayload)
    }
  );

  if (!response.ok) {
    throw new Error(`CORRIDOR_PERSISTENCE_RPC_FAILED:${response.status}`);
  }

  const data = await response.json() as {
    corridor_uuid?: unknown;
    assessment_uuid?: unknown;
    input_hash?: unknown;
    idempotent?: unknown;
    reme_event_count?: unknown;
  };

  if (
    typeof data.corridor_uuid !== "string" || !data.corridor_uuid ||
    typeof data.assessment_uuid !== "string" || !data.assessment_uuid ||
    typeof data.input_hash !== "string" || !data.input_hash ||
    typeof data.idempotent !== "boolean" ||
    typeof data.reme_event_count !== "number" || !Number.isInteger(data.reme_event_count) || data.reme_event_count < 0
  ) {
    throw new Error("CORRIDOR_PERSISTENCE_INVALID_RECEIPT");
  }

  return {
    corridorId: data.corridor_uuid,
    assessmentId: data.assessment_uuid,
    inputHash: data.input_hash,
    idempotent: data.idempotent,
    remeEventCount: data.reme_event_count
  };
}
