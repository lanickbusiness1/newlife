import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  GENESIS_V4_MODEL_ROUTING_ANCHOR,
  routeOpenAIWorkload
} from "../src/modelRoutingPolicy";

describe("ADR-V4-AI-ROUTING-002 GPT-6 routing policy", () => {
  test("routes simple low-risk work to Luna", () => {
    const decision = routeOpenAIWorkload({
      workloadId: "signal-classification",
      complexity: "simple",
      risk: "low",
      dataClassification: "public",
      priority: "cost"
    });

    expect(decision.primaryModel).toBe("gpt-6-luna");
    expect(decision.fallbackModel).toBeNull();
    expect(decision.verificationPolicy).toBe("STANDARD");
  });

  test("routes balanced production work to Sol", () => {
    const decision = routeOpenAIWorkload({
      workloadId: "proposal-draft",
      complexity: "advanced",
      risk: "medium",
      dataClassification: "internal",
      priority: "balanced"
    });

    expect(decision.primaryModel).toBe("gpt-6-sol");
    expect(decision.fallbackModel).toBe("gpt-6-luna");
    expect(decision.priceSignal).toBe("GPT6_SOL_LUNA_50_PERCENT_BELOW_GPT56_PROMOTIONAL");
  });

  test("routes frontier or critical work to Astra", () => {
    const decision = routeOpenAIWorkload({
      workloadId: "institutional-security-review",
      complexity: "frontier",
      risk: "critical",
      dataClassification: "internal",
      priority: "capability"
    });

    expect(decision.primaryModel).toBe("gpt-6-astra");
    expect(decision.fallbackModel).toBe("gpt-6-sol");
    expect(decision.verificationPolicy).toBe("INDEPENDENT_REVIEW");
  });

  test("fails closed for confidential data without provider approval", () => {
    expect(() => routeOpenAIWorkload({
      workloadId: "candidate-data",
      complexity: "standard",
      risk: "high",
      dataClassification: "confidential",
      priority: "balanced"
    })).toThrow(/MODEL_ROUTING_CONTROLLED_PROVIDER_REQUIRED/);
  });

  test("requires explicit approval context for restricted data", () => {
    expect(() => routeOpenAIWorkload({
      workloadId: "sovereign-record",
      complexity: "advanced",
      risk: "critical",
      dataClassification: "restricted",
      priority: "capability",
      providerApprovedForClassification: true
    })).toThrow(/MODEL_ROUTING_APPROVAL_CONTEXT_REQUIRED/);

    const approved = routeOpenAIWorkload({
      workloadId: "sovereign-record",
      complexity: "advanced",
      risk: "critical",
      dataClassification: "restricted",
      priority: "capability",
      providerApprovedForClassification: true,
      approvalContext: "M8-APPROVAL-2026-09-23"
    });

    expect(approved.executionSubstrate).toBe("CONTROLLED_PROVIDER");
    expect(approved.verificationPolicy).toBe("HUMAN_APPROVAL_AND_INDEPENDENT_REVIEW");
  });

  test("keeps official evidence refs and a bounded truth state", () => {
    const decision = routeOpenAIWorkload({
      workloadId: "public-summary",
      complexity: "simple",
      risk: "low",
      dataClassification: "public",
      priority: "cost"
    });

    expect(decision.evidenceRefs).toEqual(GENESIS_V4_MODEL_ROUTING_ANCHOR.sources);
    expect(decision.truthState).toBe("ROUTING_DECISION_ONLY");
  });

  test("exposes the governed router through MCP and health", () => {
    const indexSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

    expect(indexSource).toContain('register("genesis.model.route"');
    expect(indexSource).toContain('"model:route"');
    expect(indexSource).toContain("modelRoutingPolicyVersion");
  });
});
