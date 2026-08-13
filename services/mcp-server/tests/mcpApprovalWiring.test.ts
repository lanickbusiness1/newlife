import { describe, expect, test } from "vitest";
import { z } from "zod";
import type { BoundRequestContext } from "../src/auth";
import type { GovernanceApprovalLedger } from "../src/governanceApprovalLedger";
import { registerSkillMcpTools } from "../src/mcpSkillTools";
import type { SkillRegistry } from "../src/skillRegistry";

const contextSchema = z.any();
type Handler = (args: any) => Promise<unknown>;

const contextPack = {
  languageSemantic: { status: "covered", evidenceRefs: ["LANG-GN"] },
  regulatoryLegal: { status: "covered", evidenceRefs: ["LEGAL-GN"] },
  institutional: { status: "covered", evidenceRefs: ["INST-GN"] },
  economicFinancialPayment: { status: "covered", evidenceRefs: ["ECO-GN"] },
  culturalHumanAdoption: { status: "covered", evidenceRefs: ["CULT-GN"] },
  infrastructureResilience: { status: "covered", evidenceRefs: ["INFRA-GN"] },
  marketBusinessRevenue: { status: "covered", evidenceRefs: ["MKT-GN"] },
  technologyDataAgenticAI: { status: "covered", evidenceRefs: ["TECH-GN"] },
  governanceSovereigntyAssurance: { status: "covered", evidenceRefs: ["GOV-GN"] }
};

const payload = {
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
  procedure: ["verify milestone evidence"],
  verification: ["human review"],
  remeEvidence: ["REME-PAY-001"],
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
  secondContextTestPassed: true
};

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
    purpose: "govern skill installation",
    dataClassification: "internal"
  };
}

function capture(registry: SkillRegistry, ledger: GovernanceApprovalLedger) {
  const handlers = new Map<string, Handler>();
  const schemas = new Map<string, Record<string, z.ZodTypeAny>>();
  const scopes = new Map<string, string>();
  const register = (
    name: string,
    _description: string,
    inputSchema: Record<string, z.ZodTypeAny>,
    requiredScope: string,
    handler: Handler
  ) => {
    handlers.set(name, handler);
    schemas.set(name, inputSchema);
    scopes.set(name, requiredScope);
  };
  registerSkillMcpTools(register, contextSchema, registry, ledger);
  return { handlers, schemas, scopes };
}

describe("Skill MCP governance approval wiring", () => {
  test("registers distinct review and M8 attestation tools with distinct scopes", () => {
    const { handlers, scopes } = capture({} as SkillRegistry, {} as GovernanceApprovalLedger);
    expect(handlers.has("genome.skill_approval.review_attest")).toBe(true);
    expect(handlers.has("genome.skill_approval.m8_attest")).toBe(true);
    expect(scopes.get("genome.skill_approval.review_attest")).toBe("genome:skill:review");
    expect(scopes.get("genome.skill_approval.m8_attest")).toBe("genome:skill:m8");
  });

  test("install input accepts only immutable approval references, not approval booleans", () => {
    const { schemas } = capture({} as SkillRegistry, {} as GovernanceApprovalLedger);
    const install = schemas.get("genome.skill_factory.install");
    expect(install?.approvalRefs).toBeDefined();
    expect(install?.approvals).toBeUndefined();
    expect(() => install?.approvalRefs.parse({
      reviewApprovalId: "06d8d70b-f038-4272-858c-f60a78263e13",
      m8ApprovalId: "16d8d70b-f038-4272-858c-f60a78263e13"
    })).not.toThrow();
    expect(() => install?.approvalRefs.parse({ m8Approval: true })).toThrow();
  });

  test("attestation tools compile the exact payload and persist the corresponding kind", async () => {
    const calls: Array<{ kind: string; actorId: string; skillId: string }> = [];
    const ledger = {
      attest: async (skill: any, kind: string, context: BoundRequestContext) => {
        calls.push({ kind, actorId: context.actorId, skillId: skill.id });
        return { approvalId: `${kind}-approval`, kind, subject: { skillId: skill.id } };
      }
    } as unknown as GovernanceApprovalLedger;
    const { handlers } = capture({} as SkillRegistry, ledger);

    await handlers.get("genome.skill_approval.review_attest")?.({
      context: ctx("reviewer-1", ["genome:skill:review"], ["Reviewer"]), payload
    });
    await handlers.get("genome.skill_approval.m8_attest")?.({
      context: ctx("m8-1", ["genome:skill:m8"], ["M8 Committee"]), payload
    });

    expect(calls).toEqual([
      { kind: "double_review", actorId: "reviewer-1", skillId: "procurement.payment.release" },
      { kind: "m8", actorId: "m8-1", skillId: "procurement.payment.release" }
    ]);
  });

  test("install keeps approval verification locked through the registry write", async () => {
    const events: string[] = [];
    const ledger = {
      verifyInstall: async () => {
        throw new Error("UNSAFE_VERIFY_INSTALL_PATH_USED");
      },
      withVerifiedInstall: async (
        skill: any,
        refs: any,
        context: BoundRequestContext,
        operation: (approvals: { doubleReview: boolean; m8Approval: boolean }) => Promise<unknown>
      ) => {
        events.push(`critical-enter:${context.actorId}:${refs.reviewApprovalId}:${refs.m8ApprovalId}`);
        const result = await operation({ doubleReview: true, m8Approval: true });
        events.push(`critical-exit:${skill.id}`);
        return result;
      }
    } as unknown as GovernanceApprovalLedger;
    const registry = {
      install: async (skill: any, approvals: any) => {
        events.push(`install:${skill.id}:${approvals.doubleReview}:${approvals.m8Approval}`);
        return { skill };
      }
    } as unknown as SkillRegistry;
    const { handlers } = capture(registry, ledger);

    await handlers.get("genome.skill_factory.install")?.({
      context: ctx("installer-1", ["genome:skill:install"], ["Workflow Orchestrator"]),
      payload,
      approvalRefs: {
        reviewApprovalId: "06d8d70b-f038-4272-858c-f60a78263e13",
        m8ApprovalId: "16d8d70b-f038-4272-858c-f60a78263e13"
      }
    });

    expect(events).toEqual([
      "critical-enter:installer-1:06d8d70b-f038-4272-858c-f60a78263e13:16d8d70b-f038-4272-858c-f60a78263e13",
      "install:procurement.payment.release:true:true",
      "critical-exit:procurement.payment.release"
    ]);
  });
});
