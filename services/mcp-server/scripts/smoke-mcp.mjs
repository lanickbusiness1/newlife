import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { compileCountrySkill } from "../dist/countryCompiler.js";
import { compileSkill } from "../dist/skillFactory.js";
import { SkillRegistry } from "../dist/skillRegistry.js";
import { SKILL_MCP_HEALTH, SKILL_MCP_TOOL_NAMES } from "../dist/mcpSkillTools.js";

const root = await mkdtemp(path.join(tmpdir(), "genesis-skill-smoke-"));

const contextPack = {
  languageSemantic: { status: "covered", evidenceRefs: ["SMOKE-LANG"] },
  regulatoryLegal: { status: "covered", evidenceRefs: ["SMOKE-LEGAL"] },
  institutional: { status: "covered", evidenceRefs: ["SMOKE-INST"] },
  economicFinancialPayment: { status: "covered", evidenceRefs: ["SMOKE-ECO"] },
  culturalHumanAdoption: { status: "covered", evidenceRefs: ["SMOKE-CULT"] },
  infrastructureResilience: { status: "covered", evidenceRefs: ["SMOKE-INFRA"] },
  marketBusinessRevenue: { status: "covered", evidenceRefs: ["SMOKE-MKT"] },
  technologyDataAgenticAI: { status: "covered", evidenceRefs: ["SMOKE-TECH"] },
  governanceSovereigntyAssurance: { status: "covered", evidenceRefs: ["SMOKE-GOV"] }
};

try {
  const registry = new SkillRegistry(root);
  const skill = compileSkill({
    id: "procurement.supplier.verify.smoke",
    version: "1.0.0",
    level: "L3",
    domain: "govtech.procurement",
    problem: "verify supplier eligibility in a governed country workflow",
    triggers: ["supplier onboarding"],
    inputs: ["supplier_profile"],
    outputs: ["eligibility_status"],
    dependencies: [],
    connectors: [],
    permissions: ["supplier:read"],
    procedure: ["verify supplier registration evidence"],
    verification: ["smoke verification"],
    remeEvidence: ["SMOKE-REME"],
    metrics: ["smoke_success"],
    rollback: "restore previous registry version",
    languages: ["fr"],
    countries: ["GN"],
    context: contextPack,
    stratex9: { status: "go", evidenceRefs: ["SMOKE-S9"] },
    configurableMetadata: { language: "fr", currency: "GNF" },
    universalInvariants: { auditRequired: true },
    outcomeEvidencePresent: true,
    localRulesSeparated: true,
    permissionsBounded: true,
    doubleReviewPassed: true,
    secondContextTestPassed: true
  });

  if (skill.status !== "draft_ready") throw new Error(`SMOKE_COMPILE_STATUS:${skill.status}`);
  const installed = await registry.install(skill);
  const read = await registry.read(installed.skill.id, installed.skill.version);
  const match = await registry.match({
    level: "L3",
    domain: "govtech.procurement",
    problem: "verify supplier eligibility in a governed country workflow",
    triggers: ["supplier onboarding"],
    inputs: ["supplier_profile"],
    outputs: ["eligibility_status"],
    dependencies: [],
    connectors: [],
    permissions: ["supplier:read"],
    countries: ["GN"]
  });
  if (match.decision !== "reuse_or_compose") throw new Error(`SMOKE_MATCH:${match.score}`);

  const country = await compileCountrySkill(registry, {
    countryCode: "GN",
    contextPack,
    stratex9Qualification: { status: "go", evidenceRefs: ["SMOKE-S9"] },
    skillRefs: [{ id: read.skill.id, version: read.skill.version }]
  });
  if (country.configuration.currency !== "GNF") throw new Error("SMOKE_COUNTRY_CURRENCY");
  if (!country.universalInvariants.auditRequired) throw new Error("SMOKE_GENOME_INVARIANT");
  if (SKILL_MCP_TOOL_NAMES.length !== 7) throw new Error("SMOKE_MCP_TOOL_COUNT");

  console.log(JSON.stringify({
    status: "ok",
    health: SKILL_MCP_HEALTH,
    skill: `${read.skill.id}@${read.skill.version}`,
    integrity: read.integrity.sha256,
    match: { decision: match.decision, score: match.score },
    country: country.countryCode,
    tools: SKILL_MCP_TOOL_NAMES.length
  }));
} finally {
  await rm(root, { recursive: true, force: true });
}
