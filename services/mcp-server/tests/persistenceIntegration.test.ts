import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, test, expect } from "vitest";
import type { BoundRequestContext } from "../src/auth";
import { GovernanceApprovalLedger } from "../src/governanceApprovalLedger";
import {
  createVerifiedBackup,
  restoreVerifiedBackup,
  verifyBackup
} from "../src/persistenceAssurance";
import { compileSkill } from "../src/skillFactory";
import { SkillRegistry } from "../src/skillRegistry";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

async function temp(prefix: string) {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  roots.push(dir);
  return dir;
}

const contextPack = {
  languageSemantic: { status: "covered" as const, evidenceRefs: ["LANG-GN"] },
  regulatoryLegal: { status: "covered" as const, evidenceRefs: ["LEGAL-GN"] },
  institutional: { status: "covered" as const, evidenceRefs: ["INST-GN"] },
  economicFinancialPayment: { status: "covered" as const, evidenceRefs: ["ECO-GN"] },
  culturalHumanAdoption: { status: "covered" as const, evidenceRefs: ["CULT-GN"] },
  infrastructureResilience: { status: "covered" as const, evidenceRefs: ["INFRA-GN"] },
  marketBusinessRevenue: { status: "covered" as const, evidenceRefs: ["MKT-GN"] },
  technologyDataAgenticAI: { status: "covered" as const, evidenceRefs: ["TECH-GN"] },
  governanceSovereigntyAssurance: { status: "covered" as const, evidenceRefs: ["GOV-GN"] }
};

function reviewer(): BoundRequestContext {
  return {
    issuer: "https://id.afriagenesis.test",
    tenantId: "tenant-gn",
    actorId: "reviewer-persistence",
    agentId: "review-agent-persistence",
    permissionScope: ["genome:skill:review"],
    roles: ["Reviewer"],
    amr: ["pwd", "mfa"],
    allowedCountries: ["GN"],
    allowedOrganizations: ["PPCC"],
    allowedMissions: ["govtech-procurement"],
    correlationId: "06d8d70b-f038-4272-858c-f60a78263e13",
    purpose: "verify durable state recovery",
    dataClassification: "internal"
  };
}

test("verified backup restores real Registry, Approval Ledger and Revocation state", async () => {
  const source = await temp("genesis-persistence-source-");
  const backup = await temp("genesis-persistence-backup-");
  const restored = await temp("genesis-persistence-restored-");
  const registryRoot = path.join(source, "skill-registry");
  const approvalRoot = path.join(source, "governance-approvals");

  const registry = new SkillRegistry(registryRoot);
  const ledger = new GovernanceApprovalLedger(approvalRoot, 3600);
  const skill = compileSkill({
    id: "persistence.integration.skill",
    version: "1.0.0",
    level: "L3",
    domain: "governance.persistence",
    problem: "prove registry and approval state survives verified backup restoration",
    triggers: ["persistence assurance"],
    inputs: ["governed_state"],
    outputs: ["restored_governed_state"],
    dependencies: [],
    connectors: [],
    permissions: ["registry:read"],
    procedure: ["backup state", "verify backup", "restore state"],
    verification: ["sha256 equality"],
    remeEvidence: ["REME-PERSISTENCE-001"],
    metrics: ["restored_records"],
    rollback: "discard restored copy and preserve source",
    languages: ["fr"],
    countries: ["GN"],
    context: contextPack,
    stratex9: { status: "go", evidenceRefs: ["S9-GN"] },
    configurableMetadata: { storage: "filesystem" },
    universalInvariants: { integrityRequired: true },
    outcomeEvidencePresent: true,
    localRulesSeparated: true,
    permissionsBounded: true,
    doubleReviewPassed: true,
    secondContextTestPassed: true
  });
  const installed = await registry.install(skill);

  const reviewSkill = compileSkill({
    ...skill,
    id: "persistence.integration.review",
    version: "1.0.0",
    warnings: ["independent review required"]
  });
  const approval = await ledger.attest(reviewSkill, "double_review", reviewer());
  const revocation = await ledger.revoke(
    approval.approvalId,
    "double_review",
    reviewer(),
    "evidence set superseded"
  );

  const manifest = await createVerifiedBackup(source, backup);
  await expect(verifyBackup(backup)).resolves.toMatchObject({ version: manifest.version });
  const result = await restoreVerifiedBackup(backup, restored);
  expect(result.restoredFiles).toBe(manifest.files.length);

  const restoredRegistry = new SkillRegistry(path.join(restored, "skill-registry"));
  const restoredLedger = new GovernanceApprovalLedger(path.join(restored, "governance-approvals"), 3600);
  const restoredSkill = await restoredRegistry.read(installed.skill.id, installed.skill.version);
  const restoredApproval = await restoredLedger.read(approval.approvalId);
  const restoredRevocation = await restoredLedger.readRevocation(approval.approvalId);

  expect(restoredSkill.integrity.sha256).toBe(installed.integrity.sha256);
  expect(restoredApproval.integrity.sha256).toBe(approval.integrity.sha256);
  expect(restoredRevocation?.integrity.sha256).toBe(revocation.integrity.sha256);
});
