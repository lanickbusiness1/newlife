export const GENESIS_V4_WORLD_MODEL_RUNTIME_ANCHOR = {
  genome: "GENESIS_V4",
  doctrine: "Enterprise World Model → Governed Runtime Proof",
  canonicalSql: [
    "065_enterprise_object_model.sql",
    "070_runtime.sql",
    "071_v4_object_runtime_bridge.sql",
    "072_world_model.sql",
    "074_loop_engineering.sql",
    "076_self_improvement.sql"
  ],
  proofMode: "deterministic_sandbox"
} as const;

export type WorldModelLayer =
  | "internal_state"
  | "external_environment"
  | "causal"
  | "temporal"
  | "counterfactual"
  | "simulation";

export interface WorldObservation {
  id: string;
  entityKey: string;
  layer: WorldModelLayer;
  metric: string;
  value: string | number | boolean;
  confidence: number;
  observedAt: string;
  sourceRef: string;
  evidenceRef: string;
}

export interface WorldStateFact {
  observationId: string;
  entityKey: string;
  layer: WorldModelLayer;
  metric: string;
  value: WorldObservation["value"];
  confidence: number;
  sourceRef: string;
  evidenceRef: string;
}

export interface WorldState {
  version: string;
  asOf: string;
  facts: WorldStateFact[];
  confidence: number;
  evidenceRefs: string[];
}

export interface StrategyScenario {
  id: string;
  label: string;
  channel: string;
  expectedConversion: number;
  expectedRevenue: number;
  cost: number;
  risk: number;
  confidence: number;
  reversibility: boolean;
  constraints: string[];
  evidenceRefs: string[];
}

export interface SimulationResult {
  scenarioId: string;
  label: string;
  channel: string;
  expectedConversion: number;
  expectedRevenue: number;
  cost: number;
  risk: number;
  confidence: number;
  reversibility: boolean;
  utility: number;
  rank: number;
  assumptions: string[];
  evidenceRefs: string[];
}

export type SandboxActionKind =
  | "crm.lead.upsert_sandbox"
  | "crm.task.create_sandbox"
  | "crm.opportunity.move_sandbox"
  | "noop";

export interface ReversibleActionContract {
  actionId: string;
  kind: SandboxActionKind;
  idempotencyKey: string;
  riskClass: "low" | "moderate";
  approvalClass: "A1" | "A2";
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  rollback: {
    kind: "restore_before_state";
    payload: Record<string, unknown>;
  };
  evidenceRefs: string[];
}

export interface WorldDecision {
  selectedScenarioId: string;
  explanation: string;
  confidence: number;
  alternatives: Array<{ scenarioId: string; rank: number; utility: number }>;
  worldModelConsulted: true;
  requiresHumanApproval: boolean;
  forecast: {
    metric: "conversion_rate";
    value: number;
  };
  action: ReversibleActionContract;
}

export interface ActualOutcome {
  metric: "conversion_rate";
  actualValue: number;
  observedAt: string;
  evidenceRef: string;
}

export interface OutcomeEvaluation {
  forecastMetric: "conversion_rate";
  forecastValue: number;
  actualValue: number;
  absoluteError: number;
  relativeError: number | null;
  directionCorrect: boolean;
  qualityStatus: "within_tolerance" | "outside_tolerance";
  evidenceRefs: string[];
  learning: string;
  improvementCandidate: {
    status: "candidate_only";
    type: "scenario_calibration";
    scenarioId: string;
    proposedAdjustment: string;
    requiresGateReview: true;
  };
}

function requiredText(value: string, field: string) {
  if (!value.trim()) throw new Error(`WORLD_MODEL_INVALID_${field.toUpperCase()}`);
}

function assertUnitInterval(value: number, code: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(code);
  }
}

