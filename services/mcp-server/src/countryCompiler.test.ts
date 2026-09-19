import { describe, expect, it } from "vitest";
import {
  assessCountryPortability,
  compileCountryGenome,
  GENESIS_V4_COUNTRY_COMPILER_ANCHOR,
  type CountryGenome
} from "./countryCompiler.js";

function genome(countryCode: "BJ" | "ML"): CountryGenome {
  const benin = countryCode === "BJ";
  return {
    contract_id: "GEN-V4-COUNTRY-GENOME-CONTRACT-001",
    contract_version: "1.0.0",
    genome_id: `country-genome-${countryCode.toLowerCase()}`,
    genome_version: "1.0.0",
    country: {
      code_iso2: countryCode,
      name: benin ? "Bénin" : "Mali",
      region: "West Africa",
      jurisdiction: countryCode,
      timezone: "Africa/Bamako",
      currencies: ["XOF"],
      languages: {
        official: ["fr"],
        local: benin ? ["fon", "yoruba"] : ["bm", "ff"],
        working: ["fr"]
      }
    },
    authority: {
      sovereign_owner: benin ? "Government of Benin" : "Government of Mali",
      competent_authorities: [benin ? "ASIN" : "Agetic"],
      mandates: ["evidence:mandate:001"]
    },
    truth: {
      max_truth_state: "TEST_PROVEN",
      evidence_refs: ["evidence:country:001"],
      unresolved_claims: []
    },
    sovereignty: {
      data_residency_rules: ["country-controlled"],
      transfer_rules: ["authorized-only"],
      retention_rules: ["purpose-bound"],
      consent_rules: ["lawful-basis-or-consent"],
      sovereignty_policy_refs: ["policy:sovereignty:001"]
    },
    capabilities: {
      existing: [
        {
          id: "identity",
          name: "National Identity",
          status: "available",
          evidence_ref: "evidence:identity:001"
        },
        {
          id: "interop",
          name: "Interoperability Backbone",
          status: benin ? "available" : "partial",
          evidence_ref: "evidence:interop:001"
        }
      ],
      gaps: [
        {
          id: "evidence-layer",
          name: "Evidence Layer",
          evidence_ref: "evidence:gap:001"
        }
      ]
    },
    infrastructure: {
      compute: ["government-cloud"],
      cloud_onprem_hybrid: ["hybrid"],
      connectivity: ["internet"],
      energy_constraints: [],
      offline_edge_constraints: ["offline-capable"]
    },
    identity: {
      authoritative_sources: ["national-registry"],
      trust_frameworks: ["national-trust"],
      approved_connectors: ["identity-adapter"]
    },
    payments: {
      domestic_rails: ["domestic-rail"],
      regional_rails: ["PI-SPI"],
      public_payment_rails: ["public-rail"],
      approved_connectors: ["payment-adapter"]
    },
    legal_regulatory: {
      policy_packs: [`policy:${countryCode}:001`],
      sector_rules: [],
      privacy_rules: ["privacy:minimize"],
      procurement_rules: [],
      fiscal_rules: []
    },
    domains: {
      selected_domain_genomes: ["Government"],
      selected_os_families: ["Government AI OS"],
      required_skills: ["country-capability-discovery"]
    },
    security: {
      criticality: "high",
      permissions_model: "least-privilege",
      secrets_policy: "external-secret-store",
      logging_policy: "no-pii",
      rollback_required: true,
      kill_switch_required: true
    },
    business: {
      solvent_buyers: ["government"],
      essential_demands: ["sovereign-ai-execution"],
      offers: ["90-Day Sovereign AI Pilot"],
      pricing_assumptions: ["hypothesis-only"],
      unit_economics_refs: ["economics:001"]
    },
    deployment: {
      topology: "hybrid",
      country_connectors: ["identity-adapter", "payment-adapter"],
      feature_flags: [],
      rollback_target: "core-stable"
    },
    governance: {
      required_gates: ["STRATEX-9", "M6", "S7+", "M8"],
      human_approvers: ["CEO"],
      review_cycle: "quarterly"
    },
    reme: {
      evidence_root: "reme:root:001",
      learning_return_path: "genesis-v4"
    }
  };
}

