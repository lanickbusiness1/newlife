import { describe, expect, test } from "vitest";
import {
  evaluateProductionInfrastructureGate,
  PRODUCTION_CONTROL_IDS,
  type ProductionControlId,
  type ProductionInfrastructureGateInput
} from "../src/productionInfrastructureGate";

function provenPass(id: ProductionControlId) {
  return {
    status: "pass" as const,
    evidenceRefs: [`reme://${id}/proof`]
  };
}

function fullyProvenInput(overrides: Partial<ProductionInfrastructureGateInput> = {}): ProductionInfrastructureGateInput {
  return {
    assetId: "INF-DEPLOYBOT-001",
    releaseId: "release-2026-09-08.1",
    environment: "preproduction",
    multiTenant: true,
    controls: Object.fromEntries(
      PRODUCTION_CONTROL_IDS.map(id => [id, provenPass(id)])
    ) as ProductionInfrastructureGateInput["controls"],
    ...overrides
  };
}

describe("GENESIS V4 Production Infrastructure Gate", () => {
  test("passes a fully proven release candidate to M6 with a score of 100", () => {
    const result = evaluateProductionInfrastructureGate(fullyProvenInput());

    expect(result.score).toBe(100);
    expect(result.threshold).toBe(85);
    expect(result.decision).toBe("PASS_TO_M6");
    expect(result.nextGate).toBe("M6");
    expect(result.criticalFailures).toEqual([]);
  });

  test("blocks even above 85 when one critical security control fails", () => {
    const input = fullyProvenInput();
    input.controls.tls_https = {
      status: "fail",
      evidenceRefs: ["reme://tls/failed-scan"]
    };

    const result = evaluateProductionInfrastructureGate(input);

    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.decision).toBe("BLOCK_CRITICAL");
    expect(result.nextGate).toBeNull();
    expect(result.criticalFailures).toContain("tls_https");
  });

  test("blocks when non-critical missing controls push readiness below 85", () => {
    const input = fullyProvenInput();
    delete input.controls.frontend_build;
    delete input.controls.performance_budget;
    delete input.controls.api_contract_tests;
    delete input.controls.backend_build;
    delete input.controls.compute_declared;
    delete input.controls.caching_cdn;
    delete input.controls.load_balancing_autoscaling;
    delete input.controls.infrastructure_as_code;

    const result = evaluateProductionInfrastructureGate(input);

    expect(result.score).toBeLessThan(85);
    expect(result.decision).toBe("BLOCK_SCORE");
    expect(result.blockers.some(item => item.includes("frontend_build"))).toBe(true);
  });

  test("treats an asserted pass without evidence as unproven and fail-closed", () => {
    const input = fullyProvenInput();
    input.controls.authentication = {
      status: "pass",
      evidenceRefs: []
    };

    const result = evaluateProductionInfrastructureGate(input);

    expect(result.decision).toBe("BLOCK_CRITICAL");
    expect(result.criticalFailures).toContain("authentication");
    expect(result.blockers.some(item => item.includes("evidence"))).toBe(true);
  });

  test("blocks a single-tenant exemption when tenant-isolation evidence is missing", () => {
    const input = fullyProvenInput({ multiTenant: false });
    delete input.controls.tenant_isolation;

    const result = evaluateProductionInfrastructureGate(input);

    expect(result.decision).toBe("BLOCK_CRITICAL");
    expect(result.criticalFailures).toContain("tenant_isolation");
    expect(result.blockers).toContain("tenant_isolation:single_tenant_evidence_missing");
  });

  test("allows tenant-isolation exemption only with explicit single-tenant evidence", () => {
    const input = fullyProvenInput({ multiTenant: false });
    input.controls.tenant_isolation = {
      status: "not_applicable",
      evidenceRefs: ["reme://tenant-model/single-tenant-proof"]
    };

    const result = evaluateProductionInfrastructureGate(input);

    expect(result.score).toBe(100);
    expect(result.exemptions).toContain("tenant_isolation:single_tenant:evidence_proven");
    expect(result.decision).toBe("PASS_TO_M6");
  });

  test("rejects a malformed runtime payload with a gate-specific validation error", () => {
    const malformed = {
      assetId: "INF-DEPLOYBOT-001",
      releaseId: "release-malformed",
      environment: "preproduction",
      multiTenant: true
    } as unknown as ProductionInfrastructureGateInput;

    expect(() => evaluateProductionInfrastructureGate(malformed)).toThrowError(/GENESIS_V4_PIG_INVALID/);
  });
});