function assertNonNegative(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`WORLD_MODEL_INVALID_${field.toUpperCase()}`);
  }
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function round(value: number, precision = 6) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function reconstructWorldState(observations: WorldObservation[]): WorldState {
  if (!Array.isArray(observations) || observations.length === 0) {
    throw new Error("WORLD_MODEL_OBSERVATIONS_REQUIRED");
  }

  const facts = observations.map(observation => {
    requiredText(observation.id, "observation_id");
    requiredText(observation.entityKey, "entity_key");
    requiredText(observation.metric, "metric");
    requiredText(observation.sourceRef, "source_ref");
    requiredText(observation.evidenceRef, "evidence_ref");
    requiredText(observation.observedAt, "observed_at");
    assertUnitInterval(observation.confidence, "WORLD_MODEL_INVALID_CONFIDENCE");

    return {
      observationId: observation.id,
      entityKey: observation.entityKey,
      layer: observation.layer,
      metric: observation.metric,
      value: observation.value,
      confidence: observation.confidence,
      sourceRef: observation.sourceRef,
      evidenceRef: observation.evidenceRef
    } satisfies WorldStateFact;
  });

  const timestamps = observations.map(item => Date.parse(item.observedAt));
  if (timestamps.some(value => Number.isNaN(value))) {
    throw new Error("WORLD_MODEL_INVALID_OBSERVED_AT");
  }

  const meanConfidence = facts.reduce((sum, fact) => sum + fact.confidence, 0) / facts.length;
  const asOf = new Date(Math.max(...timestamps)).toISOString();

  return {
    version: `wm-proof:${observations.map(item => item.id).sort().join("+")}`,
    asOf,
    facts,
    confidence: round(meanConfidence),
    evidenceRefs: unique(facts.map(fact => fact.evidenceRef))
  };
}

export function simulateScenarios(state: WorldState, scenarios: StrategyScenario[]): SimulationResult[] {
  if (!state.facts.length || !state.evidenceRefs.length) {
    throw new Error("WORLD_MODEL_STATE_EVIDENCE_REQUIRED");
  }
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    throw new Error("WORLD_MODEL_SCENARIOS_REQUIRED");
  }

  const raw = scenarios.map(scenario => {
    requiredText(scenario.id, "scenario_id");
    requiredText(scenario.label, "scenario_label");
    requiredText(scenario.channel, "scenario_channel");
    assertUnitInterval(scenario.expectedConversion, "WORLD_MODEL_INVALID_EXPECTED_CONVERSION");
    assertUnitInterval(scenario.risk, "WORLD_MODEL_INVALID_RISK");
    assertUnitInterval(scenario.confidence, "WORLD_MODEL_INVALID_SCENARIO_CONFIDENCE");
    assertNonNegative(scenario.expectedRevenue, "expected_revenue");
    assertNonNegative(scenario.cost, "cost");
    if (!scenario.evidenceRefs.length || scenario.evidenceRefs.some(ref => !ref.trim())) {
      throw new Error("WORLD_MODEL_SCENARIO_EVIDENCE_REQUIRED");
    }

    const riskPenalty = scenario.risk * 1000;
    const utility = scenario.confidence * scenario.expectedRevenue * scenario.expectedConversion
      - scenario.cost
      - riskPenalty;

    return {
      scenarioId: scenario.id,
      label: scenario.label,
      channel: scenario.channel,
      expectedConversion: scenario.expectedConversion,
      expectedRevenue: scenario.expectedRevenue,
      cost: scenario.cost,
      risk: scenario.risk,
      confidence: scenario.confidence,
      reversibility: scenario.reversibility,
      utility: round(utility),
      rank: 0,
      assumptions: [
        "All conversion, revenue, cost, risk and confidence values are explicit caller-provided inputs.",
        "P0 utility uses riskPenalty = risk × 1000; no missing metric is imputed."
      ],
      evidenceRefs: unique([...state.evidenceRefs, ...scenario.evidenceRefs])
    } satisfies SimulationResult;
  });

  return raw
    .sort((a, b) => b.utility - a.utility || a.scenarioId.localeCompare(b.scenarioId))
    .map((result, index) => ({ ...result, rank: index + 1 }));
}

function actionKindForChannel(channel: string): SandboxActionKind {
  if (channel === "partner" || channel === "linkedin") return "crm.lead.upsert_sandbox";
  if (channel === "email") return "crm.task.create_sandbox";
  return "noop";
}

