import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { BoundRequestContext } from "../src/auth";
import { GovernanceApprovalLedger } from "../src/governanceApprovalLedger";
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
    id: "procurement.payment.revoke-test",
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
    procedure: ["verify milestone evidence"],
    verification: ["human review"],
    remeEvidence: ["REME-REV-001"],
    metrics: ["accuracy"],
    rollback: "restore prior governed state",
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

function ctx(actorId: string, scopes: string[], roles: string[], tenantId = "tenant-gn"): BoundRequestContext {
  return {
    issuer: "https://id.afriagenesis.test",
    tenantId,
    actorId,
    agentId: `agent-${actorId}`,
    permissionScope: scopes,
    roles,
    amr: ["pwd", "mfa"],
    allowedCountries: ["GN"],
    allowedOrganizations: ["PPCC"],
    allowedMissions: ["govtech-procurement"],
    correlationId: "06d8d70b-f038-4272-858c-f60a78263e13",
    purpose: "revoke governance approval",
    dataClassification: "internal"
  };
}

async function ledger() {
  const root = await mkdtemp(path.join(tmpdir(), "genesis-approval-revoke-"));
  roots.push(root);
  return new GovernanceApprovalLedger(root, 3600);
}

describe("GENESIS Governance Approval revocation", () => {
  test("revocation is append-only and does not modify the original attestation", async () => {
    const l = await ledger();
    const skill = compileSkill(input());
    const review = await l.attest(skill, "double_review", ctx(
      "reviewer-1",
      ["genome:skill:review"],
      ["Reviewer"]
    ));
    const before = await readFile(l.recordPath(review.approvalId), "utf8");

    const revocation = await l.revoke(
      review.approvalId,
      "double_review",
      ctx("reviewer-2", ["genome:skill:review"], ["Reviewer"]),
      "material evidence was withdrawn"
    );

    expect(revocation.approvalId).toBe(review.approvalId);
    expect(revocation.kind).toBe("double_review");
    expect(revocation.reason).toBe("material evidence was withdrawn");
    expect(revocation.integrity.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(await readFile(l.recordPath(review.approvalId), "utf8")).toBe(before);
    expect(await l.readRevocation(review.approvalId)).toMatchObject({
      actorId: "reviewer-2",
      reason: "material evidence was withdrawn"
    });
  });

  test("revocation requires matching authority kind, tenant, scope, role and MFA", async () => {
    const l = await ledger();
    const skill = compileSkill(input());
    const m8 = await l.attest(skill, "m8", ctx(
      "m8-1",
      ["genome:skill:m8"],
      ["M8 Committee"]
    ));

    await expect(l.revoke(
      m8.approvalId,
      "double_review",
      ctx("reviewer-1", ["genome:skill:review"], ["Reviewer"]),
      "wrong authority path"
    )).rejects.toThrow(/APPROVAL_KIND_MISMATCH:m8/);

    await expect(l.revoke(
      m8.approvalId,
      "m8",
      ctx("m8-other-tenant", ["genome:skill:m8"], ["M8 Committee"], "tenant-ci"),
      "cross tenant attempt"
    )).rejects.toThrow(/APPROVAL_TENANT_MISMATCH/);

    await expect(l.revoke(
      m8.approvalId,
      "m8",
      { ...ctx("m8-no-mfa", ["genome:skill:m8"], ["M8 Committee"]), amr: ["pwd"] },
      "missing mfa"
    )).rejects.toThrow(/APPROVAL_MFA_REQUIRED:m8/);
  });

  test("a revoked review or M8 attestation can never authorize installation", async () => {
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

    await l.revoke(
      review.approvalId,
      "double_review",
      ctx("reviewer-2", ["genome:skill:review"], ["Reviewer"]),
      "review withdrawn"
    );

    await expect(l.verifyInstall(skill, {
      reviewApprovalId: review.approvalId,
      m8ApprovalId: m8.approvalId
    }, ctx("installer-1", ["genome:skill:install"], ["Workflow Orchestrator"])))
      .rejects.toThrow(/APPROVAL_REVOKED/);
  });

  test("revocation itself is immutable, tamper-evident and cannot be repeated", async () => {
    const l = await ledger();
    const skill = compileSkill(input({
      riskDomains: [],
      warnings: ["review required"]
    }));
    const review = await l.attest(skill, "double_review", ctx(
      "reviewer-1",
      ["genome:skill:review"],
      ["Reviewer"]
    ));
    const revoked = await l.revoke(
      review.approvalId,
      "double_review",
      ctx("reviewer-2", ["genome:skill:review"], ["Reviewer"]),
      "withdrawn"
    );

    await expect(l.revoke(
      review.approvalId,
      "double_review",
      ctx("reviewer-3", ["genome:skill:review"], ["Reviewer"]),
      "second withdrawal"
    )).rejects.toThrow(/APPROVAL_ALREADY_REVOKED/);

    const revocationPath = l.revocationPath(revoked.approvalId);
    const raw = JSON.parse(await readFile(revocationPath, "utf8"));
    raw.reason = "tampered";
    await writeFile(revocationPath, JSON.stringify(raw), "utf8");

    await expect(l.readRevocation(revoked.approvalId)).rejects.toThrow(/APPROVAL_REVOCATION_INTEGRITY_FAILURE/);
  });
});
