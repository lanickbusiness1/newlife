import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { compileCountrySkill } from "../src/countryCompiler";
import { compileSkill, type SkillFactoryInput } from "../src/skillFactory";
import { SkillRegistry } from "../src/skillRegistry";

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

function input(level: SkillFactoryInput["level"], id: string, overrides: Partial<SkillFactoryInput> = {}): SkillFactoryInput {
  const territorial = ["L2", "L3", "L4", "L5"].includes(level);
  return {
    id,
    version: "1.0.0",
    level,
    domain: "govtech.procurement",
    problem: "verify suppliers under governed procurement workflow",
    triggers: ["supplier onboarding"],
    inputs: ["supplier_profile"],
    outputs: ["eligibility_status"],
    dependencies: [],
    connectors: [],
    permissions: ["supplier:read"],
    procedure: ["verify supplier evidence"],
    verification: ["unit test"],
    remeEvidence: ["REME-COUNTRY-001"],
    metrics: ["accuracy"],
    rollback: "restore previous country composition",
    languages: ["fr"],
    countries: territorial ? ["GN"] : [],
    regions: level === "L2" ? ["MRU"] : [],
    context: territorial ? contextPack : undefined,
    stratex9: territorial ? { status: "go", evidenceRefs: ["S9-GN"] } : undefined,
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

async function setup() {
  const root = await mkdtemp(path.join(tmpdir(), "genesis-country-compiler-"));
  roots.push(root);
  return new SkillRegistry(root);
}

describe("GENESIS V4 Country Compiler", () => {
  test("requires a complete STRATEX-99 country context", async () => {
    const registry = await setup();
    const core = await registry.install(compileSkill(input("L0", "core.procurement")));

    await expect(compileCountrySkill(registry, {
      countryCode: "GN",
      contextPack: undefined,
      stratex9Qualification: { status: "go", evidenceRefs: ["S9-GN"] },
      skillRefs: [{ id: core.skill.id, version: core.skill.version }]
    })).rejects.toThrow(/COUNTRY_CONTEXT_REQUIRED/);
  });

  test("rejects a STRATEX-9 no-go even when context exists", async () => {
    const registry = await setup();
    const core = await registry.install(compileSkill(input("L0", "core.procurement")));

    await expect(compileCountrySkill(registry, {
      countryCode: "GN",
      contextPack,
      stratex9Qualification: { status: "no_go", evidenceRefs: ["S9-NOGO"] },
      skillRefs: [{ id: core.skill.id, version: core.skill.version }]
    })).rejects.toThrow(/STRATEX9_NO_GO/);
  });

  test("requires STRATEX-9 evidence for go and conditional decisions", async () => {
    const registry = await setup();
    const core = await registry.install(compileSkill(input("L0", "core.procurement")));

    await expect(compileCountrySkill(registry, {
      countryCode: "GN",
      contextPack,
      stratex9Qualification: { status: "go", evidenceRefs: [] },
      skillRefs: [{ id: core.skill.id, version: core.skill.version }]
    })).rejects.toThrow(/STRATEX9_EVIDENCE_REQUIRED/);
  });

  test("rejects a country-specific skill from another jurisdiction", async () => {
    const registry = await setup();
    const liberia = compileSkill(input("L3", "country.supplier.verify", { countries: ["LR"] }));
    const saved = await registry.install(liberia);

    await expect(compileCountrySkill(registry, {
      countryCode: "GN",
      contextPack,
      stratex9Qualification: { status: "go", evidenceRefs: ["S9-GN"] },
      skillRefs: [{ id: saved.skill.id, version: saved.skill.version }]
    })).rejects.toThrow(/JURISDICTION_MISMATCH/);
  });

  test("preserves universal invariants against country overrides", async () => {
    const registry = await setup();
    const core = await registry.install(compileSkill(input("L0", "core.procurement", {
      universalInvariants: { humanFinalDecision: true, auditRequired: true },
      configurableMetadata: { language: "en", currency: "USD" }
    })));
    const country = await registry.install(compileSkill(input("L3", "country.procurement.gn", {
      configurableMetadata: { language: "fr", currency: "GNF", humanFinalDecision: false }
    })));

    await expect(compileCountrySkill(registry, {
      countryCode: "GN",
      contextPack,
      stratex9Qualification: { status: "go", evidenceRefs: ["S9-GN"] },
      skillRefs: [
        { id: core.skill.id, version: core.skill.version },
        { id: country.skill.id, version: country.skill.version }
      ]
    })).rejects.toThrow(/GENOME_INVARIANT_VIOLATION:humanFinalDecision/);
  });

  test("composes metadata from general to specific and preserves integrity lineage", async () => {
    const registry = await setup();
    const core = await registry.install(compileSkill(input("L0", "core.procurement", {
      universalInvariants: { auditRequired: true },
      configurableMetadata: { language: "en", currency: "USD", channel: "web" }
    })));
    const domain = await registry.install(compileSkill(input("L1", "domain.procurement", {
      configurableMetadata: { channel: "web+mobile" }
    })));
    const country = await registry.install(compileSkill(input("L3", "country.procurement.gn", {
      configurableMetadata: { language: "fr", currency: "GNF" }
    })));

    const output = await compileCountrySkill(registry, {
      countryCode: "GN",
      contextPack,
      stratex9Qualification: { status: "go", evidenceRefs: ["S9-GN"] },
      skillRefs: [
        { id: country.skill.id, version: country.skill.version },
        { id: core.skill.id, version: core.skill.version },
        { id: domain.skill.id, version: domain.skill.version }
      ]
    });

    expect(output.configuration).toEqual({ language: "fr", currency: "GNF", channel: "web+mobile" });
    expect(output.universalInvariants).toEqual({ auditRequired: true });
    expect(output.lineage.map(item => item.level)).toEqual(["L0", "L1", "L3"]);
    expect(output.lineage.every(item => /^[a-f0-9]{64}$/.test(item.sha256))).toBe(true);
    expect(output.countryCode).toBe("GN");
  });
});
