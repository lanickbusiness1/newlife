# GENESIS V4 World Model Runtime Proof #1 — Design

**Status:** CEO-approved execution baseline — 18 August 2026

**Canonical parent:** GENESIS V4 Enterprise World Model Constitution™

**Pilot:** AfrIA Marketing Team™ Auto-GTM acting on AfrIA Recruit™

## Decision

Extend the existing `services/mcp-server` control plane. Do not create a new product, framework, runtime, or microservice. The proof must reuse the canonical GENESIS V4 model defined by `065_enterprise_object_model.sql`, `070_runtime.sql`, `071_v4_object_runtime_bridge.sql`, `072_world_model.sql`, `074_loop_engineering.sql`, and `076_self_improvement.sql`.

## Goal

Prove that a governed GENESIS runtime can receive evidence-backed observations, reconstruct a state, compare counterfactual GTM scenarios, select a next-best action, emit a reversible action contract, evaluate the observed outcome against the forecast, and produce a learning/improvement candidate without inventing evidence or bypassing human/governance boundaries.

## P0 boundary

This P0 is a deterministic, auditable runtime proof inside the canonical MCP server. It does **not** claim that the full SQL package has already been migrated to staging. Persistence interfaces and evidence IDs must align with canonical SQL concepts, but database promotion remains a separate gate until modules 061/065/070/071/072/074/076 and their dependencies are executed in order on an authorized staging database.

The P0 may execute only reversible sandbox actions. No automatic email, WhatsApp send, payment, legal commitment, production financial action, institutional communication, or irreversible mutation is permitted.

## Canonical flow

`Observation → State Reconstruction → Forecast/Scenario Construction → Counterfactual Simulation → Decision → Governance/Action Contract → Reversible Execution → Outcome → Prediction-vs-Reality Evaluation → Learning → Improvement Candidate`

## Runtime objects

### WorldObservation
- `id`
- `entityKey`
- `layer`: `internal_state | external_environment | causal | temporal | counterfactual | simulation`
- `metric`
- `value`
- `confidence` in `[0,1]`
- `observedAt`
- `sourceRef`
- `evidenceRef`

### WorldState
- `version`
- `asOf`
- `facts`
- `confidence`
- `evidenceRefs`

No state fact may be created without a contributing observation/evidence reference.

### StrategyScenario
- `id`
- `label`
- `channel`
- `expectedConversion`
- `expectedRevenue`
- `cost`
- `risk`
- `reversibility`
- `constraints[]`
- `evidenceRefs[]`

### SimulationResult
- scenario identity
- expected value
- normalized cost/risk penalties
- confidence-adjusted utility
- ranking
- assumptions/evidence

### WorldDecision
- selected scenario
- explanation
- confidence
- alternatives
- `worldModelConsulted=true`
- `requiresHumanApproval`
- reversible action contract

### ReversibleActionContract
P0 actions are limited to `crm.lead.upsert_sandbox`, `crm.task.create_sandbox`, `crm.opportunity.move_sandbox`, or `noop`.

Every action contains `actionId`, `idempotencyKey`, `before`, `after`, `rollback`, `riskClass`, `evidenceRefs`, and `approvalClass`.

### OutcomeEvaluation
- forecast metric/value
- actual metric/value
- absolute error
- relative error when defined
- direction correctness
- quality status
- evidence refs
- learning
- improvement candidate

## Decision policy

The engine ranks scenarios with a deterministic utility:

`utility = confidence × expectedRevenue × expectedConversion - cost - riskPenalty`

All monetary values are input facts. The engine never invents missing revenue, cost, conversion, or confidence numbers. Missing required metrics block ranking rather than being silently imputed.

A scenario with `reversibility=false` is never autonomously selected for execution in P0.

## Governance

- Important decisions must have `worldModelConsulted=true`.
- A4 actions remain human-gated.
- Every external write must have idempotency + rollback metadata.
- Evidence references are mandatory for observations and actual outcomes.
- The engine must surface uncertainty rather than manufacture precision.
- M6: deterministic tests, invariants, error paths, idempotency contract.
- S7+: no secret material, least privilege, restricted action allowlist, no unrestricted external writes.
- M8: selected action must be explainable and tied to measurable business outcome.
- Big4: not required for this moderate-risk sandbox proof; required before sensitive/regulated promotion.

## Pilot fixture

Use a synthetic-but-explicit AfrIA Recruit B2B GTM fixture containing three scenarios: LinkedIn direct, institutional email, and recruiter/partner channel. Inputs must be labeled synthetic test evidence and must never be reported as real market performance.

The fixture exists only to prove the runtime chain. A later live pilot must replace synthetic conversion/revenue inputs with real observed values and separately verified evidence.

## Success criteria

P0 is `TEST_PROVEN` only if CI proves:

1. invalid confidence is rejected;
2. state reconstruction preserves evidence lineage;
3. three scenarios are simulated and ranked deterministically;
4. a non-reversible scenario cannot be autonomously executed;
5. the chosen reversible action has idempotency and rollback data;
6. outcome evaluation computes prediction error from explicit actual evidence;
7. a learning/improvement candidate is emitted without self-promoting to production;
8. the MCP exposes the proof capabilities under governed scopes;
9. existing Revenue Engine and Validation Relay tests remain green;
10. typecheck, audit and production build remain green.

## Terminal states

- `TEST_PROVEN`: code + CI + synthetic runtime evidence verified.
- `STAGING_PROVEN`: canonical SQL package migrated and proof persisted on authorized staging.
- `PRODUCTION_PROVEN`: live endpoint/version/health/rollback observed plus real bounded pilot evidence.

No later state may be claimed from configuration alone.