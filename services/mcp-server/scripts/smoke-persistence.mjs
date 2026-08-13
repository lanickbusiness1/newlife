import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { GovernanceApprovalLedger } from "../dist/governanceApprovalLedger.js";
import {
  createVerifiedBackup,
  restoreVerifiedBackup,
  verifyBackup
} from "../dist/persistenceAssurance.js";
import { compileSkill } from "../dist/skillFactory.js";
import { SkillRegistry } from "../dist/skillRegistry.js";

const source = await mkdtemp(path.join(tmpdir(), "genesis-persistence-source-"));
const backup = await mkdtemp(path.join(tmpdir(), "genesis-persistence-backup-"));
const restored = await mkdtemp(path.join(tmpdir(), "genesis-persistence-restored-"));

const sourceRegistryRoot = path.join(source, "skill-registry");
const sourceApprovalRoot = path.join(source, "governance-approvals");
const restoredRegistryRoot = path.join(restored, "skill-registry");
const restoredApprovalRoot = path.join(restored, "governance-approvals");

const contextPack = {
  languageSemantic: { status: "covered", evidenceRefs: ["SMOKE-LANG"] },
  regulatoryLegal: { status: "covered", evidenceRefs: ["SMOKE-LEGAL"] },
  institutional: { status: "covered", evidenceRefs: ["SMOKE-INST"] },
  economicFinancialPayment: { status: "covered", evidenceRefs: ["SMOKE-ECO"] },
  culturalHumanAdoption: { status: "covered", evidenceRefs: ["SMOKE-CULT"] },
  infrastructureResilience: { status: "covered", evidenceRefs: ["SMOKE-INFRA"] },
  marketBusinessRevenue: { status: "covered", evidenceRefs: ["SMOKE-MKT"] },
  technologyDataAgenticAI: { status: "covered", evidenceRefs: ["SMOKE-TECH"] },
  governanceSovereigntyAssurance: { status: "covered", evidenceRefs: ["SMOKE-GOV"] }
};

const reviewer = {
  issuer: "urn:afriagenesis:persistence-smoke",
  tenantId: "smoke-tenant",
  actorId: "smoke-reviewer",
  agentId: "smoke-review-agent",
  permissionScope: ["genome:skill:review"],
  roles: ["Reviewer"],
  amr: ["pwd", "mfa"],
  allowedCountries: ["GN"],
  allowedOrganizations: [],
  allowedMissions: [],
  correlationId: "06d8d70b-f038-4272-858c-f60a78263e13",
  purpose: "verify backup and restore",
  dataClassification: "internal"
};

try {
  const registry = new SkillRegistry(sourceRegistryRoot);
  const approvalLedger = new GovernanceApprovalLedger(sourceApprovalRoot, 3600);

  const skill = compileSkill({
    id: "persistence.skill.smoke",
    version: "1.0.0",
    level: "L3",
    domain: "governance.persistence",
    problem: "prove persistent registry backup and restoration integrity",
    triggers: ["backup assurance"],
    inputs: ["registry_state"],
    outputs: ["restored_state"],
    dependencies: [],
    connectors: [],
    permissions: ["registry:read"],
    procedure: ["create verified backup", "restore verified backup"],
    verification: ["sha256 comparison"],
    remeEvidence: ["SMOKE-PERSISTENCE-REME"],
    metrics: ["restored_files"],
    rollback: "discard restored target and retain source",
    languages: ["fr"],
    countries: ["GN"],
    context: contextPack,
    stratex9: { status: "go", evidenceRefs: ["SMOKE-S9"] },
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
    id: "persistence.review.smoke",
    version: "1.0.0",
    warnings: ["backup review required"]
  });
  const approval = await approvalLedger.attest(reviewSkill, "double_review", reviewer);
  const revocation = await approvalLedger.revoke(
    approval.approvalId,
    "double_review",
    reviewer,
    "persistence smoke withdrawal"
  );

  const manifest = await createVerifiedBackup(source, backup);
  await verifyBackup(backup);
  const restore = await restoreVerifiedBackup(backup, restored);

  const restoredRegistry = new SkillRegistry(restoredRegistryRoot);
  const restoredLedger = new GovernanceApprovalLedger(restoredApprovalRoot, 3600);
  const restoredSkill = await restoredRegistry.read(installed.skill.id, installed.skill.version);
  const restoredApproval = await restoredLedger.read(approval.approvalId);
  const restoredRevocation = await restoredLedger.readRevocation(approval.approvalId);

  if (restoredSkill.integrity.sha256 !== installed.integrity.sha256) {
    throw new Error("SMOKE_PERSISTENCE_SKILL_INTEGRITY_MISMATCH");
  }
  if (restoredApproval.integrity.sha256 !== approval.integrity.sha256) {
    throw new Error("SMOKE_PERSISTENCE_APPROVAL_INTEGRITY_MISMATCH");
  }
  if (!restoredRevocation || restoredRevocation.integrity.sha256 !== revocation.integrity.sha256) {
    throw new Error("SMOKE_PERSISTENCE_REVOCATION_INTEGRITY_MISMATCH");
  }
  if (restore.restoredFiles !== manifest.files.length || restore.restoredFiles < 3) {
    throw new Error("SMOKE_PERSISTENCE_RESTORE_COUNT");
  }

  console.log(JSON.stringify({
    status: "ok",
    backupVersion: manifest.version,
    files: manifest.files.length,
    restoredFiles: restore.restoredFiles,
    skillIntegrity: restoredSkill.integrity.sha256,
    approvalIntegrity: restoredApproval.integrity.sha256,
    revocationIntegrity: restoredRevocation.integrity.sha256
  }));
} finally {
  await Promise.all([
    rm(source, { recursive: true, force: true }),
    rm(backup, { recursive: true, force: true }),
    rm(restored, { recursive: true, force: true })
  ]);
}
