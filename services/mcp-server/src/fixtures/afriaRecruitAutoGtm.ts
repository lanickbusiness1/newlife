import type {
  ActualOutcome,
  StrategyScenario,
  WorldObservation
} from "../worldModelRuntime.js";

export interface AfriaRecruitAutoGtmProofFixture {
  purpose: string;
  disclaimer: string;
  observations: WorldObservation[];
  scenarios: StrategyScenario[];
  actualOutcome: ActualOutcome;
}

export const afriaRecruitAutoGtmProofFixture: AfriaRecruitAutoGtmProofFixture = {
  purpose: "Exercise the complete GENESIS V4 World Model Runtime chain for an AfrIA Recruit B2B Auto-GTM sandbox proof.",
  disclaimer: "Synthetic test fixture only. Conversion, revenue, cost, risk and outcome values are not real market performance and must never be presented as customer, pilot or production evidence.",
  observations: [
    {
      id: "synthetic-obs-product-readiness",
      entityKey: "afria-recruit",
      layer: "internal_state",
      metric: "commercial_proof_readiness",
      value: 0.82,
      confidence: 0.9,
      observedAt: "2026-08-18T12:00:00Z",
      sourceRef: "fixture:afria-recruit-auto-gtm",
      evidenceRef: "synthetic:evidence:product-readiness"
    },
    {
      id: "synthetic-obs-buyer-urgency",
      entityKey: "b2b-market",
      layer: "external_environment",
      metric: "buyer_urgency",
      value: 0.7,
      confidence: 0.8,
      observedAt: "2026-08-18T12:05:00Z",
      sourceRef: "fixture:afria-recruit-auto-gtm",
      evidenceRef: "synthetic:evidence:buyer-urgency"
    },
    {
      id: "synthetic-obs-cycle-window",
      entityKey: "b2b-market",
      layer: "temporal",
      metric: "decision_window_days",
      value: 14,
      confidence: 0.75,
      observedAt: "2026-08-18T12:10:00Z",
      sourceRef: "fixture:afria-recruit-auto-gtm",
      evidenceRef: "synthetic:evidence:decision-window"
    }
  ],
  scenarios: [
    {
      id: "linkedin-direct",
      label: "LinkedIn direct",
      channel: "linkedin",
      expectedConversion: 0.34,
      expectedRevenue: 5000,
      cost: 120,
      risk: 0.1,
      confidence: 0.7,
      reversibility: true,
      constraints: ["sandbox-only", "no-live-send"],
      evidenceRefs: ["synthetic:evidence:linkedin"]
    },
    {
      id: "institutional-email",
      label: "Institutional email",
      channel: "email",
      expectedConversion: 0.27,
      expectedRevenue: 6500,
      cost: 160,
      risk: 0.25,
      confidence: 0.65,
      reversibility: true,
      constraints: ["draft-only", "no-send"],
      evidenceRefs: ["synthetic:evidence:email"]
    },
    {
      id: "recruiter-partner",
      label: "Recruiter / partner",
      channel: "partner",
      expectedConversion: 0.46,
      expectedRevenue: 10000,
      cost: 450,
      risk: 0.12,
      confidence: 0.8,
      reversibility: true,
      constraints: ["sandbox-crm", "human-owned-live-outreach"],
      evidenceRefs: ["synthetic:evidence:partner"]
    }
  ],
  actualOutcome: {
    metric: "conversion_rate",
    actualValue: 0.31,
    observedAt: "2026-08-19T12:00:00Z",
    evidenceRef: "synthetic:evidence:actual-conversion"
  }
};
