import { describe, expect, test } from "vitest";
import { SKILL_MCP_HEALTH, SKILL_MCP_TOOL_NAMES } from "../src/mcpSkillTools";

describe("GENESIS V4 Skill Factory MCP surface", () => {
  test("publishes the governed Skill Factory health anchors", () => {
    expect(SKILL_MCP_HEALTH).toEqual({
      skillFactory: "GEN-V4-SKILL-FACTORY-002",
      skillRegistry: "GENESIS_SKILL_REGISTRY_0.2.0",
      approvalLedger: "GENESIS_GOVERNANCE_APPROVAL_LEDGER_0.1.0",
      approvalRevocation: "GENESIS_GOVERNANCE_APPROVAL_REVOCATION_0.1.0",
      countryCompiler: "GEN-V4-COUNTRY-COMPILER-001"
    });
  });

  test("publishes the complete least-privilege tool surface", () => {
    expect(SKILL_MCP_TOOL_NAMES).toEqual([
      "genome.skill_factory.compile",
      "genome.skill_factory.match",
      "genome.skill_approval.review_attest",
      "genome.skill_approval.m8_attest",
      "genome.skill_approval.review_revoke",
      "genome.skill_approval.m8_revoke",
      "genome.skill_factory.install",
      "genome.skill_factory.promote",
      "genome.skill_registry.list",
      "genome.skill_registry.read",
      "genome.country_compiler.compile"
    ]);
  });
});
