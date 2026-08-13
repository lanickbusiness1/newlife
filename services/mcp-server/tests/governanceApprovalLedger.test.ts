import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { BoundRequestContext } from "../src/auth";
import {
  GovernanceApprovalLedger,
  fingerprintSkill
} from "../src/governanceApprovalLedger";
import { compileSkill, type SkillFactoryInput } from "../src/skillFactory";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

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

function input(overrides: Partial<SkillFactoryInput> = {}): SkillFactoryInput {
  return {
    id: "procurement.payment.release",
    version: "1.0.0",
    level: "L3",
    domain: "govtech.procurement",
    problem: "release governed procurement payment after verified milestone evidence",
    triggers: ["milestone approved"],
    inputs: ["milestone_evidence"],
    outputs: ["payment_release_decision"],
    dependencies: ["contract_registry"],
    connectors: ["treasury"],
    permissions: ["payment:propose"],
    procedure: ["verify milestone evidence", "prepare payment release"],
    verification: ["unit test", "human review"],
    remeEvidence: ["REME-PAY-001"],
    metrics: ["accuracy"],
    rollback: "revoke pending release and restore previous state",
    languages: ["fr"],
    countries: ["GN"],
    context: contextPack,
    stratex9: { status: "go", evidenceRefs: ["S9-GN"] },
    riskDomains: ["payment"],
    outcomeEvidencePresent: true,
    localRulesSeparated: true,
    permissionsBounded: true,
    doubleReviewPassed: true,
    secondContextTestPassed: true,
    configurableMetadata: {},
    universalInvariants: {},
    ...overrides
  };
}

function ctx(actorId: string, scope: string[], roles: string[]): BoundRequestContext {
  return {
    issuer: "https://id.afriagenesis.test",
    tenantId: "tenant-gn",
    actorId,
    agentId: `agent-for-${actorId}`,
    permissionScope: scope,
    roles,
    amr: ["pwd", "mfa"],
    allowedCountries: ["GN"],
    allowedOrganizations: ["PPCC"],
    allowedMissions: ["govtech-procurement"],
    correlationId: "06d8d70b-f038-4272-858c-f60a78263e13",
    purpose: "govern sensitive skill installation",
    dataClassification: "internal"
  };
}

async function ledger() {
  const root = await mkdtemp(path.join(tmpdir(), "genesis-approval-ledger-"));
  roots.push(root);
  return new GovernanceApprovalLedger(root, 3600);
}

