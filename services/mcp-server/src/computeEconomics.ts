import { createHash } from "node:crypto";

export type ComputeDataClassification = "public" | "internal" | "confidential" | "restricted";

export interface ComputeWorkloadProfile {
  workloadId: string;
  dataClassification: ComputeDataClassification;
  inputTokensPerRequest: number;
  outputTokensPerRequest: number;
  requestsPerMonth: number;
  revenuePerMonthUsd: number;
  minQualityScore: number;
  maxTtftMs: number;
  maxInterTokenLatencyMs: number;
}

export interface ComputeCandidate {
  provider: string;
  model: string;
  accelerator: string;
  region: string;
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
  ttftMs: number;
  interTokenLatencyMs: number;
  throughputTokensPerSecond: number;
  qualityScore: number;
  sovereigntyScore: number;
  lockInScore: number;
  energyWhPerThousandTokens: number;
  slaPercent: number;
}

export interface CandidateEconomics extends ComputeCandidate {
  eligible: boolean;
  ineligibilityReasons: string[];
  monthlyTokens: number;
  monthlyInferenceCostUsd: number;
  tokensPerUsd: number;
  tokensPerWattHour: number;
  marginUsd: number;
  marginPercent: number;
  economicScore: number;
}

export interface AiEconomicsCertificate {
  schemaVersion: "1.0.0";
  workloadId: string;
  provider: string;
  model: string;
  accelerator: string;
  region: string;
  monthlyTokens: number;
  monthlyInferenceCostUsd: number;
  tokensPerUsd: number;
  tokensPerWattHour: number;
  ttftMs: number;
  interTokenLatencyMs: number;
  throughputTokensPerSecond: number;
  qualityScore: number;
  sovereigntyScore: number;
  lockInScore: number;
  energyWhPerThousandTokens: number;
  slaPercent: number;
  marginUsd: number;
  marginPercent: number;
  generatedAt: string;
  sha256: string;
}

export interface ComputeEconomicsPlanInput {
  workload: ComputeWorkloadProfile;
  candidates: ComputeCandidate[];
  generatedAt: string;
}

export interface ComputeEconomicsPlan {
  decision: "ROUTE";
  selected: CandidateEconomics;
  evaluated: CandidateEconomics[];
  certificate: AiEconomicsCertificate;
  generatedAt: string;
}

function requiredString(value: string, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`COMPUTE_ECONOMICS_INVALID: ${name} is required`);
  }
  return value.trim();
}

function finite(value: number, name: string, minimum = 0): number {
  if (!Number.isFinite(value) || value < minimum) {
    throw new Error(`COMPUTE_ECONOMICS_INVALID: ${name} must be a finite number >= ${minimum}`);
  }
  return value;
}

function bounded(value: number, name: string, min: number, max: number): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`COMPUTE_ECONOMICS_INVALID: ${name} must be between ${min} and ${max}`);
  }
  return value;
}

