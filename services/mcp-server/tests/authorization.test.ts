import { describe, expect, test } from "vitest";
import { authorizeContext } from "../src/authorization";
import type { BoundRequestContext } from "../src/auth";

function context(overrides: Partial<BoundRequestContext> = {}): BoundRequestContext {
  return {
    issuer: "https://id.afriagenesis.test",
    tenantId: "tenant-gn",
    actorId: "user-123",
    agentId: "agent-skill-factory",
    permissionScope: ["genome:skill:compile"],
    roles: ["Analyst"],
    amr: ["pwd"],
    correlationId: "06d8d70b-f038-4272-858c-f60a78263e13",
    purpose: "compile governed skill",
    dataClassification: "internal",
    ...overrides
  };
}

describe("ASIR authorization", () => {
  test("denies when the required scope is absent", () => {
    expect(() => authorizeContext(context(), "genome:skill:install"))
      .toThrow(/ECES_DENY: scope 'genome:skill:install' absent/);
  });

  test("restricted data requires a server-issued restricted-data scope", () => {
    expect(() => authorizeContext(context({
      dataClassification: "restricted",
      approvalContext: "approval-123"
    }), "genome:skill:compile")).toThrow(/ECES_DENY: scope 'data:restricted' absent/);
  });

  test("restricted data also requires an approval reference", () => {
    expect(() => authorizeContext(context({
      dataClassification: "restricted",
      permissionScope: ["genome:skill:compile", "data:restricted"]
    }), "genome:skill:compile")).toThrow(/ECES_REVIEW_REQUIRED: approvalContext absent/);
  });

  test("allows restricted data only with both scope and approval reference", () => {
    expect(() => authorizeContext(context({
      dataClassification: "restricted",
      permissionScope: ["genome:skill:compile", "data:restricted"],
      approvalContext: "approval-123"
    }), "genome:skill:compile")).not.toThrow();
  });
});
