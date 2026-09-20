import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  compileCommunicationRoute,
  evaluateCommunicationProvider,
  type CommunicationProviderProfile,
  type SovereignCommsRequirements
} from "../src/communicationControlPlane";

const regulated: SovereignCommsRequirements = {
  riskClass: "regulated",
  sovereigntyMode: true,
  mandatory: ["sourceCodeAccess", "e2ee", "webhooks"]
};

const vendorClaimMirrorFly: CommunicationProviderProfile = {
  providerId: "mirrorfly",
  providerType: "mirrorfly",
  capabilities: {
    selfHosted: { value: true, level: "vendor_claim", sourceRef: "mirrorfly:self-hosted" },
    sourceCodeAccess: { value: true, level: "vendor_claim", sourceRef: "mirrorfly:source-code" },
    e2ee: { value: true, level: "vendor_claim", sourceRef: "mirrorfly:e2ee" },
    webhooks: { value: true, level: "vendor_claim", sourceRef: "mirrorfly:webhooks" },
    dataResidencyControl: { value: true, level: "vendor_claim", sourceRef: "mirrorfly:data-residency" },
    keyControl: { value: true, level: "vendor_claim", sourceRef: "mirrorfly:key-control" },
    exportability: { value: true, level: "vendor_claim", sourceRef: "mirrorfly:export" },
    auditLogs: { value: true, level: "vendor_claim", sourceRef: "mirrorfly:audit" },
    backupRestore: { value: true, level: "vendor_claim", sourceRef: "mirrorfly:backup" }
  }
};

describe("GENESIS V4 Sovereign Communications Control Plane", () => {
  test("does not accept vendor claims alone for a regulated sovereign route", () => {
    const evaluation = evaluateCommunicationProvider(vendorClaimMirrorFly, regulated);

    expect(evaluation.status).toBe("DUE_DILIGENCE_REQUIRED");
    expect(evaluation.insufficientEvidence).toEqual(
      expect.arrayContaining(["selfHosted", "sourceCodeAccess", "keyControl", "dataResidencyControl"])
    );
    expect(evaluation.failedCapabilities).toEqual([]);
  });

  test("rejects a provider when a mandatory sovereign capability is explicitly false", () => {
    const profile: CommunicationProviderProfile = {
      ...vendorClaimMirrorFly,
      providerId: "provider-no-key-control",
      providerType: "custom",
      capabilities: {
        ...vendorClaimMirrorFly.capabilities,
        keyControl: { value: false, level: "tested", sourceRef: "test:key-control-failed" }
      }
    };

    const evaluation = evaluateCommunicationProvider(profile, regulated);
    expect(evaluation.status).toBe("REJECTED");
    expect(evaluation.failedCapabilities).toContain("keyControl");
  });

  test("selects only an eligible provider backed by sufficient evidence", () => {
    const contractualProvider: CommunicationProviderProfile = {
      providerId: "contractual-self-hosted",
      providerType: "custom",
      capabilities: Object.fromEntries(
        Object.entries(vendorClaimMirrorFly.capabilities).map(([key, evidence]) => [
          key,
          { ...evidence, level: "contractual" }
        ])
      )
    };

    const decision = compileCommunicationRoute({
      intentId: "gov-secure-comms-001",
      requirements: regulated,
      providers: [vendorClaimMirrorFly, contractualProvider]
    });

    expect(decision.state).toBe("ROUTE_SELECTED");
    expect(decision.selectedProviderId).toBe("contractual-self-hosted");
    expect(decision.continueAutomatically).toBe(true);
  });

  test("uses ALTERNATE_ROUTE_ACTIVE instead of a global BLOCKED state", () => {
    const decision = compileCommunicationRoute({
      intentId: "gov-secure-comms-002",
      requirements: regulated,
      providers: [vendorClaimMirrorFly]
    });

    expect(decision.state).toBe("ALTERNATE_ROUTE_ACTIVE");
    expect(decision.continueAutomatically).toBe(true);
    expect(decision.nextAction).toMatch(/parallel|substitute/i);
  });

  test("registers governed MCP tools in the existing control plane", () => {
    const indexSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

    expect(indexSource).toContain('register("comms.provider.evaluate"');
    expect(indexSource).toContain('register("comms.route.compile"');
  });
});
