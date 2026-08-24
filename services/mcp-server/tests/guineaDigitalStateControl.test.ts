import { describe, expect, test } from "vitest";
import {
  evaluateReleaseTruth,
  scoreDigitalService,
  validateGovernmentEvent,
  type GovernmentEvent,
  type ReleaseEvidence,
  type ServiceObservation
} from "../src/guineaDigitalStateControl";

const validEvent: GovernmentEvent = {
  eventId: "evt-001",
  sourceSystem: "xroad",
  institutionId: "ande",
  serviceId: "civil-status",
  actorType: "system",
  timestamp: "2026-08-24T08:30:00Z",
  countryCode: "GN",
  correlationId: "corr-001",
  classification: "internal",
  legalBasis: "public-service-delivery",
  dataResidency: "GN",
  evidenceHash: "sha256:abc123"
};

describe("V4-DEC-018 Guinea Sovereign Digital Public Service Control Plane", () => {
  test("accepts only Guinea events with the canonical evidence envelope", () => {
    expect(validateGovernmentEvent(validEvent)).toEqual({ ok: true, errors: [] });

    const invalid = { ...validEvent, countryCode: "ML", evidenceHash: "" };
    expect(validateGovernmentEvent(invalid)).toEqual({
      ok: false,
      errors: ["countryCode must be GN", "evidenceHash is required"]
    });
  });

  test("scores a digital service from SLA, latency, error, blockage and satisfaction evidence", () => {
    const observation: ServiceObservation = {
      slaCompliancePct: 92,
      availabilityPct: 99.5,
      errorRatePct: 1.2,
      blockedCasePct: 3,
      citizenSatisfactionPct: 81,
      medianProcessingTimeMinutes: 18,
      targetProcessingTimeMinutes: 30
    };

    expect(scoreDigitalService(observation)).toEqual({
      score: 91,
      state: "HEALTHY",
      breaches: []
    });
  });

  test("blocks PRODUCTION_PROVEN until M6, S7+, M8, rollback and runtime proof are all verified", () => {
    const incomplete: ReleaseEvidence = {
      m6Passed: true,
      s7PlusPassed: true,
      m8Passed: true,
      rollbackTested: false,
      runtimeProofVerified: false
    };

    expect(evaluateReleaseTruth(incomplete)).toEqual({
      status: "CODE_VERIFIED",
      missing: ["rollbackTested", "runtimeProofVerified"]
    });

    expect(
      evaluateReleaseTruth({
        ...incomplete,
        rollbackTested: true,
        runtimeProofVerified: true
      })
    ).toEqual({ status: "PRODUCTION_PROVEN", missing: [] });
  });
});
