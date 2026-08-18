import { describe, expect, test } from "vitest";
import { afriaRecruitAutoGtmProofFixture } from "../src/fixtures/afriaRecruitAutoGtm";
import {
  decideNextAction,
  evaluateOutcome,
  reconstructWorldState,
  simulateScenarios
} from "../src/worldModelRuntime";

describe("AfrIA Recruit Auto-GTM World Model Proof", () => {
  test("runs the complete governed proof chain without promoting synthetic data to real evidence", () => {
    const state = reconstructWorldState(afriaRecruitAutoGtmProofFixture.observations);
    const simulations = simulateScenarios(state, afriaRecruitAutoGtmProofFixture.scenarios);
    const decision = decideNextAction(state, simulations);
    const evaluation = evaluateOutcome(decision, afriaRecruitAutoGtmProofFixture.actualOutcome);

    expect(state.facts.length).toBeGreaterThanOrEqual(3);
    expect(simulations).toHaveLength(3);
    expect(simulations[0]?.scenarioId).toBe("recruiter-partner");
    expect(decision.selectedScenarioId).toBe("recruiter-partner");
    expect(decision.worldModelConsulted).toBe(true);
    expect(decision.action.kind).toBe("crm.lead.upsert_sandbox");
    expect(decision.action.approvalClass).toBe("A2");
    expect(decision.action.rollback.kind).toBe("restore_before_state");
    expect(evaluation.improvementCandidate.status).toBe("candidate_only");
    expect(evaluation.evidenceRefs).toContain("synthetic:evidence:actual-conversion");

    for (const evidenceRef of [
      ...state.evidenceRefs,
      ...simulations.flatMap(item => item.evidenceRefs),
      ...evaluation.evidenceRefs
    ]) {
      if (evidenceRef.startsWith("synthetic:")) {
        expect(evidenceRef).toMatch(/^synthetic:evidence:/);
      }
    }

    expect(afriaRecruitAutoGtmProofFixture.disclaimer).toMatch(/synthetic/i);
    expect(afriaRecruitAutoGtmProofFixture.disclaimer).toMatch(/not real market performance/i);
  });
});
