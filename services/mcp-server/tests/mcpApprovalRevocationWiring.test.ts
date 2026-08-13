import { describe, expect, test } from "vitest";
import { z } from "zod";
import type { BoundRequestContext } from "../src/auth";
import type { GovernanceApprovalLedger } from "../src/governanceApprovalLedger";
import { registerSkillMcpTools } from "../src/mcpSkillTools";
import type { SkillRegistry } from "../src/skillRegistry";

const contextSchema = z.any();
type Handler = (args: any) => Promise<unknown>;

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
    purpose: "withdraw a governance approval",
    dataClassification: "internal"
  };
}

function capture(ledger: GovernanceApprovalLedger) {
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
  registerSkillMcpTools(register, contextSchema, {} as SkillRegistry, ledger);
  return { handlers, schemas, scopes };
}

describe("Skill MCP approval revocation wiring", () => {
  test("registers distinct review and M8 revoke tools with the corresponding authority scopes", () => {
    const { handlers, scopes } = capture({} as GovernanceApprovalLedger);

    expect(handlers.has("genome.skill_approval.review_revoke")).toBe(true);
    expect(handlers.has("genome.skill_approval.m8_revoke")).toBe(true);
    expect(scopes.get("genome.skill_approval.review_revoke")).toBe("genome:skill:review");
    expect(scopes.get("genome.skill_approval.m8_revoke")).toBe("genome:skill:m8");
  });

  test("revocation inputs require an approval UUID and a meaningful reason", () => {
    const { schemas } = capture({} as GovernanceApprovalLedger);
    const review = schemas.get("genome.skill_approval.review_revoke");

    expect(() => review?.approvalId.parse("06d8d70b-f038-4272-858c-f60a78263e13")).not.toThrow();
    expect(() => review?.approvalId.parse("not-a-uuid")).toThrow();
    expect(() => review?.reason.parse("evidence withdrawn")).not.toThrow();
    expect(() => review?.reason.parse("x")).toThrow();
  });

  test("review revoke routes only to double_review and preserves verified actor context", async () => {
    const calls: any[] = [];
    const ledger = {
      revoke: async (approvalId: string, kind: string, context: BoundRequestContext, reason: string) => {
        calls.push({ approvalId, kind, actorId: context.actorId, reason });
        return { approvalId, kind, actorId: context.actorId, reason };
      }
    } as unknown as GovernanceApprovalLedger;
    const { handlers } = capture(ledger);

    const approvalId = "06d8d70b-f038-4272-858c-f60a78263e13";
    await handlers.get("genome.skill_approval.review_revoke")?.({
      context: ctx("reviewer-2", ["genome:skill:review"], ["Reviewer"]),
      approvalId,
      reason: "evidence withdrawn"
    });

    expect(calls).toEqual([{
      approvalId,
      kind: "double_review",
      actorId: "reviewer-2",
      reason: "evidence withdrawn"
    }]);
  });

  test("M8 revoke routes only to m8 and preserves verified actor context", async () => {
    const calls: any[] = [];
    const ledger = {
      revoke: async (approvalId: string, kind: string, context: BoundRequestContext, reason: string) => {
        calls.push({ approvalId, kind, actorId: context.actorId, reason });
        return { approvalId, kind, actorId: context.actorId, reason };
      }
    } as unknown as GovernanceApprovalLedger;
    const { handlers } = capture(ledger);

    const approvalId = "16d8d70b-f038-4272-858c-f60a78263e13";
    await handlers.get("genome.skill_approval.m8_revoke")?.({
      context: ctx("m8-2", ["genome:skill:m8"], ["M8 Committee"]),
      approvalId,
      reason: "risk posture changed"
    });

    expect(calls).toEqual([{
      approvalId,
      kind: "m8",
      actorId: "m8-2",
      reason: "risk posture changed"
    }]);
  });
});
