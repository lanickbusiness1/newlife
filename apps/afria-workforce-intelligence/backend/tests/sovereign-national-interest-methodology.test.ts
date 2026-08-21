import assert from "node:assert/strict";
import test from "node:test";
import {
  EvidenceArtifact,
  NationalInterestMethodology,
  scoreNationalInterest,
  type NationalInterestWeights,
} from "../src/sovereign-negotiation.js";

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

const sourceEvidence = new EvidenceArtifact(
  "method-source",
  "tenant-gn",
  "simandou",
  "synthetic://methodology/source",
  "a".repeat(64),
  "2026-08-21T00:00:00.000Z",
  "FACT",
);

const approvalEvidence = new EvidenceArtifact(
  "method-approval",
  "tenant-gn",
  "simandou",
  "synthetic://methodology/approval",
  "b".repeat(64),
  "2026-08-21T00:01:00.000Z",
  "FACT",
);

test("requires a human sovereign methodology approver before National Interest scoring", () => {
  const draft = new NationalInterestMethodology(
    "method-1",
    "tenant-gn",
    "simandou",
    "NIS-2026.1",
    weights,
    75,
    55,
    "DRAFT",
    [sourceEvidence],
  );

  assert.throws(
    () =>
      scoreNationalInterest({
        tenantId: "tenant-gn",
        projectId: "simandou",
        assessmentId: "nia-draft",
        methodology: draft,
        scores: Object.fromEntries(Object.keys(weights).map((key) => [key, 90])) as Record<keyof NationalInterestWeights, number>,
        eliminatoryRedFlags: [],
        evidence: [sourceEvidence],
      }),
    /methodology.*approved/i,
  );

  const validated = draft.validate(
    { id: "human-method", kind: "HUMAN", roles: ["SOVEREIGN_METHODOLOGY_APPROVER"] },
    approvalEvidence,
  );
  const result = scoreNationalInterest({
    tenantId: "tenant-gn",
    projectId: "simandou",
    assessmentId: "nia-approved",
    methodology: validated,
    scores: Object.fromEntries(Object.keys(weights).map((key) => [key, 90])) as Record<keyof NationalInterestWeights, number>,
    eliminatoryRedFlags: [],
    evidence: [sourceEvidence],
  });

  assert.equal(validated.state, "VALIDATED");
  assert.equal(validated.version, 2);
  assert.equal(validated.validatedByIdentityId, "human-method");
  assert.equal(result.decision, "GO");
});

test("rejects agent or unauthorized human methodology approval", () => {
  const draft = new NationalInterestMethodology(
    "method-2",
    "tenant-gn",
    "simandou",
    "NIS-2026.2",
    weights,
    80,
    60,
    "DRAFT",
    [sourceEvidence],
  );

  assert.throws(
    () => draft.validate({ id: "agent-1", kind: "AGENT", roles: ["SOVEREIGN_METHODOLOGY_APPROVER"] }, approvalEvidence),
    /human sovereign methodology approver/i,
  );
  assert.throws(
    () => draft.validate({ id: "human-1", kind: "HUMAN", roles: [] }, approvalEvidence),
    /SOVEREIGN_METHODOLOGY_APPROVER/i,
  );
});

test("keeps GO and HOLD thresholds configurable and internally coherent", () => {
  assert.throws(
    () =>
      new NationalInterestMethodology(
        "method-invalid",
        "tenant-gn",
        "simandou",
        "NIS-invalid",
        weights,
        50,
        60,
        "DRAFT",
        [sourceEvidence],
      ),
    /GO threshold must be greater than HOLD threshold/i,
  );
});