describe("GENESIS Governance Approval Ledger", () => {
  test("fingerprint is deterministic and changes with any material skill mutation", () => {
    const original = compileSkill(input());
    const changed = compileSkill(input({ problem: "release a materially different governed procurement payment" }));

    expect(fingerprintSkill(original)).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprintSkill(original)).toBe(fingerprintSkill(compileSkill(input())));
    expect(fingerprintSkill(original)).not.toBe(fingerprintSkill(changed));
  });

  test("persists review and M8 attestations bound to verified actors and the exact skill fingerprint", async () => {
    const l = await ledger();
    const skill = compileSkill(input());
    const review = await l.attest(skill, "double_review", ctx(
      "reviewer-1",
      ["genome:skill:review"],
      ["Reviewer"]
    ));
    const m8 = await l.attest(skill, "m8", ctx(
      "m8-1",
      ["genome:skill:m8"],
      ["M8 Committee"]
    ));

    expect(review.subject.fingerprint).toBe(fingerprintSkill(skill));
    expect(m8.actorId).toBe("m8-1");
    expect(review.integrity.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  test("rejects attestations without the authority scope, canonical role or MFA", async () => {
    const l = await ledger();
    const skill = compileSkill(input());

    await expect(l.attest(skill, "double_review", ctx("analyst", [], ["Analyst"])))
      .rejects.toThrow(/APPROVAL_SCOPE_REQUIRED:double_review/);
    await expect(l.attest(skill, "m8", ctx("analyst", ["genome:skill:m8"], ["Analyst"])))
      .rejects.toThrow(/APPROVAL_ROLE_REQUIRED:m8/);
    await expect(l.attest(skill, "m8", {
      ...ctx("m8-no-mfa", ["genome:skill:m8"], ["M8 Committee"]),
      amr: ["pwd"]
    })).rejects.toThrow(/APPROVAL_MFA_REQUIRED:m8/);
  });

  test("requires distinct reviewer, M8 approver and installer for sensitive installation", async () => {
    const l = await ledger();
    const skill = compileSkill(input());
    const review = await l.attest(skill, "double_review", ctx(
      "reviewer-1",
      ["genome:skill:review"],
      ["Reviewer"]
    ));
    const m8 = await l.attest(skill, "m8", ctx(
      "m8-1",
      ["genome:skill:m8"],
      ["M8 Committee"]
    ));

    await expect(l.verifyInstall(skill, {
      reviewApprovalId: review.approvalId,
      m8ApprovalId: m8.approvalId
    }, ctx("installer-1", ["genome:skill:install"], ["Workflow Orchestrator"])))
      .resolves.toMatchObject({ doubleReview: true, m8Approval: true });

    await expect(l.verifyInstall(skill, {
      reviewApprovalId: review.approvalId,
      m8ApprovalId: m8.approvalId
    }, ctx("reviewer-1", ["genome:skill:install"], ["Reviewer"])))
      .rejects.toThrow(/APPROVAL_SEPARATION_OF_DUTIES/);
  });

  test("one actor cannot satisfy both review and M8 even with both roles", async () => {
    const l = await ledger();
    const skill = compileSkill(input());
    const both = ctx(
      "dual-role-actor",
      ["genome:skill:review", "genome:skill:m8"],
      ["Reviewer", "M8 Committee"]
    );
    const review = await l.attest(skill, "double_review", both);
    const m8 = await l.attest(skill, "m8", both);

    await expect(l.verifyInstall(skill, {
      reviewApprovalId: review.approvalId,
      m8ApprovalId: m8.approvalId
    }, ctx("installer-1", ["genome:skill:install"], ["Workflow Orchestrator"])))
      .rejects.toThrow(/APPROVAL_SEPARATION_OF_DUTIES/);
  });

  test("attestation cannot be replayed for a modified skill or another tenant", async () => {
    const l = await ledger();
    const skill = compileSkill(input());
    const review = await l.attest(skill, "double_review", ctx(
      "reviewer-1",
      ["genome:skill:review"],
      ["Reviewer"]
    ));
    const m8 = await l.attest(skill, "m8", ctx(
      "m8-1",
      ["genome:skill:m8"],
      ["M8 Committee"]
    ));
    const modified = compileSkill(input({ problem: "release a modified payment after alternate evidence" }));

    await expect(l.verifyInstall(modified, {
      reviewApprovalId: review.approvalId,
      m8ApprovalId: m8.approvalId
    }, ctx("installer-1", ["genome:skill:install"], ["Workflow Orchestrator"])))
      .rejects.toThrow(/APPROVAL_SUBJECT_MISMATCH/);

    await expect(l.verifyInstall(skill, {
      reviewApprovalId: review.approvalId,
      m8ApprovalId: m8.approvalId
    }, {
      ...ctx("installer-1", ["genome:skill:install"], ["Workflow Orchestrator"]),
      tenantId: "tenant-ci"
    })).rejects.toThrow(/APPROVAL_TENANT_MISMATCH/);
  });

  test("tampering or expiry invalidates an attestation", async () => {
    const l = await ledger();
    const skill = compileSkill(input());
    const review = await l.attest(skill, "double_review", ctx(
      "reviewer-1",
      ["genome:skill:review"],
      ["Reviewer"]
    ));
    const record = l.recordPath(review.approvalId);
    const raw = JSON.parse(await readFile(record, "utf8"));
    raw.actorId = "tampered";
    await writeFile(record, JSON.stringify(raw), "utf8");

    await expect(l.read(review.approvalId)).rejects.toThrow(/APPROVAL_INTEGRITY_FAILURE/);

    const expiringRoot = await mkdtemp(path.join(tmpdir(), "genesis-approval-expiry-"));
    roots.push(expiringRoot);
    const expiring = new GovernanceApprovalLedger(expiringRoot, 0);
    const short = await expiring.attest(skill, "double_review", ctx(
      "reviewer-2",
      ["genome:skill:review"],
      ["Reviewer"]
    ));
    await expect(expiring.verifyInstall(skill, { reviewApprovalId: short.approvalId }, ctx(
      "installer-2",
      ["genome:skill:install"],
      ["Workflow Orchestrator"]
    ))).rejects.toThrow(/APPROVAL_EXPIRED/);
  });
});
