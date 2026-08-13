import { describe, expect, test } from "vitest";
import {
  fingerprintContextPack,
  verifyContextPackProvenance,
  type ContextPackProvenance
} from "../src/contextPackProvenance";

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

const now = Date.parse("2026-08-13T15:00:00.000Z");

function provenance(overrides: Partial<ContextPackProvenance> = {}): ContextPackProvenance {
  return {
    provenanceVersion: "GENESIS_CONTEXT_PACK_PROVENANCE_0.1.0",
    contextPackId: "stratex99.gn.govtech",
    version: "1.0.0",
    countryCode: "GN",
    issuer: "AfrIAgenesis R.E.M.E",
    issuedAt: "2026-08-13T12:00:00.000Z",
    expiresAt: "2026-09-12T12:00:00.000Z",
    sources: [
      {
        sourceId: "GN-OFFICIAL-001",
        publisher: "Government of Guinea",
        locator: "https://example.gov.gn/reference/001",
        retrievedAt: "2026-08-13T11:00:00.000Z"
      }
    ],
    contextSha256: fingerprintContextPack(contextPack),
    ...overrides
  };
}

describe("GENESIS STRATEX-99 Context Pack provenance", () => {
  test("accepts a current pack bound to the exact context and country", () => {
    expect(verifyContextPackProvenance(provenance(), "GN", contextPack, now)).toMatchObject({
      countryCode: "GN",
      version: "1.0.0",
      contextSha256: fingerprintContextPack(contextPack)
    });
  });

  test("rejects a pack from another country", () => {
    expect(() => verifyContextPackProvenance(
      provenance({ countryCode: "CI" }),
      "GN",
      contextPack,
      now
    )).toThrow(/CONTEXT_PACK_COUNTRY_MISMATCH/);
  });

  test("rejects a stale pack", () => {
    expect(() => verifyContextPackProvenance(
      provenance({ expiresAt: "2026-08-12T12:00:00.000Z" }),
      "GN",
      contextPack,
      now
    )).toThrow(/CONTEXT_PACK_EXPIRED/);
  });

  test("rejects missing source provenance", () => {
    expect(() => verifyContextPackProvenance(
      provenance({ sources: [] }),
      "GN",
      contextPack,
      now
    )).toThrow(/CONTEXT_PACK_SOURCES_REQUIRED/);
  });

  test("rejects a context modified after provenance was issued", () => {
    const modified = {
      ...contextPack,
      regulatoryLegal: { status: "covered" as const, evidenceRefs: ["LEGAL-GN-CHANGED"] }
    };
    expect(() => verifyContextPackProvenance(
      provenance(),
      "GN",
      modified,
      now
    )).toThrow(/CONTEXT_PACK_INTEGRITY_MISMATCH/);
  });

  test("rejects malformed semantic versions and timestamps", () => {
    expect(() => verifyContextPackProvenance(
      provenance({ version: "v1", issuedAt: "not-a-date" }),
      "GN",
      contextPack,
      now
    )).toThrow(/CONTEXT_PACK_PROVENANCE_INVALID/);
  });
});