export function decideNextAction(state: WorldState, simulations: SimulationResult[]): WorldDecision {
  if (!state.evidenceRefs.length) throw new Error("WORLD_MODEL_STATE_EVIDENCE_REQUIRED");
  if (!simulations.length) throw new Error("WORLD_MODEL_SIMULATIONS_REQUIRED");

  const selected = simulations.find(simulation => simulation.reversibility);
  if (!selected) {
    throw new Error("WORLD_MODEL_NO_REVERSIBLE_SCENARIO");
  }

  const actionKind = actionKindForChannel(selected.channel);
  const evidenceRefs = unique([...state.evidenceRefs, ...selected.evidenceRefs]);
  const before = { scenarioId: selected.scenarioId, sandboxStatus: "absent" };
  const after = {
    scenarioId: selected.scenarioId,
    sandboxStatus: "planned",
    channel: selected.channel,
    expectedConversion: selected.expectedConversion
  };

  return {
    selectedScenarioId: selected.scenarioId,
    explanation: `${selected.label} is the highest-utility reversible scenario under the explicit P0 inputs.`,
    confidence: round(selected.confidence * state.confidence),
    alternatives: simulations.map(item => ({
      scenarioId: item.scenarioId,
      rank: item.rank,
      utility: item.utility
    })),
    worldModelConsulted: true,
    requiresHumanApproval: false,
    forecast: {
      metric: "conversion_rate",
      value: selected.expectedConversion
    },
    action: {
      actionId: `wm-action:${selected.scenarioId}`,
      kind: actionKind,
      idempotencyKey: `wm-proof:${state.version}:${selected.scenarioId}`,
      riskClass: selected.risk >= 0.25 ? "moderate" : "low",
      approvalClass: "A2",
      before,
      after,
      rollback: {
        kind: "restore_before_state",
        payload: before
      },
      evidenceRefs
    }
  };
}

export function evaluateOutcome(decision: WorldDecision, actual: ActualOutcome): OutcomeEvaluation {
  if (actual.metric !== decision.forecast.metric) {
    throw new Error("WORLD_MODEL_OUTCOME_METRIC_MISMATCH");
  }
  assertUnitInterval(actual.actualValue, "WORLD_MODEL_INVALID_ACTUAL_VALUE");
  requiredText(actual.evidenceRef, "outcome_evidence_ref");
  requiredText(actual.observedAt, "outcome_observed_at");
  if (Number.isNaN(Date.parse(actual.observedAt))) {
    throw new Error("WORLD_MODEL_INVALID_OUTCOME_OBSERVED_AT");
  }

  const forecast = decision.forecast.value;
  const absoluteError = Math.abs(actual.actualValue - forecast);
  const relativeError = forecast === 0 ? null : absoluteError / Math.abs(forecast);
  const withinTolerance = absoluteError <= 0.05;
  const learning = withinTolerance
    ? `Forecast for ${decision.selectedScenarioId} was within the P0 tolerance; retain the scenario prior pending more evidence.`
    : `Forecast for ${decision.selectedScenarioId} deviated by ${round(absoluteError, 4)}; recalibration should be tested before promotion.`;

  return {
    forecastMetric: decision.forecast.metric,
    forecastValue: forecast,
    actualValue: actual.actualValue,
    absoluteError: round(absoluteError),
    relativeError: relativeError === null ? null : round(relativeError),
    directionCorrect: actual.actualValue > 0 === forecast > 0,
    qualityStatus: withinTolerance ? "within_tolerance" : "outside_tolerance",
    evidenceRefs: unique([...decision.action.evidenceRefs, actual.evidenceRef]),
    learning,
    improvementCandidate: {
      status: "candidate_only",
      type: "scenario_calibration",
      scenarioId: decision.selectedScenarioId,
      proposedAdjustment: withinTolerance
        ? "Collect additional observed outcomes before changing the scenario prior."
        : "Re-estimate conversion confidence from additional evidenced outcomes in sandbox/shadow mode.",
      requiresGateReview: true
    }
  };
}
