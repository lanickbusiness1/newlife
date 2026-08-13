import { mkdtemp, rm } from "node:fs/promises";
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
    id: "procurement.payment.concurrent-test",
    version: "1.0.0",
    level: "L3",
    domain: "govtech.procurement",
    problem: "release governed payment without revocation race conditions",
    triggers: ["milestone approved"],
    inputs: ["milestone_evidence"],
    outputs: ["payment_release_decision"],
    dependencies: ["contract_registry"],
    connectors: ["treasury"],
    permissions: ["payment:propose"],
    procedure: ["verify milestone evidence"],
    verification: ["human review"],
    remeEvidence: ["REME-CONCURRENCY-001"],
    metrics: ["race_free_install"],
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

function ctx(actorId: string, scopes: string[], roles: string[]): BoundRequestContext {
  return {
    issuer: "https://id.afriagenesis.test",
    tenantId: "tenant-gn",
    actorId,
    agentId: `agent-${actorId}`,
    permissionScope: scopes,
    roles,
    amr: ["pwd", "mfa"],
    allowedCountries: ["GN"],
    allowedOrganizations: ["PPCC"],
    allowedMissions: ["govtech-procurement"],
    correlationId: "06d8d70b-f038-4272-858c-f60a78263e13",
    purpose: "prove revocation install serialization",
    dataClassification: "internal"
  };
}

async function setup() {
  const root = await mkdtemp(path.join(tmpdir(), "genesis-approval-concurrency-"));
  roots.push(root);
  const ledger = new GovernanceApprovalLedger(root, 3600);
  const skill = compileSkill(input());
  const review = await ledger.attest(skill, "double_review", ctx(
    "reviewer-1",
    ["genome:skill:review"],
    ["Reviewer"]
  ));
  const m8 = await ledger.attest(skill, "m8", ctx(
    "m8-1",
    ["genome:skill:m8"],
    ["M8 Committee"]
  ));
  return { ledger, skill, review, m8 };
}

describe("Governance approval install/revocation serialization", () => {
  test("revocation cannot linearize inside the verified-install critical section", async () => {
    const { ledger, skill, review, m8 } = await setup();
    let enterCritical!: () => void;
    const entered = new Promise<void>(resolve => { enterCritical = resolve; });
    let releaseCritical!: () => void;
    const release = new Promise<void>(resolve => { releaseCritical = resolve; });

    const install = ledger.withVerifiedInstall(
      skill,
      { reviewApprovalId: review.approvalId, m8ApprovalId: m8.approvalId },
      ctx("installer-1", ["genome:skill:install"], ["Workflow Orchestrator"]),
      async approvals => {
        expect(approvals).toEqual({ doubleReview: true, m8Approval: true });
        enterCritical();
        await release;
        return "installed";
      }
    );

    await entered;
    await expect(ledger.revoke(
      review.approvalId,
      "double_review",
      ctx("reviewer-2", ["genome:skill:review"], ["Reviewer"]),
      "evidence withdrawn during install"
    )).rejects.toThrow(/APPROVAL_OPERATION_BUSY/);

    releaseCritical();
    await expect(install).resolves.toBe("installed");

    await expect(ledger.revoke(
      review.approvalId,
      "double_review",
      ctx("reviewer-2", ["genome:skill:review"], ["Reviewer"]),
      "evidence withdrawn after install"
    )).resolves.toMatchObject({ approvalId: review.approvalId });
  });

  test("a revocation that linearizes first blocks the verified-install transaction", async () => {
    const { ledger, skill, review, m8 } = await setup();
    await ledger.revoke(
      review.approvalId,
      "double_review",
      ctx("reviewer-2", ["genome:skill:review"], ["Reviewer"]),
      "evidence withdrawn before install"
    );

    await expect(ledger.withVerifiedInstall(
      skill,
      { reviewApprovalId: review.approvalId, m8ApprovalId: m8.approvalId },
      ctx("installer-1", ["genome:skill:install"], ["Workflow Orchestrator"]),
      async () => "must-not-run"
    )).rejects.toThrow(/APPROVAL_REVOKED/);
  });

  test("two concurrent installs using the same approvals cannot both enter the critical section", async () => {
    const { ledger, skill, review, m8 } = await setup();
    let releaseCritical!: () => void;
    const release = new Promise<void>(resolve => { releaseCritical = resolve; });
    let firstEntered!: () => void;
    const entered = new Promise<void>(resolve => { firstEntered = resolve; });

    const first = ledger.withVerifiedInstall(
      skill,
      { reviewApprovalId: review.approvalId, m8ApprovalId: m8.approvalId },
      ctx("installer-1", ["genome:skill:install"], ["Workflow Orchestrator"]),
      async () => {
        firstEntered();
        await release;
        return "first";
      }
    );
    await entered;

    await expect(ledger.withVerifiedInstall(
      skill,
      { reviewApprovalId: review.approvalId, m8ApprovalId: m8.approvalId },
      ctx("installer-2", ["genome:skill:install"], ["Workflow Orchestrator"]),
      async () => "second"
    )).rejects.toThrow(/APPROVAL_OPERATION_BUSY/);

    releaseCritical();
    await expect(first).resolves.toBe("first");
  });
});
