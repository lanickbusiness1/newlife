import assert from "node:assert/strict";
import test from "node:test";
import {
  ContractClause,
  Concession,
  CorridorNode,
  EvidenceArtifact,
  NationalInterestAssessment,
  scoreNationalInterest,
  compareSovereignScenarios,
  type NationalInterestWeights,
} from "../src/sovereign-negotiation.js";

const evidence = new EvidenceArtifact(
  "ev-1",
  "tenant-gn",
  "simandou",
  "synthetic://offer-a/concession",
  "a".repeat(64),
  "2026-08-21T00:00:00.000Z",
  "FACT",
);

const weights: NationalInterestWeights = {
  nationalValueCapture: 20,
  fiscalFx: 10,
  infrastructureSpillover: 10,
  industrialization: 10,
  localContentSkills: 10,
  logisticsControl: 10,
  concentrationDependency: 5,
  debtGuarantees: 5,
  esgCommunity: 5,
  dataGovernance: 5,
  reversibility: 5,
  longTermResilience: 5,
};

test("blocks a GO when an eliminatory red flag is present", () => {
  const result = scoreNationalInterest({
    tenantId: "tenant-gn",
    projectId: "simandou",
    assessmentId: "nia-1",
    weights,
    scores: Object.fromEntries(Object.keys(weights).map((key) => [key, 90])) as Record<keyof NationalInterestWeights, number>,
    eliminatoryRedFlags: ["UNBOUNDED_SOVEREIGN_GUARANTEE"],
    evidence: [evidence],
  });

  assert.equal(result.decision, "NO_GO");
  assert.equal(result.weightedScore, 90);
  assert.deepEqual(result.eliminatoryRedFlags, ["UNBOUNDED_SOVEREIGN_GUARANTEE"]);
});

test("returns insufficient evidence instead of a false-precision score", () => {
  const result = scoreNationalInterest({
    tenantId: "tenant-gn",
    projectId: "simandou",
    assessmentId: "nia-2",
    weights,
    scores: Object.fromEntries(Object.keys(weights).map((key) => [key, 80])) as Record<keyof NationalInterestWeights, number>,
    eliminatoryRedFlags: [],
    evidence: [],
  });

  assert.equal(result.decision, "INSUFFICIENT_EVIDENCE");
  assert.equal(result.weightedScore, null);
});

test("requires contract clauses to preserve source provenance and legal validation boundary", () => {
  const clause = new ContractClause(
    "clause-1",
    "tenant-gn",
    "simandou",
    "concession-1",
    "STEP_IN_RIGHTS",
    "State step-in rights become exercisable after a material uncured breach.",
    "ADVISORY_EXTRACTED",
    [evidence],
  );

  assert.equal(clause.legalStatus, "ADVISORY_EXTRACTED");
  assert.equal(clause.evidence[0]?.id, "ev-1");
});

test("models corridor dependencies explicitly", () => {
  const node = new CorridorNode(
    "terminal-1",
    "tenant-gn",
    "simandou",
    "PORT_TERMINAL",
    "Morebaya Synthetic Terminal",
    "operator-a",
    0.85,
    [evidence],
  );

  assert.equal(node.dependencyRatio, 0.85);
  assert.equal(node.operatorId, "operator-a");
});

test("compares scenarios deterministically and identifies the highest sovereign NPV", () => {
  const ranking = compareSovereignScenarios([
    {
      id: "offer-a",
      sovereignNpv: 1_200,
      fiscalTake: 500,
      fxRetention: 0.55,
      localValueCapture: 0.42,
      dependencyScore: 0.65,
    },
    {
      id: "counter-proposal",
      sovereignNpv: 1_450,
      fiscalTake: 540,
      fxRetention: 0.62,
      localValueCapture: 0.51,
      dependencyScore: 0.45,
    },
  ]);

  assert.equal(ranking[0]?.id, "counter-proposal");
  assert.equal(ranking[1]?.id, "offer-a");
});

test("rejects an invalid National Interest weight total", () => {
  assert.throws(
    () =>
      new NationalInterestAssessment(
        "nia-invalid",
        "tenant-gn",
        "simandou",
        { ...weights, nationalValueCapture: 19 },
        [],
      ),
    /weights must total 100/i,
  );
});

test("preserves concession identity and evidence lineage", () => {
  const concession = new Concession(
    "concession-1",
    "tenant-gn",
    "simandou",
    "Synthetic Port Concession",
    "operator-a",
    "2027-01-01",
    "2052-12-31",
    [evidence],
  );

  assert.equal(concession.operatorId, "operator-a");
  assert.equal(concession.evidence.length, 1);
});
