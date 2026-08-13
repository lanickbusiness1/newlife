import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { validateInstallApprovalAuthority } from "../src/mcpSkillTools";
import { compileSkill, type SkillFactoryInput } from "../src/skillFactory";
import { SkillRegistry } from "../src/skillRegistry";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

const context = {
  languageSemantic: { status: "covered" as const, evidenceRefs: ["LANG"] },
  regulatoryLegal: { status: "covered" as const, evidenceRefs: ["LEGAL"] },
  institutional: { status: "covered" as const, evidenceRefs: ["INST"] },
  economicFinancialPayment: { status: "covered" as const, evidenceRefs: ["ECO"] },
  culturalHumanAdoption: { status: "covered" as const, evidenceRefs: ["CULT"] },
  infrastructureResilience: { status: "covered" as const, evidenceRefs: ["INFRA"] },
  marketBusinessRevenue: { status: "covered" as const, evidenceRefs: ["MKT"] },
  technologyDataAgenticAI: { status: "covered" as const, evidenceRefs: ["TECH"] },
  governanceSovereigntyAssurance: { status: "covered" as const, evidenceRefs: ["GOV"] }
};

function validInput(overrides: Partial<SkillFactoryInput> = {}): SkillFactoryInput {
  return {
    id: "procurement.security.hardening",
    version: "1.0.0",
    level: "L3",
    domain: "govtech.procurement",
    problem: "secure governed supplier verification workflow",
    triggers: ["supplier onboarding"],
    inputs: ["supplier_profile"],
    outputs: ["verification_result"],
    dependencies: [],
    connectors: [],
    permissions: ["supplier:read"],
    procedure: ["verify evidence"],
    verification: ["security test"],
    remeEvidence: ["REME-HARDENING"],
    metrics: ["integrity"],
    rollback: "restore previous immutable version",
    languages: ["fr"],
    countries: ["GN"],
    context,
    stratex9: { status: "go", evidenceRefs: ["S9-GN"] },
    configurableMetadata: {},
    universalInvariants: {},
    outcomeEvidencePresent: true,
    localRulesSeparated: true,
    permissionsBounded: true,
    doubleReviewPassed: true,
    secondContextTestPassed: true,
    ...overrides
  };
}

async function registry() {
  const root = await mkdtemp(path.join(tmpdir(), "genesis-skill-security-"));
  roots.push(root);
  return new SkillRegistry(root);
}

describe("GENESIS V4 Skill Factory security hardening", () => {
  test("a sensitive Skill DNA cannot self-declare M8 approval", () => {
    const raw = {
      ...validInput({ riskDomains: ["payment"] }),
      m8Approval: true
    };
    const skill = compileSkill(raw);

    expect(skill.status).toBe("m8_required");
    expect(skill.m8ApprovalRequired).toBe(true);
    expect(skill.doubleReviewRequired).toBe(true);
  });

  test("detects secrets embedded in configurable metadata", () => {
    const skill = compileSkill(validInput({
      configurableMetadata: { apiKey: "super-secret-live-key" }
    }));

    expect(skill.status).toBe("blocked");
    expect(skill.blockers).toContain("S7_DESTRUCTIVE_CONTENT");
  });

  test("requires double review in addition to external M8 approval at install time", async () => {
    const r = await registry();
    const skill = compileSkill(validInput({ riskDomains: ["payment"] }));

    await expect(r.install(skill, { m8Approval: true })).rejects.toThrow(/DOUBLE_REVIEW_REQUIRED/);
    await expect(r.install(skill, { m8Approval: true, doubleReview: true })).resolves.toBeDefined();
  });

  test("makes an installed id/version immutable", async () => {
    const r = await registry();
    await r.install(compileSkill(validInput()));
    const changed = compileSkill(validInput({ problem: "secure a materially changed supplier verification workflow" }));

    await expect(r.install(changed)).rejects.toThrow(/SKILL_VERSION_IMMUTABLE/);
  });

  test("rejects unsafe registry path identifiers instead of silently normalizing them", async () => {
    const r = await registry();
    const skill = compileSkill(validInput({ id: "procurement/escape" }));

    await expect(r.install(skill)).rejects.toThrow(/SKILL_REGISTRY_INVALID_PATH_SEGMENT/);
  });

  test("does not accept approval booleans without the corresponding authority scopes", () => {
    expect(() => validateInstallApprovalAuthority(
      { m8Approval: true },
      ["genome:skill:install"]
    )).toThrow(/M8_APPROVAL_SCOPE_REQUIRED/);

    expect(() => validateInstallApprovalAuthority(
      { doubleReview: true },
      ["genome:skill:install"]
    )).toThrow(/DOUBLE_REVIEW_SCOPE_REQUIRED/);

    expect(() => validateInstallApprovalAuthority(
      { m8Approval: true, doubleReview: true },
      ["genome:skill:install", "genome:skill:m8", "genome:skill:review"]
    )).not.toThrow();
  });
});
