import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import {
  DecisionRecord,
  EvidenceArtifact,
  NationalInterestMethodology,
  type NationalInterestWeights,
} from "../src/sovereign-negotiation.js";
import type { SovereignAssessmentSnapshot } from "../src/sovereign-negotiation-service.js";
import { PostgresSovereignNegotiationRepository } from "../src/sovereign-negotiation-postgres.js";

const adminDatabaseUrl = process.env.DATABASE_URL;
const appDatabaseUrl = process.env.APP_DATABASE_URL;
const integrationEnabled = Boolean(adminDatabaseUrl && appDatabaseUrl);

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

async function seedProject(admin: Pool): Promise<{ tenantId: string; projectId: string; approverId: string }> {
  const tenantId = randomUUID();
  const projectId = randomUUID();
  const approverId = randomUUID();
  await admin.query(
    `insert into workforce_tenants (id, slug, name, jurisdiction) values ($1, $2, 'Sovereign Authority', 'GN')`,
    [tenantId, `sovereign-${tenantId}`],
  );
  await admin.query(
    `insert into mining_projects (id, tenant_id, project_code, name, state) values ($1, $2, $3, 'Sovereign Negotiation Test', 'ACTIVE')`,
    [projectId, tenantId, `SOV-${projectId}`],
  );
  await admin.query(
    `insert into workforce_identities (id, tenant_id, kind, display_name, roles)
     values ($1, $2, 'HUMAN', 'Synthetic Sovereign Approver', '["SOVEREIGN_DECISION_APPROVER","SOVEREIGN_METHODOLOGY_APPROVER"]'::jsonb)`,
    [approverId, tenantId],
  );
  return { tenantId, projectId, approverId };
}

function buildMethodology(
  tenantId: string,
  projectId: string,
  approverId: string,
  sourceEvidence: EvidenceArtifact,
  approvalEvidence: EvidenceArtifact,
): NationalInterestMethodology {
  return new NationalInterestMethodology(
    randomUUID(),
    tenantId,
    projectId,
    `NIS-${randomUUID()}`,
    weights,
    75,
    55,
    "DRAFT",
    [sourceEvidence],
  ).validate(
    { id: approverId, tenantId, kind: "HUMAN", roles: ["SOVEREIGN_METHODOLOGY_APPROVER"] },
    approvalEvidence,
  );
}

function assessment(
  tenantId: string,
  projectId: string,
  methodology: NationalInterestMethodology,
  evidenceId: string,
): SovereignAssessmentSnapshot {
  return Object.freeze({
    assessmentId: randomUUID(),
    tenantId,
    projectId,
    methodologyId: methodology.id,
    methodologyVersion: methodology.methodologyVersion,
    goThreshold: methodology.goThreshold,
    holdThreshold: methodology.holdThreshold,
    weights: methodology.weights,
    scores: Object.fromEntries(Object.keys(weights).map((key) => [key, 82])) as Record<keyof NationalInterestWeights, number>,
    weightedScore: 82,
    decision: "GO",
    eliminatoryRedFlags: Object.freeze([]),
    evidenceCoverage: 1,
    evidenceIds: Object.freeze([evidenceId]),
  });
}

async function seedEvidenceAndMethodology(
  repo: PostgresSovereignNegotiationRepository,
  tenantId: string,
  projectId: string,
  approverId: string,
): Promise<{ evidence: EvidenceArtifact; methodology: NationalInterestMethodology }> {
  const evidence = new EvidenceArtifact(
    randomUUID(),
    tenantId,
    projectId,
    "synthetic://postgres/offer-a",
    "c".repeat(64),
    "2026-08-21T00:00:00.000Z",
    "FACT",
  );
  const approvalEvidence = new EvidenceArtifact(
    randomUUID(),
    tenantId,
    projectId,
    "synthetic://postgres/methodology-approval",
    "f".repeat(64),
    "2026-08-21T00:01:00.000Z",
    "FACT",
  );
  await repo.saveEvidence(evidence);
  await repo.saveEvidence(approvalEvidence);
  const methodology = buildMethodology(tenantId, projectId, approverId, evidence, approvalEvidence);
  await repo.saveMethodology(methodology);
  return { evidence, methodology };
}

