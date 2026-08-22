import assert from "node:assert/strict";
import test from "node:test";
import {
  ContractClause,
  ContractObligation,
  Concession,
  CorridorNode,
  DecisionRecord,
  EvidenceArtifact,
  NationalInterestMethodology,
  OperatorExposure,
  ResourceAsset,
  SovereignScenarioRecord,
  computeOperatorConcentration,
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

const methodologyApprovalEvidence = new EvidenceArtifact(
  "ev-method-approval",
  "tenant-gn",
  "simandou",
  "synthetic://methodology/approval",
  "c".repeat(64),
  "2026-08-21T00:01:00.000Z",
  "FACT",
);

const simulationEvidence = new EvidenceArtifact(
  "ev-sim-1",
  "tenant-gn",
  "simandou",
  "synthetic://scenario/counter-proposal",
  "b".repeat(64),
  "2026-08-21T00:00:00.000Z",
  "SIMULATION",
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

function approvedMethodology(): NationalInterestMethodology {
  return new NationalInterestMethodology(
    "method-b8-v1",
    "tenant-gn",
    "simandou",
    "B8-v1",
    weights,
    75,
    55,
    "DRAFT",
    [evidence],
  ).validate(
    {
      id: "method-approver",
      tenantId: "tenant-gn",
      kind: "HUMAN",
      roles: ["SOVEREIGN_METHODOLOGY_APPROVER"],
    },
    methodologyApprovalEvidence,
  );
}

test("blocks a GO when an eliminatory red flag is present", () => {
  const result = scoreNationalInterest({
    tenantId: "tenant-gn",
    projectId: "simandou",
    assessmentId: "nia-1",
    methodology: approvedMethodology(),
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
    methodology: approvedMethodology(),
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

test("rejects an invalid National Interest methodology weight total", () => {
  assert.throws(
    () =>
      new NationalInterestMethodology(
        "method-invalid",
        "tenant-gn",
        "simandou",
        "B8-invalid",
        { ...weights, nationalValueCapture: 19 },
        75,
        55,
        "DRAFT",
        [evidence],
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

test("models strategic resource assets with evidence-backed reserve quantities", () => {
  const asset = new ResourceAsset(
    "asset-iron-1",
    "tenant-gn",
    "simandou",
    "IRON_ORE",
    "Synthetic Simandou Block",
    1_500_000_000,
    "TONNE",
    [evidence],
  );

  assert.equal(asset.resourceType, "IRON_ORE");
  assert.equal(asset.reserveQuantity, 1_500_000_000);
  assert.throws(
    () => new ResourceAsset("asset-bad", "tenant-gn", "simandou", "IRON_ORE", "Bad", -1, "TONNE", [evidence]),
    /reserve quantity/i,
  );
});

test("tracks contract obligations as advisory performance observations, not autonomous legal breach findings", () => {
  const obligation = new ContractObligation(
    "obl-1",
    "tenant-gn",
    "simandou",
    "concession-1",
    "clause-1",
    "operator-a",
    "CAPEX_COMMITMENT",
    "2030-12-31",
    "USD 500m cumulative investment",
    "PENDING",
    [evidence],
  );

  const observed = obligation.observe("POTENTIAL_BREACH", evidence);
  assert.equal(observed.performanceStatus, "POTENTIAL_BREACH");
  assert.equal(observed.version, 2);
  assert.equal(observed.evidence.length, 2);
  assert.equal(obligation.performanceStatus, "PENDING");
});

test("computes operator concentration from controlled-capacity exposure", () => {
  const exposureA = new OperatorExposure("exp-a", "tenant-gn", "simandou", "operator-a", 0.6, 3, [evidence]);
  const exposureB = new OperatorExposure("exp-b", "tenant-gn", "simandou", "operator-b", 0.4, 2, [evidence]);
  const concentration = computeOperatorConcentration([exposureA, exposureB]);

  assert.equal(concentration.hhi, 5200);
  assert.equal(concentration.largestOperatorId, "operator-a");
  assert.equal(concentration.largestShare, 0.6);
});

test("requires scenario records to remain explicitly classified as simulations", () => {
  const scenario = new SovereignScenarioRecord(
    "scenario-1",
    "tenant-gn",
    "simandou",
    "COUNTER_PROPOSAL",
    1_450,
    540,
    0.62,
    0.51,
    0.45,
    [simulationEvidence],
  );

  assert.equal(scenario.truthClass, "SIMULATION");
  assert.throws(
    () =>
      new SovereignScenarioRecord(
        "scenario-bad",
        "tenant-gn",
        "simandou",
        "OFFER_A",
        1_000,
        400,
        0.5,
        0.4,
        0.5,
        [evidence],
      ),
    /simulation evidence/i,
  );
});

test("enforces human, role-scoped and tenant-scoped sovereign decision records", () => {
  assert.throws(
    () =>
      new DecisionRecord(
        "decision-agent",
        "tenant-gn",
        "simandou",
        "nia-1",
        "NO_GO",
        "Synthetic sovereign decision",
        {
          id: "agent-1",
          tenantId: "tenant-gn",
          kind: "AGENT",
          roles: ["SOVEREIGN_DECISION_APPROVER"],
        },
        [evidence],
      ),
    /human decision authority/i,
  );

  assert.throws(
    () =>
      new DecisionRecord(
        "decision-no-role",
        "tenant-gn",
        "simandou",
        "nia-1",
        "HOLD",
        "Synthetic unauthorized human decision",
        { id: "human-no-role", tenantId: "tenant-gn", kind: "HUMAN", roles: [] },
        [evidence],
      ),
    /SOVEREIGN_DECISION_APPROVER/i,
  );

  assert.throws(
    () =>
      new DecisionRecord(
        "decision-cross-tenant",
        "tenant-gn",
        "simandou",
        "nia-1",
        "HOLD",
        "Synthetic cross-tenant decision",
        {
          id: "human-other",
          tenantId: "tenant-other",
          kind: "HUMAN",
          roles: ["SOVEREIGN_DECISION_APPROVER"],
        },
        [evidence],
      ),
    /tenant isolation/i,
  );

  const decision = new DecisionRecord(
    "decision-human",
    "tenant-gn",
    "simandou",
    "nia-1",
    "NO_GO",
    "Synthetic sovereign decision",
    {
      id: "human-1",
      tenantId: "tenant-gn",
      kind: "HUMAN",
      roles: ["SOVEREIGN_DECISION_APPROVER"],
    },
    [evidence],
  );
  assert.equal(decision.decidedBy.id, "human-1");
});