function round(value: number, decimals = 6): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function sovereigntyThreshold(classification: ComputeDataClassification): number {
  switch (classification) {
    case "restricted": return 85;
    case "confidential": return 70;
    case "internal": return 50;
    case "public": return 0;
  }
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

function certificateDigest(value: Omit<AiEconomicsCertificate, "sha256">): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

function withoutCertificateHash(certificate: AiEconomicsCertificate): Omit<AiEconomicsCertificate, "sha256"> {
  const { sha256: _sha256, ...rest } = certificate;
  return rest;
}

function validateInput(input: ComputeEconomicsPlanInput): void {
  requiredString(input.workload.workloadId, "workload.workloadId");
  requiredString(input.generatedAt, "generatedAt");
  finite(input.workload.inputTokensPerRequest, "workload.inputTokensPerRequest");
  finite(input.workload.outputTokensPerRequest, "workload.outputTokensPerRequest");
  finite(input.workload.requestsPerMonth, "workload.requestsPerMonth", 1);
  finite(input.workload.revenuePerMonthUsd, "workload.revenuePerMonthUsd");
  bounded(input.workload.minQualityScore, "workload.minQualityScore", 0, 1);
  finite(input.workload.maxTtftMs, "workload.maxTtftMs", 1);
  finite(input.workload.maxInterTokenLatencyMs, "workload.maxInterTokenLatencyMs", 1);

  if (!Array.isArray(input.candidates) || input.candidates.length === 0) {
    throw new Error("COMPUTE_ECONOMICS_INVALID: at least one compute candidate is required");
  }

  for (const [index, candidate] of input.candidates.entries()) {
    const prefix = `candidates[${index}]`;
    requiredString(candidate.provider, `${prefix}.provider`);
    requiredString(candidate.model, `${prefix}.model`);
    requiredString(candidate.accelerator, `${prefix}.accelerator`);
    requiredString(candidate.region, `${prefix}.region`);
    finite(candidate.inputUsdPerMillionTokens, `${prefix}.inputUsdPerMillionTokens`);
    finite(candidate.outputUsdPerMillionTokens, `${prefix}.outputUsdPerMillionTokens`);
    finite(candidate.ttftMs, `${prefix}.ttftMs`, 1);
    finite(candidate.interTokenLatencyMs, `${prefix}.interTokenLatencyMs`, 1);
    finite(candidate.throughputTokensPerSecond, `${prefix}.throughputTokensPerSecond`, 0.000001);
    bounded(candidate.qualityScore, `${prefix}.qualityScore`, 0, 1);
    bounded(candidate.sovereigntyScore, `${prefix}.sovereigntyScore`, 0, 100);
    bounded(candidate.lockInScore, `${prefix}.lockInScore`, 0, 100);
    finite(candidate.energyWhPerThousandTokens, `${prefix}.energyWhPerThousandTokens`, 0.000001);
    bounded(candidate.slaPercent, `${prefix}.slaPercent`, 0, 100);
  }
}

function buildCandidateEconomics(
  workload: ComputeWorkloadProfile,
  candidate: ComputeCandidate,
  cheapestEligibleCost?: number
): CandidateEconomics {
  const monthlyInputTokens = workload.inputTokensPerRequest * workload.requestsPerMonth;
  const monthlyOutputTokens = workload.outputTokensPerRequest * workload.requestsPerMonth;
  const monthlyTokens = monthlyInputTokens + monthlyOutputTokens;
  const monthlyInferenceCostUsd =
    (monthlyInputTokens / 1_000_000) * candidate.inputUsdPerMillionTokens
    + (monthlyOutputTokens / 1_000_000) * candidate.outputUsdPerMillionTokens;
  const totalEnergyWh = (monthlyTokens / 1_000) * candidate.energyWhPerThousandTokens;
  const marginUsd = workload.revenuePerMonthUsd - monthlyInferenceCostUsd;
  const marginPercent = workload.revenuePerMonthUsd === 0
    ? 0
    : (marginUsd / workload.revenuePerMonthUsd) * 100;

  const ineligibilityReasons: string[] = [];
  if (candidate.qualityScore < workload.minQualityScore) ineligibilityReasons.push("quality_floor");
  if (candidate.ttftMs > workload.maxTtftMs) ineligibilityReasons.push("ttft_limit");
  if (candidate.interTokenLatencyMs > workload.maxInterTokenLatencyMs) ineligibilityReasons.push("inter_token_latency_limit");
  if (candidate.sovereigntyScore < sovereigntyThreshold(workload.dataClassification)) ineligibilityReasons.push("sovereignty_floor");

  const costScore = cheapestEligibleCost === undefined || monthlyInferenceCostUsd === 0
    ? 100
    : Math.min(100, (cheapestEligibleCost / monthlyInferenceCostUsd) * 100);
  const latencyScore = (
    Math.min(100, (workload.maxTtftMs / candidate.ttftMs) * 100)
    + Math.min(100, (workload.maxInterTokenLatencyMs / candidate.interTokenLatencyMs) * 100)
  ) / 2;
  const economicScore =
    candidate.qualityScore * 100 * 0.30
    + candidate.sovereigntyScore * 0.25
    + costScore * 0.20
    + latencyScore * 0.15
    + (100 - candidate.lockInScore) * 0.10;

  return {
    ...candidate,
    eligible: ineligibilityReasons.length === 0,
    ineligibilityReasons,
    monthlyTokens: round(monthlyTokens, 0),
    monthlyInferenceCostUsd: round(monthlyInferenceCostUsd),
    tokensPerUsd: monthlyInferenceCostUsd === 0 ? Number.MAX_SAFE_INTEGER : round(monthlyTokens / monthlyInferenceCostUsd),
    tokensPerWattHour: round(monthlyTokens / totalEnergyWh),
    marginUsd: round(marginUsd),
    marginPercent: round(marginPercent),
    economicScore: round(economicScore)
  };
}

function buildCertificate(
  workloadId: string,
  selected: CandidateEconomics,
  generatedAt: string
): AiEconomicsCertificate {
  const withoutHash: Omit<AiEconomicsCertificate, "sha256"> = {
    schemaVersion: "1.0.0",
    workloadId,
    provider: selected.provider,
    model: selected.model,
    accelerator: selected.accelerator,
    region: selected.region,
    monthlyTokens: selected.monthlyTokens,
    monthlyInferenceCostUsd: selected.monthlyInferenceCostUsd,
    tokensPerUsd: selected.tokensPerUsd,
    tokensPerWattHour: selected.tokensPerWattHour,
    ttftMs: selected.ttftMs,
    interTokenLatencyMs: selected.interTokenLatencyMs,
    throughputTokensPerSecond: selected.throughputTokensPerSecond,
    qualityScore: selected.qualityScore,
    sovereigntyScore: selected.sovereigntyScore,
    lockInScore: selected.lockInScore,
    energyWhPerThousandTokens: selected.energyWhPerThousandTokens,
    slaPercent: selected.slaPercent,
    marginUsd: selected.marginUsd,
    marginPercent: selected.marginPercent,
    generatedAt
  };

  return { ...withoutHash, sha256: certificateDigest(withoutHash) };
}

export function compileComputeEconomicsPlan(input: ComputeEconomicsPlanInput): ComputeEconomicsPlan {
  validateInput(input);

  const preliminary = input.candidates.map(candidate => buildCandidateEconomics(input.workload, candidate));
  const eligible = preliminary.filter(candidate => candidate.eligible);
  if (eligible.length === 0) {
    throw new Error("COMPUTE_NO_ELIGIBLE_CANDIDATE: sovereignty, quality or latency policy rejected all candidates");
  }

  const cheapestEligibleCost = Math.min(...eligible.map(candidate => candidate.monthlyInferenceCostUsd));
  const evaluated = input.candidates.map(candidate => buildCandidateEconomics(input.workload, candidate, cheapestEligibleCost));
  const selected = evaluated
    .filter(candidate => candidate.eligible)
    .sort((a, b) =>
      b.economicScore - a.economicScore
      || a.monthlyInferenceCostUsd - b.monthlyInferenceCostUsd
      || a.provider.localeCompare(b.provider)
      || a.model.localeCompare(b.model)
    )[0];

  if (!selected) {
    throw new Error("COMPUTE_NO_ELIGIBLE_CANDIDATE");
  }

  return {
    decision: "ROUTE",
    selected,
    evaluated,
    certificate: buildCertificate(input.workload.workloadId, selected, input.generatedAt),
    generatedAt: input.generatedAt
  };
}

export function verifyAiEconomicsCertificate(
  certificate: AiEconomicsCertificate
): { valid: true; sha256: string } {
  if (certificate.schemaVersion !== "1.0.0") {
    throw new Error("AI_ECONOMICS_CERTIFICATE_SCHEMA_UNSUPPORTED");
  }

  requiredString(certificate.workloadId, "certificate.workloadId");
  requiredString(certificate.provider, "certificate.provider");
  requiredString(certificate.model, "certificate.model");
  requiredString(certificate.accelerator, "certificate.accelerator");
  requiredString(certificate.region, "certificate.region");
  requiredString(certificate.generatedAt, "certificate.generatedAt");

  const expected = certificateDigest(withoutCertificateHash(certificate));
  if (!/^[a-f0-9]{64}$/.test(certificate.sha256) || certificate.sha256 !== expected) {
    throw new Error("AI_ECONOMICS_CERTIFICATE_SHA_MISMATCH: certificate is tampered or malformed");
  }

  return { valid: true, sha256: certificate.sha256 };
}