test("persists and reloads approved National Interest methodology under forced tenant RLS", { skip: !integrationEnabled }, async () => {
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const app = new Pool({ connectionString: appDatabaseUrl });
  try {
    const { tenantId, projectId, approverId } = await seedProject(admin);
    const repo = new PostgresSovereignNegotiationRepository(app);
    const { methodology } = await seedEvidenceAndMethodology(repo, tenantId, projectId, approverId);

    const reloaded = await repo.getMethodology(tenantId, projectId, methodology.id);
    assert.ok(reloaded);
    assert.equal(reloaded.state, "VALIDATED");
    assert.equal(reloaded.validatedByIdentityId, approverId);
    assert.equal(reloaded.goThreshold, 75);
    assert.equal(reloaded.holdThreshold, 55);
    assert.deepEqual(reloaded.weights, weights);
    assert.equal(reloaded.evidence.length, 2);
  } finally {
    await app.end();
    await admin.end();
  }
});

test("persists and reloads evidence and National Interest assessments linked to methodology", { skip: !integrationEnabled }, async () => {
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const app = new Pool({ connectionString: appDatabaseUrl });
  try {
    const { tenantId, projectId, approverId } = await seedProject(admin);
    const repo = new PostgresSovereignNegotiationRepository(app);
    const { evidence, methodology } = await seedEvidenceAndMethodology(repo, tenantId, projectId, approverId);
    const snapshot = assessment(tenantId, projectId, methodology, evidence.id);
    await repo.saveAssessment(snapshot);

    const reloaded = await repo.getAssessment(tenantId, projectId, snapshot.assessmentId);
    assert.ok(reloaded);
    assert.equal(reloaded.decision, "GO");
    assert.equal(reloaded.weightedScore, 82);
    assert.equal(reloaded.methodologyId, methodology.id);
    assert.equal(reloaded.methodologyVersion, methodology.methodologyVersion);
    assert.equal(reloaded.goThreshold, 75);
    assert.equal(reloaded.holdThreshold, 55);
    assert.deepEqual(reloaded.evidenceIds, [evidence.id]);
  } finally {
    await app.end();
    await admin.end();
  }
});

test("persists immutable human sovereign decision records linked to an assessment", { skip: !integrationEnabled }, async () => {
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const app = new Pool({ connectionString: appDatabaseUrl });
  try {
    const { tenantId, projectId, approverId } = await seedProject(admin);
    const repo = new PostgresSovereignNegotiationRepository(app);
    const { evidence, methodology } = await seedEvidenceAndMethodology(repo, tenantId, projectId, approverId);
    const snapshot = assessment(tenantId, projectId, methodology, evidence.id);
    await repo.saveAssessment(snapshot);

    const decision = new DecisionRecord(
      randomUUID(),
      tenantId,
      projectId,
      snapshot.assessmentId,
      "HOLD",
      "Renegotiate step-in rights and sovereign guarantee cap before signature.",
      { id: approverId, kind: "HUMAN" },
      [evidence],
    );
    await repo.saveDecision(decision);

    const reloaded = await repo.getDecision(tenantId, projectId, decision.id);
    assert.ok(reloaded);
    assert.equal(reloaded.decision, "HOLD");
    assert.equal(reloaded.decidedBy.id, approverId);
    assert.match(reloaded.rationale, /renegotiate/i);
  } finally {
    await app.end();
    await admin.end();
  }
});

test("does not expose another tenant methodology or assessment through repository reads", { skip: !integrationEnabled }, async () => {
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const app = new Pool({ connectionString: appDatabaseUrl });
  try {
    const a = await seedProject(admin);
    const b = await seedProject(admin);
    const repo = new PostgresSovereignNegotiationRepository(app);
    const { evidence: evidenceB, methodology: methodologyB } = await seedEvidenceAndMethodology(
      repo,
      b.tenantId,
      b.projectId,
      b.approverId,
    );
    const snapshotB = assessment(b.tenantId, b.projectId, methodologyB, evidenceB.id);
    await repo.saveAssessment(snapshotB);

    assert.equal(await repo.getMethodology(a.tenantId, a.projectId, methodologyB.id), undefined);
    assert.equal(await repo.getAssessment(a.tenantId, a.projectId, snapshotB.assessmentId), undefined);
  } finally {
    await app.end();
    await admin.end();
  }
});
