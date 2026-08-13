import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fingerprintContextPack } from "../dist/contextPackProvenance.js";
import { compileCountrySkill } from "../dist/countryCompiler.js";
import { GovernanceApprovalLedger } from "../dist/governanceApprovalLedger.js";
import { compileSkill } from "../dist/skillFactory.js";
import { SkillRegistry } from "../dist/skillRegistry.js";
import { SKILL_MCP_HEALTH, SKILL_MCP_TOOL_NAMES } from "../dist/mcpSkillTools.js";

const root = await mkdtemp(path.join(tmpdir(), "genesis-skill-smoke-v2-"));
const approvalRoot = await mkdtemp(path.join(tmpdir(), "genesis-approval-smoke-v2-"));

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

const contextProvenance = {
  provenanceVersion: "GENESIS_CONTEXT_PACK_PROVENANCE_0.1.0",
  contextPackId: "stratex99.gn.smoke",
  version: "1.0.0",
  countryCode: "GN",
  issuer: "AfrIAgenesis R.E.M.E smoke",
  issuedAt: "2026-08-13T12:00:00.000Z",
  expiresAt: "2099-01-01T00:00:00.000Z",
  sources: [{
    sourceId: "SMOKE-SOURCE-001",
    publisher: "AfrIAgenesis smoke fixture",
    locator: "fixture:SMOKE-SOURCE-001",
    retrievedAt: "2026-08-13T11:00:00.000Z"
  }],
  contextSha256: fingerprintContextPack(contextPack)
};

try {
  const registry = new SkillRegistry(root);
  const ledger = new GovernanceApprovalLedger(approvalRoot, 3600);
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

  const reviewSkill = compileSkill({
    ...skill,
    id: "procurement.supplier.review.smoke",
    warnings: ["smoke review required"]
  });
  const reviewer = {
    issuer: "urn:afriagenesis:smoke",
    tenantId: "smoke-tenant",
    actorId: "smoke-reviewer",
    agentId: "smoke-review-agent",
    permissionScope: ["genome:skill:review"],
    roles: ["Reviewer"],
    amr: ["pwd", "mfa"],
    allowedCountries: ["GN"],
    allowedOrganizations: [],
    allowedMissions: [],
    correlationId: "06d8d70b-f038-4272-858c-f60a78263e13",
    purpose: "smoke approval ledger",
    dataClassification: "internal"
  };
  const approval = await ledger.attest(reviewSkill, "double_review", reviewer);
  const approvalRead = await ledger.read(approval.approvalId);
  const revocation = await ledger.revoke(approval.approvalId, "double_review", reviewer, "smoke review withdrawn");
  const revocationRead = await ledger.readRevocation(approval.approvalId);
  if (!revocationRead || revocationRead.revocationId !== revocation.revocationId) throw new Error("SMOKE_REVOCATION");
  const originalAfterRevocation = await ledger.read(approval.approvalId);
  if (originalAfterRevocation.integrity.sha256 !== approvalRead.integrity.sha256) throw new Error("SMOKE_APPROVAL_MUTATED");

  const country = await compileCountrySkill(registry, {
    countryCode: "GN",
    contextPack,
    contextProvenance,
    stratex9Qualification: { status: "go", evidenceRefs: ["SMOKE-S9"] },
    skillRefs: [{ id: read.skill.id, version: read.skill.version }]
  });

  if (country.configuration.currency !== "GNF") throw new Error("SMOKE_COUNTRY_CURRENCY");
  if (!country.universalInvariants.auditRequired) throw new Error("SMOKE_GENOME_INVARIANT");
  if (country.contextProvenance.contextSha256 !== fingerprintContextPack(contextPack)) throw new Error("SMOKE_CONTEXT_PROVENANCE");
  if (SKILL_MCP_TOOL_NAMES.length !== 11) throw new Error("SMOKE_MCP_TOOL_COUNT");
  if (SKILL_MCP_HEALTH.approvalLedger !== "GENESIS_GOVERNANCE_APPROVAL_LEDGER_0.1.0") throw new Error("SMOKE_APPROVAL_LEDGER_HEALTH");

  console.log(JSON.stringify({
    status: "ok",
    health: SKILL_MCP_HEALTH,
    skill: `${read.skill.id}@${read.skill.version}`,
    integrity: read.integrity.sha256,
    approval: approvalRead.approvalId,
    revocation: revocationRead.revocationId,
    match: { decision: match.decision, score: match.score },
    country: country.countryCode,
    contextSha256: country.contextProvenance.contextSha256,
    tools: SKILL_MCP_TOOL_NAMES.length
  }));
} finally {
  await Promise.all([
    rm(root, { recursive: true, force: true }),
    rm(approvalRoot, { recursive: true, force: true })
  ]);
}
