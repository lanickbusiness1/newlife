import { describe, expect, test } from "vitest";
import {
  compileComputeEconomicsPlan,
  verifyAiEconomicsCertificate
} from "../src/computeEconomics";

const baseInput = {
  workload: {
    workloadId: "WL-AGENT-001",
    dataClassification: "confidential" as const,
    inputTokensPerRequest: 12000,
    outputTokensPerRequest: 3000,
    requestsPerMonth: 10000,
    revenuePerMonthUsd: 15000,
    minQualityScore: 0.8,
    maxTtftMs: 900,
    maxInterTokenLatencyMs: 80
  },
  candidates: [
    {
      provider: "provider-a",
      model: "model-a",
      accelerator: "gpu-a",
      region: "africa-west",
      inputUsdPerMillionTokens: 1,
      outputUsdPerMillionTokens: 4,
      ttftMs: 500,
      interTokenLatencyMs: 40,
      throughputTokensPerSecond: 120,
      qualityScore: 0.86,
      sovereigntyScore: 88,
      lockInScore: 30,
      energyWhPerThousandTokens: 0.8,
      slaPercent: 99.95
    },
    {
      provider: "provider-b",
      model: "model-b",
      accelerator: "gpu-b",
      region: "eu-west",
      inputUsdPerMillionTokens: 2.2,
      outputUsdPerMillionTokens: 7,
      ttftMs: 700,
      interTokenLatencyMs: 55,
      throughputTokensPerSecond: 95,
      qualityScore: 0.9,
      sovereigntyScore: 72,
      lockInScore: 55,
      energyWhPerThousandTokens: 1.4,
      slaPercent: 99.9
    }
  ],
  generatedAt: "2026-08-24T11:15:00Z"
};

describe("Compute & Inference Economics Control Layer", () => {
  test("routes a confidential workload to the highest eligible economic score", () => {
    const plan = compileComputeEconomicsPlan(baseInput);
    expect(plan.selected.provider).toBe("provider-a");
    expect(plan.selected.monthlyInferenceCostUsd).toBeGreaterThan(0);
    expect(plan.selected.tokensPerUsd).toBeGreaterThan(0);
    expect(plan.selected.tokensPerWattHour).toBeGreaterThan(0);
    expect(plan.selected.marginUsd).toBeGreaterThan(0);
  });

  test("fails closed when restricted data has no sufficiently sovereign candidate", () => {
    expect(() => compileComputeEconomicsPlan({
      ...baseInput,
      workload: { ...baseInput.workload, dataClassification: "restricted" as const },
      candidates: baseInput.candidates.map(candidate => ({ ...candidate, sovereigntyScore: 80 }))
    })).toThrow(/eligible|sovereign/i);
  });

  test("fails closed when restricted data is routed outside an explicit allowed region", () => {
    expect(() => compileComputeEconomicsPlan({
      ...baseInput,
      workload: {
        ...baseInput.workload,
        dataClassification: "restricted" as const,
        allowedRegions: ["africa-west"]
      },
      candidates: [{
        ...baseInput.candidates[1],
        region: "eu-west",
        sovereigntyScore: 95
      }]
    })).toThrow(/eligible|region|localization|sovereign/i);
  });

  test("rejects an empty-token workload instead of emitting NaN energy economics", () => {
    expect(() => compileComputeEconomicsPlan({
      ...baseInput,
      workload: {
        ...baseInput.workload,
        inputTokensPerRequest: 0,
        outputTokensPerRequest: 0
      }
    })).toThrow(/token/i);
  });

  test("rejects an unknown data classification received from runtime JSON", () => {
    expect(() => compileComputeEconomicsPlan({
      ...baseInput,
      workload: {
        ...baseInput.workload,
        dataClassification: "secret-x" as any
      }
    } as any)).toThrow(/classification/i);
  });

  test("emits a tamper-evident AI Economics Certificate", () => {
    const plan = compileComputeEconomicsPlan(baseInput);
    expect(plan.certificate.schemaVersion).toBe("1.0.0");
    expect(plan.certificate.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyAiEconomicsCertificate(plan.certificate).valid).toBe(true);

    expect(() => verifyAiEconomicsCertificate({
      ...plan.certificate,
      monthlyInferenceCostUsd: plan.certificate.monthlyInferenceCostUsd + 1
    })).toThrow(/sha|tamper/i);
  });
});
