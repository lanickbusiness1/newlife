import { z } from "zod";

export const GENESIS_V4_SENEGAL_MICROFINANCE_ANCHOR = {
  signalId: "SIG-SN-MICROFINANCE-20260901",
  parentAssetId: "PRD-AFRIAPAY-001",
  moduleAssetId: "MOD-PAY-SOCIAL-SELLER-001",
  name: "Senegal Microfinance Country Use-Case",
  country: "SN",
  regulatoryZone: "UEMOA/BCEAO",
  commercialProduct: false,
  governance: "EXTEND_EXISTING",
  version: "0.2.0"
} as const;

type OfficialEvidenceRecord = {
  id: string;
  authority: "GOVERNMENT_OF_SENEGAL" | "MMESS_SENEGAL" | "BCEAO" | "CDP_SENEGAL";
  title: string;
  sourceUrl: string;
  evidenceClass: "POLICY" | "REGULATION" | "DATA_PROTECTION";
  verifiedAsOf: "2026-09-01";
};

export const SENEGAL_MICROFINANCE_OFFICIAL_EVIDENCE = {
  PACTIFU_PRIMATURE: {
    id: "official://sn/primature/pactifu-2025-2029",
    authority: "GOVERNMENT_OF_SENEGAL",
    title: "Pacte pour l’inclusion financière universelle (PACTIFU)",
    sourceUrl: "https://www.primature.sn/actions-et-realisations/femmes-enfance-et-economie-solidaire/pacte-pour-linclusion-financiere",
    evidenceClass: "POLICY",
    verifiedAsOf: "2026-09-01"
  },
  SFC_PRIMATURE: {
    id: "official://sn/primature/strategie-financement-ciblee",
    authority: "GOVERNMENT_OF_SENEGAL",
    title: "Stratégie de financement ciblée",
    sourceUrl: "https://www.primature.sn/actions-et-realisations/femmes-enfance-et-economie-solidaire/lancement-strategie-de-financement",
    evidenceClass: "POLICY",
    verifiedAsOf: "2026-09-01"
  },
  PACTIFU_MMESS: {
    id: "official://sn/mmess/pactifu-signature-2025-02-21",
    authority: "MMESS_SENEGAL",
    title: "Signature officielle du PACTIFU avec l’APSFD/APIM",
    sourceUrl: "https://www.microfinance-ess.gouv.sn/fr/node/348",
    evidenceClass: "POLICY",
    verifiedAsOf: "2026-09-01"
  },
  PAYMENT_SERVICES_BCEAO: {
    id: "official://umoa/bceao/instruction-001-01-2024-payment-services",
    authority: "BCEAO",
    title: "Instruction n°001-01-2024 relative aux services de paiement dans l’UMOA",
    sourceUrl: "https://www.bceao.int/fr/reglementations/instruction-ndeg001-01-2024-du-23-janvier-2024-relative-aux-services-de-paiement",
    evidenceClass: "REGULATION",
    verifiedAsOf: "2026-09-01"
  },
  SFD_LAW_BCEAO: {
    id: "official://umoa/bceao/sfd-law",
    authority: "BCEAO",
    title: "Loi portant réglementation des Systèmes Financiers Décentralisés de l’UMOA",
    sourceUrl: "https://www.bceao.int/fr/reglementations/loi-portant-reglementation-des-systemes-financiers-decentralises-de-lumoa",
    evidenceClass: "REGULATION",
    verifiedAsOf: "2026-09-01"
  },
  INCLUSION_STRATEGY_BCEAO: {
    id: "official://uemoa/bceao/inclusion-strategy-2025-2030",
    authority: "BCEAO",
    title: "Politique et Stratégie régionale d’inclusion financière UEMOA 2025-2030",
    sourceUrl: "https://www.bceao.int/fr/documents/document-cadre-de-politique-et-de-strategie-regionale-dinclusion-financiere-dans-luemoa",
    evidenceClass: "POLICY",
    verifiedAsOf: "2026-09-01"
  },
  AML_CFT_BCEAO: {
    id: "official://umoa/bceao/aml-cft-fp-uniform-law-2023",
    authority: "BCEAO",
    title: "Loi uniforme LBC/FT/FP adoptée le 31 mars 2023",
    sourceUrl: "https://downloads.bceao.int/fr/reglementations/loi-uniforme-relative-la-lutte-contre-le-blanchiment-de-capitaux-le-financement-du",
    evidenceClass: "REGULATION",
    verifiedAsOf: "2026-09-01"
  },
  DATA_PROTECTION_CDP: {
    id: "official://sn/cdp/law-2008-12-personal-data",
    authority: "CDP_SENEGAL",
    title: "Loi n°2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel",
    sourceUrl: "https://www.cdp.sn/legislation/textes-legislatifs",
    evidenceClass: "DATA_PROTECTION",
    verifiedAsOf: "2026-09-01"
  }
} as const satisfies Record<string, OfficialEvidenceRecord>;

const KNOWN_OFFICIAL_EVIDENCE_REFS = new Set(
  Object.values(SENEGAL_MICROFINANCE_OFFICIAL_EVIDENCE).map(record => record.id)
);

export type SenegalMicrofinancePilotStatus = "HOLD" | "GO_DESIGN" | "READY_FOR_PILOT";

