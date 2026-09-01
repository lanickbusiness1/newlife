import { describe, expect, test } from "vitest";
import {
  evaluateCollectiveMarketPowerGate,
  GENESIS_V4_COLLECTIVE_MARKET_POWER_GATE_ANCHOR
} from "../src/collectiveMarketPowerGate.js";

describe("Collective Market Power Gate", () => {
  test("prefers a coalition when it beats an isolated build on distribution, economics and sovereignty", () => {
    const result = evaluateCollectiveMarketPowerGate({
      capabilityId: "PAY-CM-001",
      standaloneRevenue: 1_000_000,
      options: [
        {
          id: "build-core-only",
          mode: "BUILD",
          distribution: 35,
          regulatoryAccess: 55,
          interoperability: 70,
          economics: 58,
          sovereignty: 95,
          resilience: 70,
          multiCountry: 35,
          timeToMarket: 30,
          reversibility: 90,
          concentrationRisk: 10,
          lawfulAccess: true,
          dataControl: 95,
          projectedRevenue: 1_000_000,
          reach: { users: 100_000, merchants: 5_000, rails: 2, countries: 1 }
        },
        {
          id: "cemac-coalition",
          mode: "COALITION",
          distribution: 95,
          regulatoryAccess: 85,
          interoperability: 92,
          economics: 82,
          sovereignty: 80,
          resilience: 82,
          multiCountry: 90,
          timeToMarket: 88,
          reversibility: 72,
          concentrationRisk: 35,
          lawfulAccess: true,
          dataControl: 80,
          projectedRevenue: 2_400_000,
          evidenceRefs: ["evidence://gimac-public-rail", "evidence://telco-access-due-diligence"],
          reach: { users: 20_000_000, merchants: 250_000, rails: 6, countries: 6 }
        }
      ]
    });

    expect(result.decision).toBe("GO_COALITION");
    expect(result.recommendedOptionId).toBe("cemac-coalition");
    expect(result.collectiveDistributionPower).toBe(20_250_012);
    expect(result.coalitionRevenueMultiplier).toBe(2.4);
    expect(result.rankings[0]?.mode).toBe("COALITION");
  });

  test("fails closed on unlawful or strategically unsafe partner structures", () => {
    const result = evaluateCollectiveMarketPowerGate({
      capabilityId: "PAY-CM-002",
      standaloneRevenue: 900_000,
      options: [
        {
          id: "dominant-partner",
          mode: "JV",
          distribution: 100,
          regulatoryAccess: 95,
          interoperability: 90,
          economics: 92,
          sovereignty: 45,
          resilience: 90,
          multiCountry: 90,
          timeToMarket: 90,
          reversibility: 20,
          concentrationRisk: 95,
          lawfulAccess: true,
          dataControl: 30,
          projectedRevenue: 3_000_000,
          reach: { users: 25_000_000, merchants: 300_000, rails: 5, countries: 6 }
        },
        {
          id: "unlicensed-route",
          mode: "INTEGRATE",
          distribution: 90,
          regulatoryAccess: 10,
          interoperability: 95,
          economics: 95,
          sovereignty: 80,
          resilience: 75,
          multiCountry: 80,
          timeToMarket: 95,
          reversibility: 70,
          concentrationRisk: 20,
          lawfulAccess: false,
          dataControl: 80,
          projectedRevenue: 2_800_000,
          reach: { users: 18_000_000, merchants: 200_000, rails: 4, countries: 5 }
        }
      ]
    });

    expect(result.decision).toBe("HOLD");
    expect(result.recommendedOptionId).toBeNull();
    expect(result.rankings.every(option => option.eligible === false)).toBe(true);
    expect(result.blockers).toContain("NO_ELIGIBLE_OPTION");
  });

  test("does not recommend an unproven external coalition even when its commercial score is higher", () => {
    const result = evaluateCollectiveMarketPowerGate({
      capabilityId: "PAY-CM-003",
      standaloneRevenue: 700_000,
      options: [
        {
          id: "verified-internal-build",
          mode: "BUILD",
          distribution: 60,
          regulatoryAccess: 65,
          interoperability: 75,
          economics: 68,
          sovereignty: 95,
          resilience: 82,
          multiCountry: 40,
          timeToMarket: 55,
          reversibility: 95,
          concentrationRisk: 5,
          lawfulAccess: true,
          dataControl: 100,
          projectedRevenue: 700_000,
          reach: { users: 200_000, merchants: 10_000, rails: 2, countries: 1 }
        },
        {
          id: "unproven-super-coalition",
          mode: "COALITION",
          distribution: 100,
          regulatoryAccess: 100,
          interoperability: 100,
          economics: 100,
          sovereignty: 90,
          resilience: 95,
          multiCountry: 100,
          timeToMarket: 100,
          reversibility: 80,
          concentrationRisk: 20,
          lawfulAccess: true,
          dataControl: 85,
          projectedRevenue: 5_000_000,
          reach: { users: 50_000_000, merchants: 500_000, rails: 8, countries: 12 }
        }
      ]
    });

    expect(result.decision).toBe("BUILD_CORE");
    expect(result.recommendedOptionId).toBe("verified-internal-build");
    expect(result.rankings.find(option => option.id === "unproven-super-coalition")?.blockers)
      .toContain("UNVERIFIED_PARTNER_EVIDENCE");
  });

  test("fails closed instead of throwing when the runtime payload is malformed", () => {
    const result = evaluateCollectiveMarketPowerGate(null as any);

    expect(result.decision).toBe("HOLD");
    expect(result.recommendedOptionId).toBeNull();
    expect(result.blockers).toContain("INVALID_INPUT");
  });

  test("exposes the canonical GENESIS V4 decision identity", () => {
    expect(GENESIS_V4_COLLECTIVE_MARKET_POWER_GATE_ANCHOR.decisionId).toBe("V4-DEC-023");
    expect(GENESIS_V4_COLLECTIVE_MARKET_POWER_GATE_ANCHOR.assetId).toBe("GEN-V4-COLLECTIVE-MARKET-POWER-GATE-001");
  });
});
