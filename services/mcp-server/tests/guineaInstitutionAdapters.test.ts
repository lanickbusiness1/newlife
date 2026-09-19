import { describe, expect, test } from "vitest";
import {
  buildExecutiveCockpit,
  mineAdministrativeProcess,
  normalizeEServiceRecord,
  normalizeProcurementRecord,
  normalizeXRoadRecord
} from "../src/guineaInstitutionAdapters";

describe("V4-DEC-018 Guinea institutional sandbox adapters", () => {
  test("normalizes an e-Service request into the canonical Guinea event envelope", () => {
    expect(
      normalizeEServiceRecord({
        requestId: "req-001",
        institutionId: "civil-status",
        serviceId: "birth-certificate",
        status: "completed",
        createdAt: "2026-08-24T08:00:00Z",
        completedAt: "2026-08-24T08:22:00Z",
        citizenSatisfactionPct: 88,
        evidenceHash: "sha256:eservice001"
      })
    ).toMatchObject({
      event: {
        eventId: "eservice:req-001:completed",
        sourceSystem: "e-service",
        institutionId: "civil-status",
        serviceId: "birth-certificate",
        actorType: "system",
        countryCode: "GN",
        correlationId: "req-001",
        dataResidency: "GN",
        evidenceHash: "sha256:eservice001"
      },
      metrics: {
        processingTimeMinutes: 22,
        citizenSatisfactionPct: 88
      }
    });
  });

  test("normalizes an X-Road exchange without inventing missing evidence", () => {
    expect(
      normalizeXRoadRecord({
        exchangeId: "xr-001",
        serviceId: "tax-id",
        institutionId: "tax-authority",
        status: "success",
        latencyMs: 175,
        occurredAt: "2026-08-24T08:30:00Z",
        evidenceRef: "ev:xr:001"
      })
    ).toEqual({
      event: {
        eventId: "xroad:xr-001",
        sourceSystem: "xroad",
        institutionId: "tax-authority",
        serviceId: "tax-id",
        actorType: "system",
        timestamp: "2026-08-24T08:30:00Z",
        countryCode: "GN",
        correlationId: "xr-001",
        classification: "internal",
        legalBasis: "interoperability-observability",
        dataResidency: "GN",
        evidenceHash: "ev:xr:001"
      },
      observation: {
        serviceId: "tax-id",
        status: "success",
        latencyMs: 175,
        evidenceRef: "ev:xr:001"
      }
    });
  });

  test("normalizes procurement evidence into an assessment input without accusing a supplier", () => {
    expect(
      normalizeProcurementRecord({
        procurementId: "ao-2026-100",
        institutionId: "public-works",
        bidderCount: 2,
        estimatedValue: 1_000_000,
        awardedValue: 1_050_000,
        procurementMethod: "open",
        occurredAt: "2026-08-24T08:40:00Z",
        evidenceRefs: ["ev:ao:notice", "ev:ao:award"]
      })
    ).toMatchObject({
      event: {
        eventId: "procurement:ao-2026-100",
        sourceSystem: "e-procurement",
        institutionId: "public-works",
        serviceId: "public-procurement",
        countryCode: "GN",
        correlationId: "ao-2026-100"
      },
      observation: {
        procurementId: "ao-2026-100",
        bidderCount: 2,
        estimatedValue: 1_000_000,
        awardedValue: 1_050_000,
        procurementMethod: "open",
        evidenceRefs: ["ev:ao:notice", "ev:ao:award"]
      }
    });
  });

  test("mines an administrative process and identifies bottlenecks from explicit timestamps", () => {
    const result = mineAdministrativeProcess([
      { caseId: "c1", step: "submitted", occurredAt: "2026-08-24T08:00:00Z" },
      { caseId: "c1", step: "validated", occurredAt: "2026-08-24T08:10:00Z" },
      { caseId: "c1", step: "completed", occurredAt: "2026-08-24T08:50:00Z" },
      { caseId: "c2", step: "submitted", occurredAt: "2026-08-24T09:00:00Z" },
      { caseId: "c2", step: "validated", occurredAt: "2026-08-24T09:08:00Z" },
      { caseId: "c2", step: "completed", occurredAt: "2026-08-24T09:38:00Z" }
    ]);

    expect(result.caseCount).toBe(2);
    expect(result.medianCycleTimeMinutes).toBe(44);
    expect(result.bottlenecks[0]).toEqual({
      transition: "validated→completed",
      medianMinutes: 35,
      samples: 2
    });
  });

  test("builds an executive cockpit from measured service, X-Road and procurement results", () => {
    expect(
      buildExecutiveCockpit({
        services: [
          { serviceId: "birth-certificate", score: 91, state: "HEALTHY", breaches: [] },
          { serviceId: "business-registration", score: 68, state: "WATCH", breaches: ["processing_time"] }
        ],
        xroad: {
          availabilityPct: 98.5,
          failureRatePct: 1.5,
          p95LatencyMs: 750,
          state: "WATCH",
          breaches: ["availability"],
          evidenceRefs: ["ev:xr:1"]
        },
        procurement: [
          { procurementId: "ao-1", riskScore: 75, riskBand: "HIGH", flags: ["single_bid"], interpretation: "risk_signal_only_human_review_required", evidenceRefs: ["ev:ao:1"] },
          { procurementId: "ao-2", riskScore: 0, riskBand: "LOW", flags: [], interpretation: "risk_signal_only_human_review_required", evidenceRefs: ["ev:ao:2"] }
        ]
      })
    ).toEqual({
      serviceCount: 2,
      serviceHealth: { healthy: 1, watch: 1, critical: 0 },
      averageServiceScore: 80,
      xroadState: "WATCH",
      highRiskProcurements: 1,
      decisionsRequired: [
        "Restore X-Road availability above 99%",
        "Review 1 high-risk procurement signal(s)",
        "Resolve service breaches: business-registration"
      ],
      evidenceRefs: ["ev:xr:1", "ev:ao:1", "ev:ao:2"]
    });
  });
});
