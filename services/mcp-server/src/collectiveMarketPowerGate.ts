import { z } from "zod";

export const GENESIS_V4_COLLECTIVE_MARKET_POWER_GATE_ANCHOR = {
  decisionId: "V4-DEC-023",
  assetId: "GEN-V4-COLLECTIVE-MARKET-POWER-GATE-001",
  name: "Collective Market Power Gate™",
  version: "0.1.0"
} as const;

export type MarketPowerMode =
  | "BUILD"
  | "BUY"
  | "INTEGRATE"
  | "LICENSE"
  | "JV"
  | "COALITION";

export type DistributionReach = {
  users: number;
  merchants: number;
  rails: number;
  countries: number;
};

export type MarketPowerOption = {
  id: string;
  mode: MarketPowerMode;
  distribution: number;
  regulatoryAccess: number;
  interoperability: number;
  economics: number;
  sovereignty: number;
  resilience: number;
  multiCountry: number;
  timeToMarket: number;
  reversibility: number;
  concentrationRisk: number;
  lawfulAccess: boolean;
  dataControl: number;
  projectedRevenue: number;
  reach: DistributionReach;
};

export type CollectiveMarketPowerInput = {
  capabilityId: string;
  standaloneRevenue: number;
  options: MarketPowerOption[];
};

export type RankedMarketPowerOption = MarketPowerOption & {
  score: number;
  eligible: boolean;
  blockers: string[];
};

export type CollectiveMarketPowerDecision = {
  capabilityId: string;
  decision: "GO_COALITION" | "GO_PARTNER" | "BUILD_CORE" | "HOLD";
  recommendedOptionId: string | null;
  collectiveDistributionPower: number;
  coalitionRevenueMultiplier: number;
  rankings: RankedMarketPowerOption[];
  blockers: string[];
  anchor: typeof GENESIS_V4_COLLECTIVE_MARKET_POWER_GATE_ANCHOR;
};

const MarketPowerModeSchema = z.enum(["BUILD", "BUY", "INTEGRATE", "LICENSE", "JV", "COALITION"]);

const DistributionReachSchema = z.object({
  users: z.number().finite().nonnegative(),
  merchants: z.number().finite().nonnegative(),
  rails: z.number().finite().nonnegative(),
  countries: z.number().finite().nonnegative()
});

const MarketPowerOptionSchema = z.object({
  id: z.string().min(1),
  mode: MarketPowerModeSchema,
  distribution: z.number().finite(),
  regulatoryAccess: z.number().finite(),
  interoperability: z.number().finite(),
  economics: z.number().finite(),
  sovereignty: z.number().finite(),
  resilience: z.number().finite(),
  multiCountry: z.number().finite(),
  timeToMarket: z.number().finite(),
  reversibility: z.number().finite(),
  concentrationRisk: z.number().finite(),
  lawfulAccess: z.boolean(),
  dataControl: z.number().finite(),
  projectedRevenue: z.number().finite(),
  reach: DistributionReachSchema
});

export const CollectiveMarketPowerInputSchema = z.object({
  capabilityId: z.string().min(1),
  standaloneRevenue: z.number().finite().nonnegative(),
  options: z.array(MarketPowerOptionSchema)
});

const WEIGHTS = {
  distribution: 0.2,
  regulatoryAccess: 0.15,
  interoperability: 0.15,
  economics: 0.15,
  sovereignty: 0.1,
  resilience: 0.1,
  multiCountry: 0.05,
  timeToMarket: 0.05,
  reversibility: 0.05
} as const;

function bounded(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function scoreOption(option: MarketPowerOption): number {
  return round(
    bounded(option.distribution) * WEIGHTS.distribution +
      bounded(option.regulatoryAccess) * WEIGHTS.regulatoryAccess +
      bounded(option.interoperability) * WEIGHTS.interoperability +
      bounded(option.economics) * WEIGHTS.economics +
      bounded(option.sovereignty) * WEIGHTS.sovereignty +
      bounded(option.resilience) * WEIGHTS.resilience +
      bounded(option.multiCountry) * WEIGHTS.multiCountry +
      bounded(option.timeToMarket) * WEIGHTS.timeToMarket +
      bounded(option.reversibility) * WEIGHTS.reversibility
  );
}

function optionBlockers(option: MarketPowerOption): string[] {
  const blockers: string[] = [];

  if (!option.lawfulAccess) blockers.push("NO_LAWFUL_ACCESS");
  if (bounded(option.concentrationRisk) >= 80) blockers.push("CRITICAL_PARTNER_CONCENTRATION");
  if (bounded(option.dataControl) < 40) blockers.push("INSUFFICIENT_DATA_CONTROL");
  if (option.projectedRevenue < 0) blockers.push("NEGATIVE_PROJECTED_REVENUE");

  return blockers;
}

function distributionPower(reach: DistributionReach): number {
  return [reach.users, reach.merchants, reach.rails, reach.countries]
    .map(value => Math.max(0, value))
    .reduce((total, value) => total + value, 0);
}

function decisionForMode(mode: MarketPowerMode): CollectiveMarketPowerDecision["decision"] {
  if (mode === "BUILD") return "BUILD_CORE";
  if (mode === "COALITION" || mode === "JV") return "GO_COALITION";
  return "GO_PARTNER";
}

function invalidDecision(input: unknown): CollectiveMarketPowerDecision {
  const capabilityId = typeof input === "object" && input !== null && "capabilityId" in input && typeof (input as any).capabilityId === "string"
    ? (input as any).capabilityId
    : "unknown";

  return {
    capabilityId,
    decision: "HOLD",
    recommendedOptionId: null,
    collectiveDistributionPower: 0,
    coalitionRevenueMultiplier: 0,
    rankings: [],
    blockers: ["INVALID_INPUT"],
    anchor: GENESIS_V4_COLLECTIVE_MARKET_POWER_GATE_ANCHOR
  };
}

export function evaluateCollectiveMarketPowerGate(
  input: unknown
): CollectiveMarketPowerDecision {
  const parsed = CollectiveMarketPowerInputSchema.safeParse(input);
  if (!parsed.success) return invalidDecision(input);

  const data: CollectiveMarketPowerInput = parsed.data;
  const rankings = data.options
    .map(option => {
      const blockers = optionBlockers(option);
      return {
        ...option,
        score: scoreOption(option),
        eligible: blockers.length === 0,
        blockers
      } satisfies RankedMarketPowerOption;
    })
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      return b.score - a.score;
    });

  const winner = rankings.find(option => option.eligible && option.score >= 50);

  if (!winner) {
    return {
      capabilityId: data.capabilityId,
      decision: "HOLD",
      recommendedOptionId: null,
      collectiveDistributionPower: 0,
      coalitionRevenueMultiplier: 0,
      rankings,
      blockers: ["NO_ELIGIBLE_OPTION"],
      anchor: GENESIS_V4_COLLECTIVE_MARKET_POWER_GATE_ANCHOR
    };
  }

  const multiplier = data.standaloneRevenue > 0
    ? round(Math.max(0, winner.projectedRevenue) / data.standaloneRevenue)
    : 0;

  return {
    capabilityId: data.capabilityId,
    decision: decisionForMode(winner.mode),
    recommendedOptionId: winner.id,
    collectiveDistributionPower: distributionPower(winner.reach),
    coalitionRevenueMultiplier: multiplier,
    rankings,
    blockers: [],
    anchor: GENESIS_V4_COLLECTIVE_MARKET_POWER_GATE_ANCHOR
  };
}
