import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { compileSkill, type SkillFactoryInput, type SkillRequest } from "../src/skillFactory";
import { SkillRegistry } from "../src/skillRegistry";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

const coveredContext = {
  languageSemantic: { status: "covered" as const, evidenceRefs: ["S99-LANG"] },
  regulatoryLegal: { status: "covered" as const, evidenceRefs: ["S99-LEGAL"] },
  institutional: { status: "covered" as const, evidenceRefs: ["S99-INST"] },
  economicFinancialPayment: { status: "covered" as const, evidenceRefs: ["S99-ECO"] },
  culturalHumanAdoption: { status: "covered" as const, evidenceRefs: ["S99-CULT"] },
  infrastructureResilience: { status: "covered" as const, evidenceRefs: ["S99-INFRA"] },
  marketBusinessRevenue: { status: "covered" as const, evidenceRefs: ["S99-MKT"] },
  technologyDataAgenticAI: { status: "covered" as const, evidenceRefs: ["S99-TECH"] },
  governanceSovereigntyAssurance: { status: "covered" as const, evidenceRefs: ["S99-GOV"] }
};

function input(overrides: Partial<SkillFactoryInput> = {}): SkillFactoryInput {
  return {
    id: "procurement.supplier.verify",
    version: "1.0.0",
    level: "L3",
    domain: "govtech.procurement",
    problem: "verify supplier eligibility before bid submission",
    triggers: ["supplier onboarding"],
    inputs: ["supplier_profile"],
    outputs: ["eligibility_status"],
    dependencies: ["supplier_registry"],
    connectors: ["company_registry"],
    permissions: ["supplier:read"],
    procedure: ["verify registration evidence"],
    verification: ["unit tests", "human review"],
    remeEvidence: ["REME-001"],
    metrics: ["accuracy"],
    rollback: "restore previous registry pointer",
    languages: ["en"],
    countries: ["LR", "SL"],
    context: coveredContext,
    stratex9: { status: "go", evidenceRefs: ["STRATEX9-001"] },
    outcomeEvidencePresent: true,
    localRulesSeparated: true,
    permissionsBounded: true,
    doubleReviewPassed: true,
    secondContextTestPassed: true,
    ...overrides
  };
}

async function registry() {
  const root = await mkdtemp(path.join(tmpdir(), "genesis-skill-registry-"));
  roots.push(root);
  return new SkillRegistry(root);
}

describe("GENESIS Skill Registry", () => {
  test("refuses blocked skills", async () => {
    const r = await registry();
    const skill = compileSkill(input({ procedure: ["sudo rm -rf /tmp/cache"] }));

    await expect(r.install(skill)).rejects.toThrow(/SKILL_INSTALL_BLOCKED/);
  });

  test("requires double review for alert_ready skills", async () => {
    const r = await registry();
    const skill = compileSkill(input({ warnings: ["optional benchmark missing"] }));

    await expect(r.install(skill)).rejects.toThrow(/DOUBLE_REVIEW_REQUIRED/);
    await expect(r.install(skill, { doubleReview: true })).resolves.toMatchObject({
      skill: { id: "procurement.supplier.verify" }
    });
  });

  test("requires M8 approval for m8_required skills", async () => {
    const r = await registry();
    const skill = compileSkill(input({ riskDomains: ["payment"] }));

    await expect(r.install(skill)).rejects.toThrow(/M8_APPROVAL_REQUIRED/);
    await expect(r.install(skill, { m8Approval: true })).resolves.toMatchObject({
      skill: { status: "m8_required" }
    });
  });

  test("stores and verifies SHA-256 integrity", async () => {
    const r = await registry();
    const saved = await r.install(compileSkill(input()));
    const loaded = await r.read(saved.skill.id, saved.skill.version);

    expect(loaded.integrity.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(loaded.skill.id).toBe(saved.skill.id);
  });

  test("fails closed when a persisted registry record is tampered with", async () => {
    const r = await registry();
    const saved = await r.install(compileSkill(input()));
    const recordPath = r.recordPath(saved.skill.id, saved.skill.version);
    const raw = JSON.parse(await readFile(recordPath, "utf8"));
    raw.skill.problem = "tampered problem";
    await writeFile(recordPath, JSON.stringify(raw, null, 2), "utf8");

    await expect(r.read(saved.skill.id, saved.skill.version)).rejects.toThrow(/SKILL_REGISTRY_INTEGRITY_FAILURE/);
  });

  test("matches reusable skills using the 80 percent threshold", async () => {
    const r = await registry();
    await r.install(compileSkill(input()));
    const request: SkillRequest = {
      level: "L3",
      domain: "govtech.procurement",
      problem: "verify supplier eligibility before bid submission",
      triggers: ["supplier onboarding"],
      inputs: ["supplier_profile"],
      outputs: ["eligibility_status"],
      dependencies: ["supplier_registry"],
      connectors: ["company_registry"],
      permissions: ["supplier:read"],
      countries: ["SL"]
    };

    const match = await r.match(request);
    expect(match.decision).toBe("reuse_or_compose");
    expect(match.score).toBeGreaterThanOrEqual(0.8);
    expect(match.best?.skill.id).toBe("procurement.supplier.verify");
  });

  test("deprecates without deleting historical skill records", async () => {
    const r = await registry();
    const saved = await r.install(compileSkill(input()));
    await r.deprecate(saved.skill.id, saved.skill.version, {
      id: "procurement.supplier.verify",
      version: "1.1.0"
    });

    const loaded = await r.read(saved.skill.id, saved.skill.version);
    expect(loaded.lifecycle.status).toBe("deprecated");
    expect(loaded.lifecycle.replacement).toEqual({
      id: "procurement.supplier.verify",
      version: "1.1.0"
    });
  });
});
