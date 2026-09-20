import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  compileHeartbeatContract,
  compileOmnichannelCommand,
  compileWorkerRoute,
  evaluateAutonomyBoundary,
  GENESIS_V4_OMNICHANNEL_RUNTIME_ANCHOR
} from "../src/omnichannelRuntime";

const base = {
  tenantId: "afrIAgenesis",
  actorId: "ceo-lanick",
  requestId: "req-2026-09-20-001",
  channel: "telegram" as const,
  message: "Prépare le brief exécutif du jour",
  dataClassification: "internal" as const,
  providerBinding: {
    status: "unbound" as const
  }
};

describe("GENESIS V4 Always-On Omnichannel Runtime", () => {
  test("keeps one governed brain across channels", () => {
    const result = compileOmnichannelCommand(base);

    expect(result.assetId).toBe(GENESIS_V4_OMNICHANNEL_RUNTIME_ANCHOR.assetId);
    expect(result.authority.memory).toBe("REME_NOTION_EVIDENCE_LEDGER");
    expect(result.authority.channelIsMemory).toBe(false);
    expect(result.execution.state).toBe("CONNECTOR_UNBOUND");
  });

  test("normalizes voice as a channel adapter without making voice the authority", () => {
    const result = compileOmnichannelCommand({
      ...base,
      requestId: "req-voice-001",
      channel: "voice",
      voice: {
        transcript: "Donne-moi les priorités P0",
        language: "fr"
      }
    });

    expect(result.input.channel).toBe("voice");
    expect(result.input.normalizedText).toBe("Donne-moi les priorités P0");
    expect(result.authority.controlPlane).toBe("GENESIS_V4");
  });

  test("fails closed on unsupported channels", () => {
    expect(() =>
      compileOmnichannelCommand({
        ...base,
        channel: "sms" as never
      })
    ).toThrow("OMNICHANNEL_CHANNEL_UNSUPPORTED");
  });

  test("never invents a connected provider", () => {
    const result = compileOmnichannelCommand(base);

    expect(result.execution.provider).toBeNull();
    expect(result.execution.canDispatchExternally).toBe(false);
    expect(result.execution.blockers).toContain("PROVIDER_CONNECTOR_NOT_BOUND");
  });

  test("does not trust a self-asserted provider binding as runtime proof", () => {
    const result = compileOmnichannelCommand({
      ...base,
      requestId: "req-bound-unverified-001",
      providerBinding: {
        status: "bound",
        provider: "telegram-bot-api",
        bindingEvidenceRef: "connector-registry://telegram/prod"
      }
    });

    expect(result.execution.state).toBe("CONNECTOR_BINDING_REQUIRES_RUNTIME_VERIFICATION");
    expect(result.execution.canDispatchExternally).toBe(false);
    expect(result.execution.blockers).toContain("PROVIDER_BINDING_NOT_RUNTIME_VERIFIED");
  });

  test("requires provider evidence when a binding is declared", () => {
    expect(() =>
      compileOmnichannelCommand({
        ...base,
        requestId: "req-bound-no-proof",
        providerBinding: {
          status: "bound",
          provider: "telegram-bot-api"
        }
      })
    ).toThrow();
  });

  test("requires human authority for regulated, financial, destructive or sensitive external actions", () => {
    for (const actionClass of ["financial", "regulated", "destructive", "external_sensitive"] as const) {
      const result = evaluateAutonomyBoundary({
        actionClass,
        reversible: actionClass !== "destructive",
        approvalPresent: false
      });
      expect(result.decision).toBe("HUMAN_APPROVAL_REQUIRED");
    }
  });

  test("continues reversible internal work without micro-validation", () => {
    const result = evaluateAutonomyBoundary({
      actionClass: "internal_reversible",
      reversible: true,
      approvalPresent: false
    });

    expect(result.decision).toBe("AUTO_EXECUTE_ALLOWED");
    expect(result.autonomyClass).toBe("A1_A3");
  });

  test("compiles an always-on heartbeat contract with bounded cadence", () => {
    const heartbeat = compileHeartbeatContract({
      heartbeatId: "hb-genesis-001",
      cadenceSeconds: 300,
      purpose: "resume_pending_authorized_work",
      enabled: true
    });

    expect(heartbeat.mode).toBe("ALWAYS_ON_EVENT_LOOP");
    expect(heartbeat.cadenceSeconds).toBe(300);
    expect(heartbeat.requiresDurableState).toBe(true);
    expect(heartbeat.requiresIdempotency).toBe(true);
  });

  test("rejects heartbeat cadences below the minimum safety floor", () => {
    expect(() =>
      compileHeartbeatContract({
        heartbeatId: "hb-genesis-too-fast",
        cadenceSeconds: 10,
        purpose: "unsafe_polling",
        enabled: true
      })
    ).toThrow("OMNICHANNEL_HEARTBEAT_TOO_FREQUENT");
  });

  test("keeps worker selection provider-neutral and GENESIS-authoritative", () => {
    const result = compileWorkerRoute({
      taskId: "task-code-001",
      taskClass: "code",
      dataClassification: "internal",
      requiredCapabilities: ["typescript", "repo_write"],
      candidates: [
        {
          workerId: "codex-worker",
          capabilities: ["typescript", "repo_write"],
          allowedClassifications: ["public", "internal"],
          enabled: true
        },
        {
          workerId: "local-worker",
          capabilities: ["typescript"],
          allowedClassifications: ["public", "internal", "confidential"],
          enabled: true
        }
      ]
    });

    expect(result.decision).toBe("WORKER_SELECTED");
    expect(result.workerId).toBe("codex-worker");
    expect(result.authority).toBe("GENESIS_V4");
  });

  test("fails closed when no worker is eligible", () => {
    const result = compileWorkerRoute({
      taskId: "task-restricted-001",
      taskClass: "reason",
      dataClassification: "restricted",
      requiredCapabilities: ["sovereign_reasoning"],
      candidates: [
        {
          workerId: "external-worker",
          capabilities: ["sovereign_reasoning"],
          allowedClassifications: ["public", "internal"],
          enabled: true
        }
      ]
    });

    expect(result.decision).toBe("WORKER_UNBOUND");
    expect(result.blockers).toContain("NO_ELIGIBLE_WORKER");
  });

  test("exposes all four governed runtime tools through the existing MCP server", () => {
    const indexSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

    expect(indexSource).toContain('register("genesis.omnichannel.compile"');
    expect(indexSource).toContain('register("genesis.autonomy.evaluate"');
    expect(indexSource).toContain('register("genesis.heartbeat.compile"');
    expect(indexSource).toContain('register("genesis.worker.route"');
    expect(indexSource).toContain("GENESIS_V4_OMNICHANNEL_RUNTIME_ANCHOR");
  });

  test("restricted data is reference-only at the channel boundary", () => {
    const result = compileOmnichannelCommand({
      ...base,
      requestId: "req-restricted-001",
      dataClassification: "restricted",
      approvalContext: "M8-approved-context-reference"
    });

    expect(result.dataHandling.channelPersistence).toBe("REFERENCE_ONLY");
    expect(result.dataHandling.secretEcho).toBe(false);
  });
});
