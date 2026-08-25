export const GENESIS_V4_GUINEA_DIGITAL_STATE_CONTROL_ANCHOR = {
  assetId: "GEN-V4-GN-DIGITAL-STATE-CONTROL-001",
  version: "0.1.0",
  decisionId: "V4-DEC-018",
  countryCode: "GN",
  proofMode: "CODE_VERIFIED_NOT_PRODUCTION_PROVEN"
} as const;

export type GovernmentActorType = "citizen" | "business" | "agent" | "system";

export interface GovernmentEvent {
  eventId: string;
  sourceSystem: string;
  institutionId: string;
  serviceId: string;
  actorType: GovernmentActorType;
  timestamp: string;
  countryCode: string;
  correlationId: string;
  classification: string;
  legalBasis: string;
  dataResidency: string;
  evidenceHash: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface ServiceObservation {
  slaCompliancePct: number;
  availabilityPct: number;
  errorRatePct: number;
  blockedCasePct: number;
  citizenSatisfactionPct: number;
  medianProcessingTimeMinutes: number;
  targetProcessingTimeMinutes: number;
}

export type ServiceControlState = "HEALTHY" | "WATCH" | "CRITICAL";

export interface ServiceScore {
  score: number;
  state: ServiceControlState;
  breaches: string[];
}

export interface XRoadCallObservation {
  serviceId: string;
  status: "success" | "failure";
  latencyMs: number;
  evidenceRef: string;
}

export interface XRoadHealthSummary {
  availabilityPct: number;
  failureRatePct: number;
  p95LatencyMs: number;
  state: ServiceControlState;
  breaches: string[];
  evidenceRefs: string[];
}

export interface ProcurementObservation {
  procurementId: string;
  bidderCount: number;
  estimatedValue: number;
  awardedValue: number;
  procurementMethod: "open" | "restricted" | "direct" | string;
  evidenceRefs: string[];
}

export interface ProcurementIntegrityAssessment {
  riskScore: number;
  riskBand: "LOW" | "MEDIUM" | "HIGH";
  flags: string[];
  interpretation: "risk_signal_only_human_review_required";
  evidenceRefs: string[];
}

export interface ReleaseEvidence {
  m6Passed: boolean;
  s7PlusPassed: boolean;
  m8Passed: boolean;
  rollbackTested: boolean;
  runtimeProofVerified: boolean;
}

export type ReleaseTruthStatus =
  | "INCOMPLETE"
  | "CODE_VERIFIED"
  | "PRODUCTION_PROVEN";

export interface ReleaseTruth {
  status: ReleaseTruthStatus;
  missing: Array<keyof ReleaseEvidence>;
}

const requiredEventFields: Array<keyof GovernmentEvent> = [
  "eventId",
  "sourceSystem",
  "institutionId",
  "serviceId",
  "actorType",
  "timestamp",
  "correlationId",
  "classification",
  "legalBasis",
  "dataResidency",
  "evidenceHash"
];

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function validateGovernmentEvent(event: GovernmentEvent): ValidationResult {
  const errors: string[] = [];

  if (event.countryCode !== "GN") {
    errors.push("countryCode must be GN");
  }

  for (const field of requiredEventFields) {
    const value = event[field];
    if (typeof value === "string" && value.trim().length === 0) {
      errors.push(`${field} is required`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function scoreDigitalService(observation: ServiceObservation): ServiceScore {
  const processingScore =
    observation.medianProcessingTimeMinutes <= 0
      ? 0
      : clamp(
          (observation.targetProcessingTimeMinutes /
            observation.medianProcessingTimeMinutes) *
            100
        );

  const errorQuality = clamp(100 - observation.errorRatePct * 10);
  const blockageQuality = clamp(100 - observation.blockedCasePct * 5);

  const rawScore =
    clamp(observation.slaCompliancePct) * 0.25 +
    clamp(observation.availabilityPct) * 0.2 +
    errorQuality * 0.15 +
    blockageQuality * 0.15 +
    clamp(observation.citizenSatisfactionPct) * 0.15 +
    processingScore * 0.1;

  const score = Math.round(rawScore);
  const breaches: string[] = [];

  if (observation.slaCompliancePct < 90) breaches.push("sla_compliance");
  if (observation.availabilityPct < 99) breaches.push("availability");
  if (observation.errorRatePct > 2) breaches.push("error_rate");
  if (observation.blockedCasePct > 5) breaches.push("blocked_cases");
  if (observation.citizenSatisfactionPct < 70) {
    breaches.push("citizen_satisfaction");
  }
  if (
    observation.medianProcessingTimeMinutes >
    observation.targetProcessingTimeMinutes
  ) {
    breaches.push("processing_time");
  }

  const state: ServiceControlState =
    score >= 85 && breaches.length === 0
      ? "HEALTHY"
      : score >= 65
        ? "WATCH"
        : "CRITICAL";

  return { score, state, breaches };
}

export function summarizeXRoadHealth(
  calls: XRoadCallObservation[]
): XRoadHealthSummary {
  if (!Array.isArray(calls) || calls.length === 0) {
    throw new Error("GUINEA_XROAD_NO_OBSERVATIONS");
  }

  const failures = calls.filter((call) => call.status === "failure").length;
  const availabilityPct = round1(((calls.length - failures) / calls.length) * 100);
  const failureRatePct = round1((failures / calls.length) * 100);
  const latencies = calls.map((call) => Math.max(0, call.latencyMs)).sort((a, b) => a - b);
  const p95Index = Math.max(0, Math.ceil(latencies.length * 0.95) - 1);
  const p95LatencyMs = latencies[p95Index] ?? 0;
  const breaches: string[] = [];

  if (availabilityPct < 99) breaches.push("availability");
  if (failureRatePct > 2) breaches.push("failure_rate");
  if (p95LatencyMs > 1000) breaches.push("p95_latency");

  const state: ServiceControlState =
    breaches.length === 0
      ? "HEALTHY"
      : availabilityPct >= 95 && failureRatePct <= 5
        ? "WATCH"
        : "CRITICAL";

  return {
    availabilityPct,
    failureRatePct,
    p95LatencyMs,
    state,
    breaches,
    evidenceRefs: calls.map((call) => call.evidenceRef)
  };
}

export function assessProcurementIntegrity(
  observation: ProcurementObservation
): ProcurementIntegrityAssessment {
  const flags: string[] = [];

  if (observation.bidderCount <= 1) flags.push("single_bid");
  if (
    observation.estimatedValue > 0 &&
    observation.awardedValue > observation.estimatedValue * 1.1
  ) {
    flags.push("award_above_estimate");
  }
  if (observation.procurementMethod === "restricted") {
    flags.push("restricted_method");
  }
  if (observation.procurementMethod === "direct") {
    flags.push("direct_award_method");
  }

  const riskScore = Math.min(100, flags.length * 25);
  const riskBand = riskScore >= 50 ? "HIGH" : riskScore >= 25 ? "MEDIUM" : "LOW";

  return {
    riskScore,
    riskBand,
    flags,
    interpretation: "risk_signal_only_human_review_required",
    evidenceRefs: [...observation.evidenceRefs]
  };
}

export function evaluateReleaseTruth(evidence: ReleaseEvidence): ReleaseTruth {
  const required: Array<keyof ReleaseEvidence> = [
    "m6Passed",
    "s7PlusPassed",
    "m8Passed",
    "rollbackTested",
    "runtimeProofVerified"
  ];

  const missing = required.filter((key) => !evidence[key]);

  if (missing.length === 0) {
    return { status: "PRODUCTION_PROVEN", missing: [] };
  }

  if (evidence.m6Passed && evidence.s7PlusPassed && evidence.m8Passed) {
    return { status: "CODE_VERIFIED", missing };
  }

  return { status: "INCOMPLETE", missing };
}
