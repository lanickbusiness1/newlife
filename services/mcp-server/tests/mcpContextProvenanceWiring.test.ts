import { expect, test } from "vitest";
import { z } from "zod";
import { fingerprintContextPack } from "../src/contextPackProvenance";
import { registerSkillMcpTools } from "../src/mcpSkillTools";
import type { GovernanceApprovalLedger } from "../src/governanceApprovalLedger";
import type { SkillRegistry } from "../src/skillRegistry";

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

const provenance = {
  provenanceVersion: "GENESIS_CONTEXT_PACK_PROVENANCE_0.1.0",
  contextPackId: "stratex99.gn.govtech",
  version: "1.0.0",
  countryCode: "GN",
  issuer: "AfrIAgenesis R.E.M.E",
  issuedAt: "2026-08-13T12:00:00.000Z",
  expiresAt: "2099-01-01T00:00:00.000Z",
  sources: [{
    sourceId: "GN-SOURCE-001",
    publisher: "Guinea official source",
    locator: "source:GN-SOURCE-001",
    retrievedAt: "2026-08-13T11:00:00.000Z"
  }],
  contextSha256: fingerprintContextPack(contextPack)
};

function countryPayload() {
  return {
    countryCode: "GN",
    contextPack,
    contextProvenance: provenance,
    stratex9Qualification: { status: "go", evidenceRefs: ["S9-GN"] },
    skillRefs: [{ id: "core.procurement", version: "1.0.0" }]
  };
}

test("MCP country compiler schema requires complete context provenance", () => {
  const schemas = new Map<string, Record<string, z.ZodTypeAny>>();
  const register = (
    name: string,
    _description: string,
    inputSchema: Record<string, z.ZodTypeAny>
  ) => schemas.set(name, inputSchema);

  registerSkillMcpTools(
    register as any,
    z.any(),
    {} as SkillRegistry,
    {} as GovernanceApprovalLedger
  );

  const payloadSchema = schemas.get("genome.country_compiler.compile")?.payload;
  expect(payloadSchema).toBeDefined();
  expect(() => payloadSchema?.parse(countryPayload())).not.toThrow();

  const { contextProvenance: _omitted, ...withoutProvenance } = countryPayload();
  expect(() => payloadSchema?.parse(withoutProvenance)).toThrow();

  expect(() => payloadSchema?.parse({
    ...countryPayload(),
    contextProvenance: { ...provenance, sources: [] }
  })).toThrow();
});
