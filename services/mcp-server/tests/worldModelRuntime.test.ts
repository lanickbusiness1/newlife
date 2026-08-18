import { describe, expect, test } from "vitest";
import {
  decideNextAction,
  evaluateOutcome,
  reconstructWorldState,
  simulateScenarios,
  type StrategyScenario,
  type WorldObservation
} from "../src/worldModelRuntime";

const observations: WorldObservation[] = [
  {
    id: "obs-product-proof",
    entityKey: "afria-recruit",
    layer: "internal_state",
    metric: "proof_readiness",
    value: 0.82,
    confidence: 0.95,
    observedAt: "2026-08-18T12:00:00Z",
    sourceRef: "notion:PRD-RECRUIT-001",
    evidenceRef: "evidence:ci-31990909738"
  },
  {
    id: "obs-market-priority",
    entityKey: "b2b-market",
    layer: "external_environment",
    metric: "buyer_urgency",
    value: 0.7,
    confidence: 0.8,
    observedAt: "2026-08-18T12:05:00Z",
    sourceRef: "fixture:afria-recruit-auto-gtm",
    evidenceRef: "synthetic:evidence:buyer-urgency"
  }
];

const scenarios: StrategyScenario[] = [
  {
    id: "linkedin-direct",
    label: "LinkedIn direct",
    channel: "linkedin",
    expectedConversion: 0.34,
    expectedRevenue: 5000,
    cost: 120,
    risk: 0.1,
    confidence: 0.7,
    reversibility: true,
    constraints: ["sandbox-only"],
    evidenceRefs: ["synthetic:evidence:linkedin"]
  },
  {
    id: "institutional-email",
    label: "Institutional email",
    channel: "email",
    expectedConversion: 0.27,
    expectedRevenue: 6500,
    cost: 160,
    risk: 0.25,
    confidence: 0.65,
    reversibility: true,
    constraints: ["draft-only", "no-send"],
    evidenceRefs: ["synthetic:evidence:email"]
  },
  {
    id: "recruiter-partner",
    label: "Recruiter / partner",
    channel: "partner",
    expectedConversion: 0.46,
    expectedRevenue: 10000,
    cost: 450,
    risk: 0.12,
    confidence: 0.8,
    reversibility: true,
    constraints: ["sandbox-crm"],
    evidenceRefs: ["synthetic:evidence:partner"]
  }
];

describe("GENESIS V4 World Model Runtime", () => {
  test("rejects observations whose confidence is outside 0..1", () => {
    expect(() => reconstructWorldState([
      { ...observations[0]!, confidence: 1.01 }
    ])).toThrow(/WORLD_MODEL_INVALID_CONFIDENCE/);
  });

  test("reconstructs state without losing evidence lineage", () => {
    const state = reconstructWorldState(observations);

    expect(state.facts).toHaveLength(2);
    expect(state.evidenceRefs).toEqual(expect.arrayContaining([
      "evidence:ci-31990909738",
      "synthetic:evidence:buyer-urgency"
    ]));
    expect(state.confidence).toBeCloseTo(0.875, 3);
  });

  test("simulates and ranks explicit scenarios deterministically", () => {
    const state = reconstructWorldState(observations);
    const results = simulateScenarios(state, scenarios);

    expect(results).toHaveLength(3);
    expect(results[0]?.scenarioId).toBe("recruiter-partner");
    expect(results[0]?.rank).toBe(1);
    expect(results.map(result => result.utility)).toEqual(
      [...results.map(result => result.utility)].sort((a, b) => b - a)
    );
  });

  test("will not autonomously select a non-reversible scenario", () => {
    const state = reconstructWorldState(observations);
    const results = simulateScenarios(state, [
      ...scenarios,
      {
        id: "irreversible-broadcast",
        label: "Irreversible mass broadcast",
        channel: "external-broadcast",
        expectedConversion: 0.9,
        expectedRevenue: 100000,
        cost: 10,
        risk: 0.9,
        confidence: 0.99,
        reversibility: false,
        constraints: ["forbidden-in-p0"],
        evidenceRefs: ["synthetic:evidence:forbidden"]
      }
    ]);

    const decision = decideNextAction(state, results);
    expect(decision.selectedScenarioId).not.toBe("irreversible-broadcast");
    expect(decision.requiresHumanApproval).toBe(false);
    expect(decision.action.kind).toBe("crm.lead.upsert_sandbox");
  });

  test("emits idempotency and rollback metadata for the selected action", () => {
    const state = reconstructWorldState(observations);
    const decision = decideNextAction(state, simulateScenarios(state, scenarios));

    expect(decision.worldModelConsulted).toBe(true);
    expect(decision.action.idempotencyKey).toContain(decision.selectedScenarioId);
    expect(decision.action.rollback).toMatchObject({ kind: "restore_before_state" });
    expect(decision.action.evidenceRefs.length).toBeGreaterThan(0);
  });

  test("evaluates an explicit observed outcome and creates a bounded improvement candidate", () => {
    const state = reconstructWorldState(observations);
    const decision = decideNextAction(state, simulateScenarios(state, scenarios));
    const evaluation = evaluateOutcome(decision, {
      metric: "conversion_rate",
      actualValue: 0.31,
      observedAt: "2026-08-19T12:00:00Z",
      evidenceRef: "synthetic:evidence:actual-conversion"
    });

    expect(evaluation.forecastMetric).toBe("conversion_rate");
    expect(evaluation.actualValue).toBe(0.31);
    expect(evaluation.absoluteError).toBeGreaterThanOrEqual(0);
    expect(evaluation.learning.length).toBeGreaterThan(0);
    expect(evaluation.improvementCandidate.status).toBe("candidate_only");
    expect(evaluation.evidenceRefs).toContain("synthetic:evidence:actual-conversion");
  });
});
