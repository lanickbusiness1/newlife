import { describe, expect, test } from "vitest";
import { z } from "zod";
import { registerSkillMcpTools } from "../src/mcpSkillTools";
import { SkillRegistry } from "../src/skillRegistry";

const contextSchema = z.any();

type Handler = (args: any) => Promise<unknown>;

function capture(registry: SkillRegistry) {
  const handlers = new Map<string, Handler>();
  const register = (
    name: string,
    _description: string,
    _inputSchema: Record<string, z.ZodTypeAny>,
    _requiredScope: string,
    handler: Handler
  ) => handlers.set(name, handler);
  registerSkillMcpTools(register, contextSchema, registry);
  return handlers;
}

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

function context(countries: string[], organizations: string[] = []) {
  return {
    issuer: "https://id.afriagenesis.test",
    tenantId: "tenant-mru",
    actorId: "user-1",
    agentId: "agent-1",
    permissionScope: ["genome:skill:read"],
    roles: ["Analyst"],
    amr: ["pwd"],
    allowedCountries: countries,
    allowedOrganizations: organizations,
    allowedMissions: [],
    correlationId: "06d8d70b-f038-4272-858c-f60a78263e13",
    purpose: "search reusable governed skill",
    dataClassification: "internal"
  };
}

function fakeEntry(id: string, countries: string[] = [], institutions: string[] = []) {
  return {
    registryVersion: "GENESIS_SKILL_REGISTRY_0.2.0",
    installedAt: "2026-08-13T00:00:00.000Z",
    lifecycle: { status: "active" },
    integrity: { algorithm: "sha256", sha256: "a".repeat(64) },
    skill: { id, version: "1.0.0", countries, institutions }
  } as any;
}

describe("Skill MCP territorial wiring", () => {
  test("registry match enforces verified country attributes before matching", async () => {
    const registry = new SkillRegistry(`/tmp/genesis-mcp-territorial-${Date.now()}`);
    const handlers = capture(registry);
    const handler = handlers.get("genome.skill_factory.match");
    expect(handler).toBeDefined();

    await expect(handler?.({ context: context(["GN"]), request: request("GN") }))
      .resolves.toMatchObject({ decision: "compile_gap" });

    await expect(handler?.({ context: context(["GN"]), request: request("CI") }))
      .rejects.toThrow(/ECES_ABAC_COUNTRY_DENY:CI/);
  });

  test("registry list hides territorial skills outside verified attributes", async () => {
    const global = fakeEntry("core.global");
    const guinea = fakeEntry("country.gn", ["GN"]);
    const ivoryCoast = fakeEntry("country.ci", ["CI"]);
    const restrictedInstitution = fakeEntry("institution.ppcc", ["GN"], ["PPCC"]);
    const registry = {
      list: async () => [global, guinea, ivoryCoast, restrictedInstitution]
    } as unknown as SkillRegistry;
    const handlers = capture(registry);

    const visible = await handlers.get("genome.skill_registry.list")?.({ context: context(["GN"]) }) as any[];
    expect(visible.map(entry => entry.skill.id)).toEqual(["core.global", "country.gn"]);

    const visibleWithOrg = await handlers.get("genome.skill_registry.list")?.({
      context: context(["GN"], ["PPCC"])
    }) as any[];
    expect(visibleWithOrg.map(entry => entry.skill.id)).toEqual([
      "core.global",
      "country.gn",
      "institution.ppcc"
    ]);
  });

  test("registry read denies a territorial skill outside verified attributes", async () => {
    const records = new Map([
      ["country.gn", fakeEntry("country.gn", ["GN"])],
      ["country.ci", fakeEntry("country.ci", ["CI"])]
    ]);
    const registry = {
      read: async (id: string) => records.get(id)
    } as unknown as SkillRegistry;
    const handlers = capture(registry);
    const read = handlers.get("genome.skill_registry.read");

    await expect(read?.({ context: context(["GN"]), id: "country.gn", version: "1.0.0" }))
      .resolves.toMatchObject({ skill: { id: "country.gn" } });

    await expect(read?.({ context: context(["GN"]), id: "country.ci", version: "1.0.0" }))
      .rejects.toThrow(/ECES_ABAC_COUNTRY_DENY:CI/);
  });
});
