import assert from "node:assert/strict";
import test from "node:test";
import {
  EvidenceArtifact,
  NationalInterestMethodology,
  OperatorExposure,
  SovereignScenarioRecord,
  type NationalInterestWeights,
} from "../src/sovereign-negotiation.js";
import {
  SovereignNegotiationService,
  type SovereignAssessmentSnapshot,
  type SovereignNegotiationRepository,
} from "../src/sovereign-negotiation-service.js";

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

const factEvidence = new EvidenceArtifact(
  "ev-fact",
  "tenant-gn",
  "simandou",
  "synthetic://offer-a",
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
  "ev-sim",
  "tenant-gn",
  "simandou",
  "synthetic://scenario-a",
  "b".repeat(64),
  "2026-08-21T00:00:00.000Z",
  "SIMULATION",
);

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
    [factEvidence],
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

class MemoryRepository implements SovereignNegotiationRepository {
  readonly evidence: EvidenceArtifact[] = [];
  readonly methodologies: NationalInterestMethodology[] = [];
  readonly assessments: SovereignAssessmentSnapshot[] = [];
  readonly decisions: unknown[] = [];

  async saveEvidence(item: EvidenceArtifact): Promise<EvidenceArtifact> {
    if (!this.evidence.some((existing) => existing.id === item.id)) this.evidence.push(item);
    return item;
  }

  async saveMethodology(methodology: NationalInterestMethodology): Promise<NationalInterestMethodology> {
    if (!this.methodologies.some((existing) => existing.id === methodology.id)) this.methodologies.push(methodology);
    return methodology;
  }

  async saveAssessment(snapshot: SovereignAssessmentSnapshot): Promise<SovereignAssessmentSnapshot> {
    this.assessments.push(snapshot);
    return snapshot;
  }

  async saveDecision<T>(decision: T): Promise<T> {
    this.decisions.push(decision);
    return decision;
  }
}

test("persists insufficient-evidence assessment without inventing a score or sovereign decision", async () => {
  const repository = new MemoryRepository();
  const service = new SovereignNegotiationService(repository);
  const methodology = approvedMethodology();

  const evaluation = await service.evaluateOffer({
    tenantId: "tenant-gn",
    projectId: "simandou",
    assessmentId: "nia-no-evidence",
    methodology,
    scores: Object.fromEntries(Object.keys(weights).map((key) => [key, 85])) as Record<keyof NationalInterestWeights, number>,
    eliminatoryRedFlags: [],
    evidence: [],
    operatorExposures: [],
    scenarios: [],
  });

  assert.equal(evaluation.assessment.decision, "INSUFFICIENT_EVIDENCE");
  assert.equal(evaluation.assessment.weightedScore, null);
  assert.equal(repository.methodologies.length, 1);
  assert.equal(repository.assessments.length, 1);
  assert.equal(repository.decisions.length, 0);
  assert.equal(evaluation.assessment.methodologyId, methodology.id);
});

test("returns deterministic concentration and scenario ranking alongside the National Interest assessment", async () => {
  const repository = new MemoryRepository();
  const service = new SovereignNegotiationService(repository);
  const methodology = approvedMethodology();

  const exposures = [
    new OperatorExposure("exp-a", "tenant-gn", "simandou", "operator-a", 0.6, 3, [factEvidence]),
    new OperatorExposure("exp-b", "tenant-gn", "simandou", "operator-b", 0.4, 2, [factEvidence]),
  ];
  const scenarios = [
    new SovereignScenarioRecord("offer-a", "tenant-gn", "simandou", "OFFER_A", 1_200, 500, 0.55, 0.42, 0.65, [simulationEvidence]),
    new SovereignScenarioRecord("counter", "tenant-gn", "simandou", "COUNTER_PROPOSAL", 1_450, 540, 0.62, 0.51, 0.45, [simulationEvidence]),
  ];

  const evaluation = await service.evaluateOffer({
    tenantId: "tenant-gn",
    projectId: "simandou",
    assessmentId: "nia-evaluated",
    methodology,
    scores: Object.fromEntries(Object.keys(weights).map((key) => [key, 80])) as Record<keyof NationalInterestWeights, number>,
    eliminatoryRedFlags: [],
    evidence: [factEvidence],
    operatorExposures: exposures,
    scenarios,
  });

  assert.equal(evaluation.assessment.decision, "GO");
  assert.equal(evaluation.concentration.hhi, 5200);
  assert.equal(evaluation.rankedScenarios[0]?.id, "counter");
  assert.equal(repository.assessments[0]?.methodologyVersion, "B8-v1");
  assert.equal(repository.assessments[0]?.goThreshold, 75);
  assert.equal(repository.assessments[0]?.holdThreshold, 55);
});

test("rejects a draft methodology before evidence or assessment persistence", async () => {
  const repository = new MemoryRepository();
  const service = new SovereignNegotiationService(repository);
  const draft = new NationalInterestMethodology(
    "method-draft",
    "tenant-gn",
    "simandou",
    "B8-draft",
    weights,
    75,
    55,
    "DRAFT",
    [factEvidence],
  );

  await assert.rejects(
    service.evaluateOffer({
      tenantId: "tenant-gn",
      projectId: "simandou",
      assessmentId: "nia-draft",
      methodology: draft,
      scores: Object.fromEntries(Object.keys(weights).map((key) => [key, 90])) as Record<keyof NationalInterestWeights, number>,
      eliminatoryRedFlags: [],
      evidence: [factEvidence],
      operatorExposures: [],
      scenarios: [],
    }),
    /methodology.*approved/i,
  );

  assert.equal(repository.evidence.length, 0);
  assert.equal(repository.methodologies.length, 0);
  assert.equal(repository.assessments.length, 0);
});

test("keeps final sovereign decision human-only and separate from AI recommendation", async () => {
  const repository = new MemoryRepository();
  const service = new SovereignNegotiationService(repository);

  await assert.rejects(
    service.recordSovereignDecision({
      id: "decision-agent",
      tenantId: "tenant-gn",
      projectId: "simandou",
      assessmentId: "nia-evaluated",
      finalDecision: "NO_GO",
      rationale: "Synthetic agent attempt",
      authority: { id: "agent-1", kind: "AGENT" },
      evidence: [factEvidence],
    }),
    /human decision authority/i,
  );
  assert.equal(repository.decisions.length, 0);

  const decision = await service.recordSovereignDecision({
    id: "decision-human",
    tenantId: "tenant-gn",
    projectId: "simandou",
    assessmentId: "nia-evaluated",
    finalDecision: "HOLD",
    rationale: "Human authority requests renegotiation before signature.",
    authority: { id: "human-1", kind: "HUMAN" },
    evidence: [factEvidence],
  });

  assert.equal(decision.decision, "HOLD");
  assert.equal(repository.decisions.length, 1);
});
