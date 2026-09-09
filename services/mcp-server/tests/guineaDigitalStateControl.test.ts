import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  assessProcurementIntegrity,
  evaluateReleaseTruth,
  GENESIS_V4_GUINEA_DIGITAL_STATE_CONTROL_ANCHOR,
  scoreDigitalService,
  summarizeXRoadHealth,
  validateGovernmentEvent,
  type GovernmentEvent,
  type ProcurementObservation,
  type ReleaseEvidence,
  type ServiceObservation,
  type XRoadCallObservation
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
  test("anchors the runtime asset to V4-DEC-018", () => {
    expect(GENESIS_V4_GUINEA_DIGITAL_STATE_CONTROL_ANCHOR).toMatchObject({
      assetId: "GEN-V4-GN-DIGITAL-STATE-CONTROL-001",
      version: "0.1.0",
      decisionId: "V4-DEC-018",
      countryCode: "GN"
    });
  });

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
    expect(scoreDigitalService(observation)).toEqual({ score: 91, state: "HEALTHY", breaches: [] });
  });

  test("summarizes X-Road availability, failures, p95 latency and evidence lineage", () => {
    const calls: XRoadCallObservation[] = [
      { serviceId: "civil-status", status: "success", latencyMs: 100, evidenceRef: "ev:xr:1" },
      { serviceId: "civil-status", status: "success", latencyMs: 140, evidenceRef: "ev:xr:2" },
      { serviceId: "tax-id", status: "success", latencyMs: 180, evidenceRef: "ev:xr:3" },
      { serviceId: "tax-id", status: "success", latencyMs: 200, evidenceRef: "ev:xr:4" },
      { serviceId: "tax-id", status: "success", latencyMs: 220, evidenceRef: "ev:xr:5" }
    ];
    expect(summarizeXRoadHealth(calls)).toEqual({
      availabilityPct: 100,
      failureRatePct: 0,
      p95LatencyMs: 220,
      state: "HEALTHY",
      breaches: [],
      evidenceRefs: ["ev:xr:1", "ev:xr:2", "ev:xr:3", "ev:xr:4", "ev:xr:5"]
    });
  });

  test("raises explainable procurement integrity flags without making an accusation", () => {
    const observation: ProcurementObservation = {
      procurementId: "ao-2026-001",
      bidderCount: 1,
      estimatedValue: 100,
      awardedValue: 125,
      procurementMethod: "restricted",
      evidenceRefs: ["ev:proc:notice", "ev:proc:award"]
    };
    expect(assessProcurementIntegrity(observation)).toEqual({
      riskScore: 75,
      riskBand: "HIGH",
      flags: ["single_bid", "award_above_estimate", "restricted_method"],
      interpretation: "risk_signal_only_human_review_required",
      evidenceRefs: ["ev:proc:notice", "ev:proc:award"]
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
    expect(evaluateReleaseTruth({ ...incomplete, rollbackTested: true, runtimeProofVerified: true }))
      .toEqual({ status: "PRODUCTION_PROVEN", missing: [] });
  });

  test("exposes the Guinea control plane through governed MCP tools and health metadata", () => {
    const indexSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
    expect(indexSource).toContain('register("guinea.service.score"');
    expect(indexSource).toContain('"guinea:service:score"');
    expect(indexSource).toContain('register("guinea.xroad.observe"');
    expect(indexSource).toContain('"guinea:xroad:observe"');
    expect(indexSource).toContain('register("guinea.procurement.assess_integrity"');
    expect(indexSource).toContain('"guinea:procurement:assess"');
    expect(indexSource).toContain("guineaDigitalStateControl");
  });

  test("wires governed event ingestion to a real PostgreSQL driver with fail-closed secret configuration", () => {
    const indexSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    const renderSource = readFileSync(new URL("../render.yaml", import.meta.url), "utf8");
    expect(indexSource).toContain('register("guinea.event.ingest"');
    expect(indexSource).toContain('"guinea:event:write"');
    expect(indexSource).toContain("persistGovernmentEvent");
    expect(indexSource).toContain("GENESIS_GUINEA_DATABASE_URL");
    expect(packageJson.dependencies.pg).toBe("8.23.0");
    expect(renderSource).toContain("GENESIS_GUINEA_DATABASE_URL");
    expect(renderSource).toContain("sync: false");
  });

  test("exposes sandbox normalization, process mining and executive cockpit as separate governed capabilities", () => {
    const indexSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
    expect(indexSource).toContain('register("guinea.sandbox.normalize"');
    expect(indexSource).toContain('"guinea:sandbox:normalize"');
    expect(indexSource).toContain('register("guinea.process_mining.analyze"');
    expect(indexSource).toContain('"guinea:process:analyze"');
    expect(indexSource).toContain('register("guinea.executive.cockpit"');
    expect(indexSource).toContain('"guinea:executive:read"');
    expect(indexSource).toContain("guineaInstitutionAdapters");
  });
});