describe("GEN-V4-COUNTRY-COMPILER-001", () => {
  it("exposes the canonical compiler anchor", () => {
    expect(GENESIS_V4_COUNTRY_COMPILER_ANCHOR.assetId).toBe("GEN-V4-COUNTRY-COMPILER-001");
    expect(GENESIS_V4_COUNTRY_COMPILER_ANCHOR.contractId).toBe("GEN-V4-COUNTRY-GENOME-CONTRACT-001");
  });

  it("fails closed when a critical country field is missing", () => {
    const invalid = genome("BJ") as any;
    delete invalid.country.jurisdiction;

    const result = compileCountryGenome({
      executionId: "exec-bj-invalid",
      parentCoreRef: "core:genesis-v4:sha-001",
      targetTruthState: "BLUEPRINT_READY",
      countryGenome: invalid,
      requestedCapabilities: ["identity"]
    });

    expect(result.status).toBe("NEEDS_EVIDENCE");
    expect(result.blockers).toContain("COUNTRY_JURISDICTION_REQUIRED");
  });

  it("reuses an evidenced existing national capability instead of rebuilding it", () => {
    const result = compileCountryGenome({
      executionId: "exec-bj",
      parentCoreRef: "core:genesis-v4:sha-001",
      targetTruthState: "BLUEPRINT_READY",
      countryGenome: genome("BJ"),
      requestedCapabilities: ["identity", "interop", "evidence-layer"]
    });

    expect(result.status).toBe("READY_FOR_BLUEPRINT");
    expect(result.capabilityMatrix.find(item => item.capabilityId === "identity")?.decision).toBe("REUSE_EXISTING");
    expect(result.capabilityMatrix.find(item => item.capabilityId === "interop")?.decision).toBe("REUSE_EXISTING");
    expect(result.capabilityMatrix.find(item => item.capabilityId === "evidence-layer")?.decision).toBe("AUGMENT");
  });

  it("integrates a partial capability rather than replacing it", () => {
    const result = compileCountryGenome({
      executionId: "exec-ml",
      parentCoreRef: "core:genesis-v4:sha-001",
      targetTruthState: "BLUEPRINT_READY",
      countryGenome: genome("ML"),
      requestedCapabilities: ["interop"]
    });

    expect(result.status).toBe("READY_FOR_BLUEPRINT");
    expect(result.capabilityMatrix[0]?.decision).toBe("INTEGRATE");
  });

  it("proves portability only when the same immutable core is reused", () => {
    const bj = compileCountryGenome({
      executionId: "exec-bj",
      parentCoreRef: "core:genesis-v4:sha-001",
      targetTruthState: "BLUEPRINT_READY",
      countryGenome: genome("BJ"),
      requestedCapabilities: ["identity", "interop"]
    });
    const ml = compileCountryGenome({
      executionId: "exec-ml",
      parentCoreRef: "core:genesis-v4:sha-001",
      targetTruthState: "BLUEPRINT_READY",
      countryGenome: genome("ML"),
      requestedCapabilities: ["identity", "interop"]
    });

    const portability = assessCountryPortability(bj, ml);

    expect(portability.coreUnchanged).toBe(true);
    expect(portability.verdict).toBe("REPRODUCTION_PROVEN_CANDIDATE");
    expect(portability.criticalRegressions).toEqual([]);
  });

  it("rejects portability if the child requires a different core", () => {
    const bj = compileCountryGenome({
      executionId: "exec-bj",
      parentCoreRef: "core:genesis-v4:sha-001",
      targetTruthState: "BLUEPRINT_READY",
      countryGenome: genome("BJ"),
      requestedCapabilities: ["identity"]
    });
    const ml = compileCountryGenome({
      executionId: "exec-ml",
      parentCoreRef: "core:genesis-v4:sha-002",
      targetTruthState: "BLUEPRINT_READY",
      countryGenome: genome("ML"),
      requestedCapabilities: ["identity"]
    });

    expect(assessCountryPortability(bj, ml).verdict).toBe("PORTABILITY_FAIL");
  });
});