export type SenegalMicrofinancePilotInput = {
  pilotId: string;
  officialEvidenceRefs: string[];
  partnerEvidenceRefs: string[];
  regulatoryReviewStatus: "NOT_STARTED" | "IN_REVIEW" | "CLEARED";
  consentAndDataGovernanceReady: boolean;
  imfIntegrationReady: boolean;
  mobileMoneyIntegrationReady: boolean;
  financialPassportReady: boolean;
  impactMeasurementReady: boolean;
};

export type SenegalMicrofinancePilotDecision = {
  pilotId: string;
  status: SenegalMicrofinancePilotStatus;
  blockers: string[];
  guardrails: string[];
  anchor: typeof GENESIS_V4_SENEGAL_MICROFINANCE_ANCHOR;
};

const PilotInputSchema = z.object({
  pilotId: z.string().min(1),
  officialEvidenceRefs: z.array(z.string().min(1)).default([]),
  partnerEvidenceRefs: z.array(z.string().min(1)).default([]),
  regulatoryReviewStatus: z.enum(["NOT_STARTED", "IN_REVIEW", "CLEARED"]),
  consentAndDataGovernanceReady: z.boolean(),
  imfIntegrationReady: z.boolean(),
  mobileMoneyIntegrationReady: z.boolean(),
  financialPassportReady: z.boolean(),
  impactMeasurementReady: z.boolean()
});

const GUARDRAILS = [
  "NO_AUTOMATED_CREDIT_DECISION",
  "PARTNER_AUTHORITY_REQUIRED_FOR_CREDIT_DECISION",
  "EXPLICIT_CONSENT_REQUIRED_FOR_DATA_SHARING",
  "OFFICIAL_EVIDENCE_REQUIRED_FOR_POLICY_CLAIMS",
  "PARTNER_EVIDENCE_REQUIRED_FOR_INTEGRATION_CLAIMS",
  "UNKNOWN_OFFICIAL_EVIDENCE_FAILS_CLOSED"
] as const;

function invalidDecision(input: unknown): SenegalMicrofinancePilotDecision {
  const pilotId =
    typeof input === "object" && input !== null && "pilotId" in input && typeof (input as any).pilotId === "string"
      ? (input as any).pilotId
      : "unknown";

  return {
    pilotId,
    status: "HOLD",
    blockers: ["INVALID_INPUT"],
    guardrails: [...GUARDRAILS],
    anchor: GENESIS_V4_SENEGAL_MICROFINANCE_ANCHOR
  };
}

function readinessBlockers(input: SenegalMicrofinancePilotInput): string[] {
  const blockers: string[] = [];
  const knownOfficialRefs = input.officialEvidenceRefs.filter(ref => KNOWN_OFFICIAL_EVIDENCE_REFS.has(ref));
  const unknownOfficialRefs = input.officialEvidenceRefs.filter(ref => !KNOWN_OFFICIAL_EVIDENCE_REFS.has(ref));

  if (knownOfficialRefs.length === 0) blockers.push("UNVERIFIED_PUBLIC_SIGNAL");
  if (unknownOfficialRefs.length > 0) blockers.push("UNKNOWN_OFFICIAL_EVIDENCE_REF");
  if (input.partnerEvidenceRefs.length === 0) blockers.push("UNVERIFIED_PARTNER_ACCESS");
  if (input.regulatoryReviewStatus !== "CLEARED") blockers.push("REGULATORY_CLEARANCE_PENDING");
  if (!input.consentAndDataGovernanceReady) blockers.push("DATA_GOVERNANCE_NOT_READY");
  if (!input.imfIntegrationReady) blockers.push("IMF_INTEGRATION_NOT_READY");
  if (!input.mobileMoneyIntegrationReady) blockers.push("MOBILE_MONEY_INTEGRATION_NOT_READY");
  if (!input.financialPassportReady) blockers.push("FINANCIAL_PASSPORT_NOT_READY");
  if (!input.impactMeasurementReady) blockers.push("IMPACT_MEASUREMENT_NOT_READY");

  return blockers;
}

export function evaluateSenegalMicrofinancePilot(input: unknown): SenegalMicrofinancePilotDecision {
  const parsed = PilotInputSchema.safeParse(input);
  if (!parsed.success) return invalidDecision(input);

  const data: SenegalMicrofinancePilotInput = parsed.data;
  const blockers = readinessBlockers(data);
  const evidenceBlocked = blockers.includes("UNVERIFIED_PUBLIC_SIGNAL") || blockers.includes("UNKNOWN_OFFICIAL_EVIDENCE_REF");

  if (evidenceBlocked) {
    return {
      pilotId: data.pilotId,
      status: "HOLD",
      blockers,
      guardrails: [...GUARDRAILS],
      anchor: GENESIS_V4_SENEGAL_MICROFINANCE_ANCHOR
    };
  }

  return {
    pilotId: data.pilotId,
    status: blockers.length === 0 ? "READY_FOR_PILOT" : "GO_DESIGN",
    blockers,
    guardrails: [...GUARDRAILS],
    anchor: GENESIS_V4_SENEGAL_MICROFINANCE_ANCHOR
  };
}
