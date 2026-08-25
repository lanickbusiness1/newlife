import { describe, expect, test } from "vitest";
import { assessCorridorValueCapture, type CorridorValueCaptureInput } from "../src/corridorValueCapture";
import {
  buildCorridorPersistenceRequest,
  persistCorridorAssessmentViaRpc,
  type CorridorPersistenceConfig
} from "../src/corridorPersistence";

const input: CorridorValueCaptureInput = {
  corridorId: "east-africa:tanga-lamu-eacop",
  corridorName: "Tanga–Lamu–EACOP",
  countries: ["UG", "TZ", "KE"],
  assetClass: "energy_hub",
  asOf: "2026-08-25T00:00:00Z",
  evidenceRefs: ["evidence:project", "evidence:storage", "evidence:ownership"],
  economicValue: {
    totalEconomicValue: 1000,
    currency: "USD",
    valueComponents: [
      { name: "public_revenue", grossValue: 150, localShare: 1, evidenceRef: "evidence:project" },
      { name: "local_payroll", grossValue: 100, localShare: 0.8, evidenceRef: "evidence:project" },
      { name: "local_procurement", grossValue: 200, localShare: 0.5, evidenceRef: "evidence:storage" },
      { name: "ownership_income", grossValue: 150, localShare: 0.3, evidenceRef: "evidence:ownership" },
      { name: "technology_services", grossValue: 100, localShare: 0.4, evidenceRef: "evidence:ownership" }
    ]
  },
  scores: {
    corridorControl: 80,
    feedstockSecurity: 85,
    infrastructureReadiness: 75,
    marketReach: 80,
    localIndustrialization: 70,
    governanceRisk: 35,
    buyerAccess: 70,
    procurementReadiness: 65
  },
  scoreEvidenceRefs: {
    corridorControl: ["evidence:ownership"],
    feedstockSecurity: ["evidence:project"],
    infrastructureReadiness: ["evidence:storage"],
    marketReach: ["evidence:project"],
    localIndustrialization: ["evidence:ownership"],
    governanceRisk: ["evidence:project"],
    buyerAccess: ["evidence:project"],
    procurementReadiness: ["evidence:project"]
  }
};

const context = {
  tenantId: "tenant:afriagenesis",
  actorId: "actor:ceo",
  agentId: "agent:genesis",
  correlationId: "24cc56e1-1134-45e7-a6fb-6c5eb6b23f29"
};

const config: CorridorPersistenceConfig = {
  supabaseUrl: "https://example.supabase.co",
  serviceRoleKey: "service-role-test-key"
};

describe("V4-DEC-017 corridor persistence adapter", () => {
  test("builds a deterministic append-first RPC request from the validated assessment", () => {
    const assessment = assessCorridorValueCapture(input);
    const first = buildCorridorPersistenceRequest(context, input, assessment);
    const second = buildCorridorPersistenceRequest(context, structuredClone(input), assessment);

    expect(first.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.inputHash).toBe(second.inputHash);
    expect(first.rpcPayload).toMatchObject({
      p_tenant_id: context.tenantId,
      p_actor_id: context.actorId,
      p_agent_id: context.agentId,
      p_correlation_id: context.correlationId,
      p_input: input,
      p_assessment: assessment
    });
  });

  test("fails closed when persistence configuration is absent", async () => {
    const assessment = assessCorridorValueCapture(input);

    await expect(persistCorridorAssessmentViaRpc(
      { supabaseUrl: "", serviceRoleKey: "" },
      context,
      input,
      assessment,
      async () => new Response("{}", { status: 200 })
    )).rejects.toThrow(/CORRIDOR_PERSISTENCE_CONFIG_REQUIRED/);
  });

  test("sends exactly one authenticated RPC call and returns the persistence receipt", async () => {
    const assessment = assessCorridorValueCapture(input);
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({
        corridor_uuid: "d7f722f4-a0d3-4d76-9220-b2d2694cf0bd",
        assessment_uuid: "8cc361ae-9b8c-49bd-ae06-9f6658ce65bd",
        input_hash: "server-hash",
        idempotent: false,
        reme_event_count: 4
      }), { status: 200, headers: { "content-type": "application/json" } });
    };

    const receipt = await persistCorridorAssessmentViaRpc(config, context, input, assessment, fetcher);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://example.supabase.co/rest/v1/rpc/persist_corridor_assessment_v1");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.headers).toMatchObject({
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": "application/json"
    });
    expect(receipt).toMatchObject({
      corridorId: "d7f722f4-a0d3-4d76-9220-b2d2694cf0bd",
      assessmentId: "8cc361ae-9b8c-49bd-ae06-9f6658ce65bd",
      idempotent: false,
      remeEventCount: 4
    });
  });

  test("fails closed on a non-success RPC response without fabricating a receipt", async () => {
    const assessment = assessCorridorValueCapture(input);

    await expect(persistCorridorAssessmentViaRpc(
      config,
      context,
      input,
      assessment,
      async () => new Response(JSON.stringify({ message: "evidence missing" }), { status: 409 })
    )).rejects.toThrow(/CORRIDOR_PERSISTENCE_RPC_FAILED:409/);
  });
});
