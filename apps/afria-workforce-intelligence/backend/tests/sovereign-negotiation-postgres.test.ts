import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import {
  DecisionRecord,
  EvidenceArtifact,
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
     values ($1, $2, 'HUMAN', 'Synthetic Sovereign Approver', '["SOVEREIGN_DECISION_APPROVER"]'::jsonb)`,
    [approverId, tenantId],
  );
  return { tenantId, projectId, approverId };
}

function assessment(tenantId: string, projectId: string, evidenceId: string): SovereignAssessmentSnapshot {
  return Object.freeze({
    assessmentId: randomUUID(),
    tenantId,
    projectId,
    methodologyVersion: "B8-v1",
    weights,
    scores: Object.fromEntries(Object.keys(weights).map((key) => [key, 82])) as Record<keyof NationalInterestWeights, number>,
    weightedScore: 82,
    decision: "GO",
    eliminatoryRedFlags: Object.freeze([]),
    evidenceCoverage: 1,
    evidenceIds: Object.freeze([evidenceId]),
  });
}

test("persists and reloads evidence and National Interest assessments under forced tenant RLS", { skip: !integrationEnabled }, async () => {
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const app = new Pool({ connectionString: appDatabaseUrl });
  try {
    const { tenantId, projectId } = await seedProject(admin);
    const repo = new PostgresSovereignNegotiationRepository(app);
    const evidence = new EvidenceArtifact(
      randomUUID(),
      tenantId,
      projectId,
      "synthetic://postgres/offer-a",
      "c".repeat(64),
      "2026-08-21T00:00:00.000Z",
      "FACT",
    );
    await repo.saveEvidence(evidence);
    const snapshot = assessment(tenantId, projectId, evidence.id);
    await repo.saveAssessment(snapshot);

    const reloaded = await repo.getAssessment(tenantId, projectId, snapshot.assessmentId);
    assert.ok(reloaded);
    assert.equal(reloaded.decision, "GO");
    assert.equal(reloaded.weightedScore, 82);
    assert.equal(reloaded.methodologyVersion, "B8-v1");
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
    const evidence = new EvidenceArtifact(
      randomUUID(),
      tenantId,
      projectId,
      "synthetic://postgres/decision",
      "d".repeat(64),
      "2026-08-21T00:00:00.000Z",
      "FACT",
    );
    await repo.saveEvidence(evidence);
    const snapshot = assessment(tenantId, projectId, evidence.id);
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

test("does not expose another tenant assessment through repository reads", { skip: !integrationEnabled }, async () => {
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const app = new Pool({ connectionString: appDatabaseUrl });
  try {
    const a = await seedProject(admin);
    const b = await seedProject(admin);
    const repo = new PostgresSovereignNegotiationRepository(app);
    const evidenceB = new EvidenceArtifact(
      randomUUID(),
      b.tenantId,
      b.projectId,
      "synthetic://postgres/tenant-b",
      "e".repeat(64),
      "2026-08-21T00:00:00.000Z",
      "FACT",
    );
    await repo.saveEvidence(evidenceB);
    const snapshotB = assessment(b.tenantId, b.projectId, evidenceB.id);
    await repo.saveAssessment(snapshotB);

    assert.equal(await repo.getAssessment(a.tenantId, a.projectId, snapshotB.assessmentId), undefined);
  } finally {
    await app.end();
    await admin.end();
  }
});
