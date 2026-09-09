import type {
  GovernmentEvent,
  ProcurementIntegrityAssessment,
  ProcurementObservation,
  ServiceControlState,
  ServiceScore,
  XRoadCallObservation,
  XRoadHealthSummary
} from "./guineaDigitalStateControl.js";

export interface EServiceSandboxRecord {
  requestId: string;
  institutionId: string;
  serviceId: string;
  status: "created" | "routed" | "blocked" | "completed";
  createdAt: string;
  completedAt?: string;
  citizenSatisfactionPct?: number;
  evidenceHash: string;
}

export interface XRoadSandboxRecord {
  exchangeId: string;
  serviceId: string;
  institutionId: string;
  status: "success" | "failure";
  latencyMs: number;
  occurredAt: string;
  evidenceRef: string;
}

export interface ProcurementSandboxRecord {
  procurementId: string;
  institutionId: string;
  bidderCount: number;
  estimatedValue: number;
  awardedValue: number;
  procurementMethod: string;
  occurredAt: string;
  evidenceRefs: string[];
}

export interface AdministrativeProcessEvent {
  caseId: string;
  step: string;
  occurredAt: string;
}

export interface ProcessBottleneck {
  transition: string;
  medianMinutes: number;
  samples: number;
}

export interface ProcessMiningResult {
  caseCount: number;
  medianCycleTimeMinutes: number;
  bottlenecks: ProcessBottleneck[];
}

export interface ExecutiveServiceResult extends ServiceScore {
  serviceId: string;
}

export interface ExecutiveProcurementResult extends ProcurementIntegrityAssessment {
  procurementId: string;
}

export interface ExecutiveCockpitInput {
  services: ExecutiveServiceResult[];
  xroad: XRoadHealthSummary;
  procurement: ExecutiveProcurementResult[];
}

function minutesBetween(start: string, end: string): number {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    throw new Error("GUINEA_INVALID_TIMESTAMP_SEQUENCE");
  }
  return Math.round(((endMs - startMs) / 60_000) * 100) / 100;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
  return Math.round(value * 100) / 100;
}

function eServiceEventType(status: EServiceSandboxRecord["status"]): string {
  return status === "created"
    ? "created"
    : status === "routed"
      ? "routed"
      : status === "blocked"
        ? "blocked"
        : "completed";
}

export function normalizeEServiceRecord(record: EServiceSandboxRecord): {
  event: GovernmentEvent;
  metrics: {
    processingTimeMinutes: number | null;
    citizenSatisfactionPct: number | null;
  };
} {
  const timestamp = record.status === "completed"
    ? record.completedAt
    : record.createdAt;

  if (!timestamp) {
    throw new Error("GUINEA_ESERVICE_COMPLETION_TIMESTAMP_REQUIRED");
  }

  return {
    event: {
      eventId: `eservice:${record.requestId}:${eServiceEventType(record.status)}`,
      sourceSystem: "e-service",
      institutionId: record.institutionId,
      serviceId: record.serviceId,
      actorType: "system",
      timestamp,
      countryCode: "GN",
      correlationId: record.requestId,
      classification: "internal",
      legalBasis: "public-service-delivery",
      dataResidency: "GN",
      evidenceHash: record.evidenceHash
    },
    metrics: {
      processingTimeMinutes: record.completedAt
        ? minutesBetween(record.createdAt, record.completedAt)
        : null,
      citizenSatisfactionPct: record.citizenSatisfactionPct ?? null
    }
  };
}

export function normalizeXRoadRecord(record: XRoadSandboxRecord): {
  event: GovernmentEvent;
  observation: XRoadCallObservation;
} {
  return {
    event: {
      eventId: `xroad:${record.exchangeId}`,
      sourceSystem: "xroad",
      institutionId: record.institutionId,
      serviceId: record.serviceId,
      actorType: "system",
      timestamp: record.occurredAt,
      countryCode: "GN",
      correlationId: record.exchangeId,
      classification: "internal",
      legalBasis: "interoperability-observability",
      dataResidency: "GN",
      evidenceHash: record.evidenceRef
    },
    observation: {
      serviceId: record.serviceId,
      status: record.status,
      latencyMs: record.latencyMs,
      evidenceRef: record.evidenceRef
    }
  };
}

