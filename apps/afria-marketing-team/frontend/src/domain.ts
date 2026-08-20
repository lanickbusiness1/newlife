export const CANONICAL_PRODUCT = {
  name: "AfrIA Marketing Team™",
  assetId: "PRD-MKT-TEAM-001",
  baseline: "v1.1 + Auto-GTM P0 v0.3.0",
  productStandard: "Production Product",
  productionRevenueReady: false,
  productionRevenueReadyLiteral: "PRODUCTION_REVENUE_READY=false",
  owner: "AfrIAgenesis®",
  operator: "AfrIA Marketing Team™",
  primaryMarkets: ["Bénin", "Mali", "Guinée", "Sénégal", "Pan-Africain"]
} as const;

export const CRM_STAGES = [
  "Signal",
  "Lead qualifié",
  "Diagnostic",
  "Proposition",
  "Paiement",
  "Livraison",
  "Cas client",
  "Upsell / Referral"
] as const;

export const CAPABILITIES = ["READ", "GENERATE", "PROPOSE", "WRITE", "SEND", "PAY", "DELETE", "EXPORT"] as const;

export type Capability = (typeof CAPABILITIES)[number];
export type AgentId = "strategist" | "creator" | "designer" | "analyst" | "cmo";
export type PolicyState = "allowed" | "needs_human" | "blocked";

export interface ProductObject {
  name: string;
  country: string;
  language: "fr" | "en";
  objective: string;
  proofRefs: string[];
}

export interface OfferObject {
  name: string;
  promise: string;
  deliverable: string;
  price: number;
  currency: string;
  cta: string;
}

export interface ICPObject {
  segment: string;
  buyerRole: string;
  geography: string[];
  pains: string[];
  urgency: "low" | "medium" | "high";
}

export interface LeadObject {
  id: string;
  name: string;
  company: string;
  country: string;
  stage: (typeof CRM_STAGES)[number];
  score: number;
  nextAction: string;
  evidenceRefs: string[];
}

export interface RevenueSnapshot {
  leads: number;
  diagnostics: number;
  proposals: number;
  payments: number;
  revenue: number;
  currency: string;
  expectedRevenue: number;
}

export interface PolicyDecision {
  capability: Capability;
  state: PolicyState;
  reason: string;
  humanApprovalRequired: boolean;
  auditRef: string;
}

export interface AgentContext {
  productName: string;
  country: string;
  buyer: string;
  offer: string;
  price: string;
}

export const PRODUCT_SECTIONS = [
  "Command Center",
  "5 Agents",
  "LeadEngine",
  "CRM",
  "Revenue Cockpit",
  "R.E.M.E",
  "Export Center",
  "Governance"
] as const;
