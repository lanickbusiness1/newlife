import { describe, expect, test } from "vitest";
import { z } from "zod";
import { registerSkillMcpTools } from "../src/mcpSkillTools";
import { SkillRegistry } from "../src/skillRegistry";

const contextSchema = z.any();

function request(country: string) {
  return {
    level: "L3",
    domain: "govtech.procurement",
    problem: "verify supplier eligibility before procurement submission",
    triggers: ["supplier onboarding"],
    inputs: ["supplier_profile"],
    outputs: ["eligibility_status"],
    dependencies: [],
    connectors: [],
    permissions: ["supplier:read"],
    countries: [country]
  };
}

function context(countries: string[]) {
  return {
    issuer: "https://id.afriagenesis.test",
    tenantId: "tenant-mru",
    actorId: "user-1",
    agentId: "agent-1",
    permissionScope: ["genome:skill:read"],
    roles: ["Analyst"],
    amr: ["pwd"],
    allowedCountries: countries,
    allowedOrganizations: [],
    allowedMissions: [],
    correlationId: "06d8d70b-f038-4272-858c-f60a78263e13",
    purpose: "search reusable governed skill",
    dataClassification: "internal"
  };
}

describe("Skill MCP territorial wiring", () => {
  test("registry match enforces verified country attributes before matching", async () => {
    const handlers = new Map<string, (args: any) => Promise<unknown>>();
    const register = (
      name: string,
      _description: string,
      _inputSchema: Record<string, z.ZodTypeAny>,
      _requiredScope: string,
      handler: (args: any) => Promise<unknown>
    ) => handlers.set(name, handler);

    const registry = new SkillRegistry(`/tmp/genesis-mcp-territorial-${Date.now()}`);
    registerSkillMcpTools(register, contextSchema, registry);
    const handler = handlers.get("genome.skill_factory.match");
    expect(handler).toBeDefined();

    await expect(handler?.({ context: context(["GN"]), request: request("GN") }))
      .resolves.toMatchObject({ decision: "compile_gap" });

    await expect(handler?.({ context: context(["GN"]), request: request("CI") }))
      .rejects.toThrow(/ECES_ABAC_COUNTRY_DENY:CI/);
  });
});
