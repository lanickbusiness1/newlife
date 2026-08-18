import { describe, expect, test } from "vitest";
import {
  compileValidationRelay,
  type ValidationRelayInput
} from "../src/validationRelay";

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

  test("never claims a delivered URL without gates, healthcheck and rollback evidence", () => {
    const output = compileValidationRelay({
      ...baseInput,
      evidence: {
        commitSha: "abc123",
        ciRun: "run-1",
        testsPassed: true,
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
