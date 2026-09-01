import { describe, expect, test } from "vitest";
import {
  evaluateSenegalMicrofinancePilot,
  GENESIS_V4_SENEGAL_MICROFINANCE_ANCHOR,
  SENEGAL_MICROFINANCE_OFFICIAL_EVIDENCE
} from "../src/senegalMicrofinancePilot.js";

const PACTIFU_EVIDENCE = SENEGAL_MICROFINANCE_OFFICIAL_EVIDENCE.PACTIFU_PRIMATURE.id;

describe("Senegal microfinance country use-case evaluator", () => {
  test("fails closed when the public policy signal has no official evidence", () => {
    const result = evaluateSenegalMicrofinancePilot({
      pilotId: "SN-MFI-001",
      officialEvidenceRefs: [],
      partnerEvidenceRefs: ["evidence://partner-dd-001"],
      regulatoryReviewStatus: "CLEARED",
      consentAndDataGovernanceReady: true,
      imfIntegrationReady: true,
      mobileMoneyIntegrationReady: true,
      financialPassportReady: true,
      impactMeasurementReady: true
    });

    expect(result.status).toBe("HOLD");
    expect(result.blockers).toContain("UNVERIFIED_PUBLIC_SIGNAL");
  });

  test("rejects arbitrary strings masquerading as official evidence", () => {
    const result = evaluateSenegalMicrofinancePilot({
      pilotId: "SN-MFI-FAKE-EVIDENCE",
      officialEvidenceRefs: ["evidence://made-up-official-policy"],
      partnerEvidenceRefs: ["evidence://partner-dd-001"],
      regulatoryReviewStatus: "CLEARED",
      consentAndDataGovernanceReady: true,
      imfIntegrationReady: true,
      mobileMoneyIntegrationReady: true,
      financialPassportReady: true,
      impactMeasurementReady: true
    });

    expect(result.status).toBe("HOLD");
    expect(result.blockers).toContain("UNVERIFIED_PUBLIC_SIGNAL");
    expect(result.blockers).toContain("UNKNOWN_OFFICIAL_EVIDENCE_REF");
  });

  test("allows design work but not a pilot when partner access is unproven", () => {
    const result = evaluateSenegalMicrofinancePilot({
      pilotId: "SN-MFI-002",
      officialEvidenceRefs: [PACTIFU_EVIDENCE],
      partnerEvidenceRefs: [],
      regulatoryReviewStatus: "IN_REVIEW",
      consentAndDataGovernanceReady: true,
      imfIntegrationReady: false,
      mobileMoneyIntegrationReady: false,
      financialPassportReady: false,
      impactMeasurementReady: true
    });

    expect(result.status).toBe("GO_DESIGN");
    expect(result.blockers).toContain("UNVERIFIED_PARTNER_ACCESS");
    expect(result.blockers).toContain("REGULATORY_CLEARANCE_PENDING");
  });

  test("marks an institutional pilot ready only when evidence and governance gates are closed", () => {
    const result = evaluateSenegalMicrofinancePilot({
      pilotId: "SN-MFI-003",
      officialEvidenceRefs: [PACTIFU_EVIDENCE],
      partnerEvidenceRefs: ["evidence://imf-access-001", "evidence://mobile-money-access-001"],
      regulatoryReviewStatus: "CLEARED",
      consentAndDataGovernanceReady: true,
      imfIntegrationReady: true,
      mobileMoneyIntegrationReady: true,
      financialPassportReady: true,
      impactMeasurementReady: true
    });

    expect(result.status).toBe("READY_FOR_PILOT");
    expect(result.blockers).toEqual([]);
    expect(result.guardrails).toContain("NO_AUTOMATED_CREDIT_DECISION");
  });

  test("fails closed instead of throwing on malformed input", () => {
    const result = evaluateSenegalMicrofinancePilot(null);

    expect(result.status).toBe("HOLD");
    expect(result.blockers).toContain("INVALID_INPUT");
  });

  test("anchors the use case to AfrIA Pay and Financial Passport without creating a product", () => {
    expect(GENESIS_V4_SENEGAL_MICROFINANCE_ANCHOR.parentAssetId).toBe("PRD-AFRIAPAY-001");
    expect(GENESIS_V4_SENEGAL_MICROFINANCE_ANCHOR.moduleAssetId).toBe("MOD-PAY-SOCIAL-SELLER-001");
    expect(GENESIS_V4_SENEGAL_MICROFINANCE_ANCHOR.country).toBe("SN");
    expect(GENESIS_V4_SENEGAL_MICROFINANCE_ANCHOR.commercialProduct).toBe(false);
  });

  test("ships a canonical registry of authoritative Senegal/UEMOA sources", () => {
    expect(SENEGAL_MICROFINANCE_OFFICIAL_EVIDENCE.PACTIFU_PRIMATURE.authority).toBe("GOVERNMENT_OF_SENEGAL");
    expect(SENEGAL_MICROFINANCE_OFFICIAL_EVIDENCE.PAYMENT_SERVICES_BCEAO.authority).toBe("BCEAO");
    expect(SENEGAL_MICROFINANCE_OFFICIAL_EVIDENCE.DATA_PROTECTION_CDP.authority).toBe("CDP_SENEGAL");
  });
});