export function normalizeProcurementRecord(record: ProcurementSandboxRecord): {
  event: GovernmentEvent;
  observation: ProcurementObservation;
} {
  if (record.evidenceRefs.length === 0) {
    throw new Error("GUINEA_PROCUREMENT_EVIDENCE_REQUIRED");
  }

  return {
    event: {
      eventId: `procurement:${record.procurementId}`,
      sourceSystem: "e-procurement",
      institutionId: record.institutionId,
      serviceId: "public-procurement",
      actorType: "system",
      timestamp: record.occurredAt,
      countryCode: "GN",
      correlationId: record.procurementId,
      classification: "internal",
      legalBasis: "public-procurement-oversight",
      dataResidency: "GN",
      evidenceHash: record.evidenceRefs.join("|")
    },
    observation: {
      procurementId: record.procurementId,
      bidderCount: record.bidderCount,
      estimatedValue: record.estimatedValue,
      awardedValue: record.awardedValue,
      procurementMethod: record.procurementMethod,
      evidenceRefs: [...record.evidenceRefs]
    }
  };
}

export function mineAdministrativeProcess(events: AdministrativeProcessEvent[]): ProcessMiningResult {
  const byCase = new Map<string, AdministrativeProcessEvent[]>();
  for (const event of events) {
    const rows = byCase.get(event.caseId) ?? [];
    rows.push(event);
    byCase.set(event.caseId, rows);
  }

  const cycleTimes: number[] = [];
  const transitionSamples = new Map<string, number[]>();

  for (const rows of byCase.values()) {
    const ordered = [...rows].sort(
      (a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt)
    );
    if (ordered.length >= 2) {
      cycleTimes.push(
        minutesBetween(ordered[0]!.occurredAt, ordered[ordered.length - 1]!.occurredAt)
      );
    }

    for (let index = 0; index < ordered.length - 1; index += 1) {
      const from = ordered[index]!;
      const to = ordered[index + 1]!;
      const key = `${from.step}→${to.step}`;
      const samples = transitionSamples.get(key) ?? [];
      samples.push(minutesBetween(from.occurredAt, to.occurredAt));
      transitionSamples.set(key, samples);
    }
  }

  const bottlenecks = [...transitionSamples.entries()]
    .map(([transition, samples]) => ({
      transition,
      medianMinutes: median(samples),
      samples: samples.length
    }))
    .sort((a, b) => b.medianMinutes - a.medianMinutes || a.transition.localeCompare(b.transition));

  return {
    caseCount: byCase.size,
    medianCycleTimeMinutes: median(cycleTimes),
    bottlenecks
  };
}

export function buildExecutiveCockpit(input: ExecutiveCockpitInput): {
  serviceCount: number;
  serviceHealth: { healthy: number; watch: number; critical: number };
  averageServiceScore: number;
  xroadState: ServiceControlState;
  highRiskProcurements: number;
  decisionsRequired: string[];
  evidenceRefs: string[];
} {
  const serviceHealth = { healthy: 0, watch: 0, critical: 0 };
  for (const service of input.services) {
    if (service.state === "HEALTHY") serviceHealth.healthy += 1;
    if (service.state === "WATCH") serviceHealth.watch += 1;
    if (service.state === "CRITICAL") serviceHealth.critical += 1;
  }

  const averageServiceScore = input.services.length === 0
    ? 0
    : Math.round(
        input.services.reduce((sum, service) => sum + service.score, 0) /
          input.services.length
      );
  const highRiskProcurements = input.procurement.filter(
    (item) => item.riskBand === "HIGH"
  ).length;
  const decisionsRequired: string[] = [];

  if (input.xroad.availabilityPct < 99) {
    decisionsRequired.push("Restore X-Road availability above 99%");
  }
  if (highRiskProcurements > 0) {
    decisionsRequired.push(`Review ${highRiskProcurements} high-risk procurement signal(s)`);
  }
  const breachedServices = input.services
    .filter((service) => service.breaches.length > 0)
    .map((service) => service.serviceId);
  if (breachedServices.length > 0) {
    decisionsRequired.push(`Resolve service breaches: ${breachedServices.join(", ")}`);
  }

  const evidenceRefs = [
    ...input.xroad.evidenceRefs,
    ...input.procurement.flatMap((item) => item.evidenceRefs)
  ].filter((value, index, all) => all.indexOf(value) === index);

  return {
    serviceCount: input.services.length,
    serviceHealth,
    averageServiceScore,
    xroadState: input.xroad.state,
    highRiskProcurements,
    decisionsRequired,
    evidenceRefs
  };
}
