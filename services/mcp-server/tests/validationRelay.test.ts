import { describe, expect, test } from "vitest";
import {
  compileValidationRelay,
  type ValidationRelayInput
} from "../src/validationRelay";
import {
  PRODUCTION_CONTROL_IDS,
  type ProductionInfrastructureGateInput
} from "../src/productionInfrastructureGate";

const baseInput: ValidationRelayInput = {
  validationRef: "CEO-VAL-2026-08-18-001",
  assetId: "INF-DEPLOYBOT-001",
  baselineVersion: "v1.0",
  targetDeliverable: "url",
  riskClass: "moderate",
  sourceRef: "github:lanickbusiness1/newlife",
  budgetEnvelope: { authorized: true },
  deploymentPolicy: {
    stagingAllowed: true,
    productionDelegated: true
  }
};

function fullyProvenPigInput(): ProductionInfrastructureGateInput {
  return {
    assetId: "INF-DEPLOYBOT-001",
    releaseId: "release-relay-proof",
    environment: "preproduction",
    multiTenant: true,
    controls: Object.fromEntries(
      PRODUCTION_CONTROL_IDS.map(id => [id, {
        status: "pass" as const,
        evidenceRefs: [`reme://${id}/proof`]
      }])
    ) as ProductionInfrastructureGateInput["controls"]
  };
}

const pigEvidence = {
  productionInfrastructureGate: "pass" as const,
  productionReadinessScore: 100,
  productionCriticalFailures: [] as string[],
  productionInfrastructureEvidenceRef: "reme://PIG-001/release-proof"
};

describe("GENESIS V4 CEO Validation Relay", () => {
  test("takes the relay automatically after CEO validation and asks for build evidence next", () => {
    const output = compileValidationRelay(baseInput);

    expect(output.continueAutomatically).toBe(true);
    expect(output.humanApprovalRequired).toBe(false);
    expect(output.autonomyLevel).toBe("A3");
    expect(output.state).toBe("SOURCE_PROVEN");
    expect(output.nextAction).toMatch(/build/i);
  });

  test("stops only on an explicit A4 veto", () => {
    const output = compileValidationRelay({
      ...baseInput,
      a4Vetoes: ["legal_commitment"]
    });

    expect(output.state).toBe("BLOCKED_A4");
    expect(output.continueAutomatically).toBe(false);
    expect(output.humanApprovalRequired).toBe(true);
    expect(output.blockers).toContain("A4:legal_commitment");
  });

  test("requires the Production Infrastructure Gate before M6 can be accepted", () => {
    const output = compileValidationRelay({
      ...baseInput,
      evidence: {
        commitSha: "pig-required",
        ciRun: "run-pig-required",
        testsPassed: true,
        m6: "pass",
        s7plus: "pass",
        m8: "pass"
      }
    });

    expect(output.state).toBe("GATES_PENDING");
    expect(output.blockers).toContain("Production Infrastructure Gate is missing");
    expect(output.nextAction).toMatch(/infrastructure/i);
  });

  test("requires explicit proof that the PIG critical-failure set is empty", () => {
    const output = compileValidationRelay({
      ...baseInput,
      evidence: {
        commitSha: "critical-proof-required",
        ciRun: "run-critical-proof-required",
        testsPassed: true,
        productionInfrastructureGate: "pass",
        productionReadinessScore: 100,
        productionInfrastructureEvidenceRef: "reme://PIG-001/release-proof",
        m6: "pass",
        s7plus: "pass",
        m8: "pass"
      }
    });

    expect(output.state).toBe("GATES_PENDING");
    expect(output.blockers).toContain("Production critical failures proof is missing or invalid");
  });

  test("does not trust a self-declared PIG pass when raw PIG evaluation fails", () => {
    const failingPigInput = fullyProvenPigInput();
    failingPigInput.controls.tls_https = {
      status: "fail",
      evidenceRefs: ["reme://tls/failed-scan"]
    };

    const output = compileValidationRelay({
      ...baseInput,
      evidence: {
        commitSha: "forged-pig-pass",
        ciRun: "run-forged-pig-pass",
        testsPassed: true,
        ...pigEvidence,
        productionInfrastructureInput: failingPigInput,
        m6: "pass",
        s7plus: "pass",
        m8: "pass"
      } as any
    });

    expect(output.state).toBe("CORRECTING");
    expect(output.blockers.some(item => item.includes("recomputed PIG decision"))).toBe(true);
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 101])(
    "rejects invalid Production Readiness Score %s instead of allowing M6",
    score => {
      const output = compileValidationRelay({
        ...baseInput,
        evidence: {
          commitSha: "invalid-score",
          ciRun: "run-invalid-score",
          testsPassed: true,
          productionInfrastructureGate: "pass",
          productionReadinessScore: score,
          productionCriticalFailures: [],
          productionInfrastructureEvidenceRef: "reme://PIG-001/release-proof",
          m6: "pass",
          s7plus: "pass",
          m8: "pass"
        }
      });

      expect(output.state).toBe("CORRECTING");
      expect(output.blockers.some(item => item.includes("Production Readiness Score is invalid"))).toBe(true);
    }
  );

  test("rejects a malformed relay payload with a controlled relay validation error", () => {
    expect(() => compileValidationRelay(null as unknown as ValidationRelayInput))
      .toThrowError(/GENESIS_V4_VALIDATION_RELAY_INVALID/);
  });

  test("never claims a delivered URL without healthcheck and rollback evidence", () => {
    const output = compileValidationRelay({
      ...baseInput,
      evidence: {
        commitSha: "abc123",
        ciRun: "run-1",
        testsPassed: true,
        ...pigEvidence,
        m6: "pass",
        s7plus: "pass",
        m8: "pass",
        finalUrlOrArtifact: "https://example.africa"
      }
    });

    expect(output.state).not.toBe("DELIVERED_URL");
    expect(output.blockers).toEqual(expect.arrayContaining([
      "Healthcheck proof missing",
      "Rollback proof missing"
    ]));
  });

  test("returns DELIVERED_URL only when the complete evidence contract is satisfied", () => {
    const output = compileValidationRelay({
      ...baseInput,
      evidence: {
        commitSha: "abc123",
        ciRun: "run-2",
        testsPassed: true,
        ...pigEvidence,
        m6: "pass",
        s7plus: "pass",
        m8: "pass",
        finalUrlOrArtifact: "https://example.africa",
        healthcheckPassed: true,
        rollbackRef: "rollback:v1"
      }
    });

    expect(output.state).toBe("DELIVERED_URL");
    expect(output.continueAutomatically).toBe(false);
    expect(output.humanApprovalRequired).toBe(false);
    expect(output.finalDeliverable).toBe("https://example.africa");
  });

  test("maps Android APK delivery to DELIVERED_APK", () => {
    const output = compileValidationRelay({
      ...baseInput,
      targetDeliverable: "apk",
      evidence: {
        commitSha: "def456",
        ciRun: "run-3",
        testsPassed: true,
        ...pigEvidence,
        m6: "pass",
        s7plus: "pass",
        m8: "pass",
        finalUrlOrArtifact: "artifact://afria-app.apk",
        healthcheckPassed: true,
        rollbackRef: "rollback:apk-v1"
      }
    });

    expect(output.state).toBe("DELIVERED_APK");
  });
});
