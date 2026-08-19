import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  compileControlTransition,
  compileGenesisContext,
  evaluateKnowledgePromotion,
  GENESIS_V4_CHATGPT_CONTROL_PLANE_ANCHOR
} from "../src/chatgptControlPlane";

describe("GENESIS V4 ChatGPT Native Control Plane", () => {
  test("compiles canonical context while keeping ChatGPT memory non-canonical", () => {
    const packet = compileGenesisContext({
      enterprise: { id: "AFRIA-RECRUIT", product: "AfrIA Recruit", stage: "staging" },
      canonicalSources: ["GENOME:V4", "REME:decision-1", "GENOME:V4"],
      worldState: { releaseStatus: "GATES_PENDING" },
      constraints: ["no_duplicate_framework", "human_governance"],
      permissions: ["world:read", "deploy:plan"],
      requiredControls: ["M6", "S7+", "M8"],
      terminalGoal: "DELIVERED_URL",
      commercialGoal: "REVENUE_PROVEN"
    });

    expect(packet.authority.genome).toBe("canonical");
    expect(packet.authority.chatgptMemory).toBe("non_canonical_cache");
    expect(packet.canonicalSources).toEqual(["GENOME:V4", "REME:decision-1"]);
    expect(packet.requiredControls).toEqual(["M6", "S7+", "M8"]);
    expect(packet.contextPacketId).toMatch(/^gctx-/);
  });

  test("compiles a CEO validated command into a governed state transition", () => {
    const packet = compileGenesisContext({
      enterprise: { id: "AFRIA-RECRUIT" },
      canonicalSources: ["GENOME:V4"],
      requiredControls: ["M6", "S7+", "M8"]
    });

    const transition = compileControlTransition({
      who: "AFRIA-RECRUIT",
      state: "GATES_PENDING",
      goal: "DELIVERED_URL",
      why: "CEO_VALIDATED",
      contextPacketId: packet.contextPacketId,
      tools: ["deploybot.validation_relay.compile"],
      limits: ["reversible_only"],
      evidence: ["GENOME:V4"],
      gate: "CEO_VALIDATED"
    });

    expect(transition.status).toBe("READY");
    expect(transition.decision).toBe("EXECUTE_GOVERNED_TRANSITION");
    expect(transition.stateChange).toEqual({ from: "GATES_PENDING", target: "DELIVERED_URL" });
    expect(transition.nextGate).toBe("M6");
  });

  test("fails closed when the control contract is incomplete", () => {
    const transition = compileControlTransition({
      who: "AFRIA-RECRUIT",
      state: "GATES_PENDING",
      goal: "",
      why: "CEO_VALIDATED",
      contextPacketId: "gctx-test",
      tools: [],
      limits: [],
      evidence: [],
      gate: "CEO_VALIDATED"
    });

    expect(transition.status).toBe("BLOCKED");
    expect(transition.nextGate).toBe("CONTEXT_REPAIR");
    expect(transition.blockers).toEqual(expect.arrayContaining([
      "missing:goal",
      "missing:tools",
      "missing:evidence"
    ]));
  });

  test("allows evidence-backed world-model promotion but gates canonical memory", () => {
    const worldCandidate = evaluateKnowledgePromotion({
      candidateId: "signal-1",
      source: "deep-research",
      requestedTarget: "world_model",
      evidenceRefs: ["web:primary:1"],
      confidence: 0.82
    });
    expect(worldCandidate.status).toBe("PROMOTABLE");

    const remeCandidate = evaluateKnowledgePromotion({
      candidateId: "learning-1",
      source: "world-model-outcome",
      requestedTarget: "reme",
      evidenceRefs: ["evidence:outcome:1"],
      confidence: 0.9,
      controls: { m6Passed: false, outcomeEvaluated: true }
    });
    expect(remeCandidate.status).toBe("REVIEW_REQUIRED");
  });

  test("never lets ChatGPT memory bypass GENOME gates", () => {
    const blocked = evaluateKnowledgePromotion({
      candidateId: "candidate-1",
      source: "chatgpt-memory",
      requestedTarget: "genome",
      evidenceRefs: ["chat:1"],
      confidence: 0.95,
      controls: { m8Passed: false, ceoValidated: false }
    });

    expect(blocked.status).toBe("REVIEW_REQUIRED");
    expect(blocked.reasons).toContain("chatgpt_memory_never_bypasses_canonical_gates");

    const approved = evaluateKnowledgePromotion({
      candidateId: "candidate-2",
      source: "notion-canonical",
      requestedTarget: "genome",
      evidenceRefs: ["notion:decision:1"],
      confidence: 1,
      controls: { m8Passed: true, ceoValidated: true }
    });
    expect(approved.status).toBe("PROMOTABLE");
  });

  test("exposes the three governed MCP tools with distinct least-privilege scopes", () => {
    const indexSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

    expect(indexSource).toContain('register("genesis.context.compile"');
    expect(indexSource).toContain('"context:compile"');
    expect(indexSource).toContain('register("genesis.control.compile_transition"');
    expect(indexSource).toContain('"control:compile"');
    expect(indexSource).toContain('register("genesis.knowledge.evaluate_promotion"');
    expect(indexSource).toContain('"knowledge:promote"');
    expect(GENESIS_V4_CHATGPT_CONTROL_PLANE_ANCHOR.mode).toBe("extension_not_framework");
  });
});
