import { describe, expect, test } from "vitest";
import { authorizeTerritorialTarget } from "../src/authorization";
import type { BoundRequestContext } from "../src/auth";

function context(overrides: Partial<BoundRequestContext> = {}): BoundRequestContext {
  return {
    issuer: "https://id.afriagenesis.test",
    tenantId: "tenant-mru",
    actorId: "user-123",
    agentId: "agent-skill-factory",
    permissionScope: ["genome:country:compile"],
    roles: ["Analyst"],
    amr: ["pwd"],
    allowedCountries: ["GN", "LR"],
    allowedOrganizations: ["PPCC", "MRU-SECRETARIAT"],
    allowedMissions: ["govtech-procurement"],
    correlationId: "06d8d70b-f038-4272-858c-f60a78263e13",
    purpose: "compile governed country skill",
    dataClassification: "internal",
    ...overrides
  };
}

describe("ASIR territorial ABAC", () => {
  test("allows an explicitly authorized country", () => {
    expect(() => authorizeTerritorialTarget(context(), { countries: ["GN"] })).not.toThrow();
  });

  test("denies a country outside verified token attributes", () => {
    expect(() => authorizeTerritorialTarget(context(), { countries: ["CI"] }))
      .toThrow(/ECES_ABAC_COUNTRY_DENY:CI/);
  });

  test("requires every country in a regional target to be authorized", () => {
    expect(() => authorizeTerritorialTarget(context(), { countries: ["GN", "LR"] })).not.toThrow();
    expect(() => authorizeTerritorialTarget(context(), { countries: ["GN", "SL"] }))
      .toThrow(/ECES_ABAC_COUNTRY_DENY:SL/);
  });

  test("denies an institution outside verified organization attributes", () => {
    expect(() => authorizeTerritorialTarget(context(), { organizations: ["NPPA"] }))
      .toThrow(/ECES_ABAC_ORGANIZATION_DENY:NPPA/);
  });

  test("enforces mission when a target mission is declared", () => {
    expect(() => authorizeTerritorialTarget(context(), { missions: ["govtech-procurement"] })).not.toThrow();
    expect(() => authorizeTerritorialTarget(context(), { missions: ["payments-modernization"] }))
      .toThrow(/ECES_ABAC_MISSION_DENY:payments-modernization/);
  });

  test("explicit wildcard attributes are honored but never inferred", () => {
    expect(() => authorizeTerritorialTarget(context({ allowedCountries: ["*"] }), { countries: ["CI"] })).not.toThrow();
    expect(() => authorizeTerritorialTarget(context({ allowedCountries: [] }), { countries: ["GN"] }))
      .toThrow(/ECES_ABAC_COUNTRY_DENY:GN/);
  });
});
