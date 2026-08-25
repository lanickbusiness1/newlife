# Genesis Continuous Execution Orchestrator™ — Design Specification

**Canonical asset:** `GEN-V4-EXEC-ORCH-001`  
**Parent:** Genesis Release-to-Revenue Control Plane™  
**Genome:** GENESIS V4  
**Decision date:** 2026-08-25  
**Status:** DESIGN APPROVED / SPECIFICATION  
**Scope:** continuous governed execution from validated intention to revenue, delivery, measured outcome and R.E.M.E™ learning.

## 1. Problem

GENESIS V4 already contains deterministic decision and control components, including Revenue Engine, Validation Relay, World Model Runtime and ChatGPT Native Control Plane. The missing layer is a durable execution loop that converts a textual or computed `nextAction` into an executable action, obtains a receipt, persists the checkpoint, recompiles state and continues without manual state reinjection.

Current anti-pattern:

`compile → nextAction text → human/tool gap → manual continuation`

Target invariant:

`INTENTION → STATE → ACTION CONTRACT → EXECUTION → RECEIPT → CHECKPOINT → RECOMPILE → NEXT ACTION → ... → CASH → DELIVERY → OUTCOME → R.E.M.E → SCALE/CORRECT/KILL`

GENESIS must stop only at a verified terminal state, an explicit A4 human requirement, an external authorization requirement, or a terminal technical failure for which no safe bounded action remains.

## 2. Product decision

Create **Genesis Continuous Execution Orchestrator™** as a transverse internal runtime capability of the Genesis Release-to-Revenue Control Plane™. It is not a standalone commercial product.

The orchestrator owns sequencing and continuity. Existing domain engines retain their authority:

- Revenue Engine decides commercial stage/readiness;
- Validation Relay decides build/deploy delivery state;
- World Model evaluates observed state, scenarios and outcomes;
- R.E.M.E™ receives evidence-backed learning;
- external adapters perform concrete side effects.

The orchestrator MUST NOT duplicate those engines' domain logic.

## 3. Architectural approach

Use a **native orchestration kernel inside `services/mcp-server`** with stable adapter interfaces.

Do not make Temporal, n8n, queues or an external workflow engine a mandatory dependency for P0. The orchestration contract must permit such engines later without changing business state contracts.

Core components:

1. `Execution State Machine`
2. `Next Action Resolver`
3. `Executable Action Contract`
4. `Action Executor Registry`
5. `Receipt Ledger`
6. `Checkpoint Store`
7. `Resume/Retry Controller`
8. `Loop Guard`
9. `R.E.M.E Feedback Bridge`
10. MCP runtime tools for compile/start/step/resume/inspect.

## 4. Canonical execution states

```text
INTENTION_ACCEPTED
CONTEXT_COMPILED
SOURCE_PROVEN
BUILDING
BUILD_VERIFIED
READY_TO_DEPLOY
DEPLOYING
DEPLOYED
SELLABLE
PROSPECTING
LEAD_QUALIFIED
PROPOSAL_SENT
PAYMENT_PENDING
CASH_COLLECTED
DELIVERING
DELIVERED
OUTCOME_PENDING
OUTCOME_MEASURED
REME_LEARNING_PENDING
REME_LEARNED
SCALE
CORRECT
KILL
REVENUE_LEARNING_COMPLETE
HUMAN_ACTION_REQUIRED
EXTERNAL_AUTH_REQUIRED
TERMINAL_TECHNICAL_FAILURE
```

Not every run must traverse every state. The resolver selects the next valid transition from evidence.

`REVENUE_LEARNING_COMPLETE` means that first cash was collected, delivery was evidenced, an outcome was measured, a R.E.M.E learning receipt was recorded and a `SCALE | CORRECT | KILL` decision exists.

## 5. ExecutableActionContract

A `nextAction` may no longer be only prose. Every runnable transition must resolve to a versioned action contract.

```ts
interface ExecutableActionContract {
  actionId: string;
  runId: string;
  assetId: string;
  kind: string;
  adapter: string;
  input: Record<string, unknown>;
  idempotencyKey: string;
  autonomyLevel: "A1" | "A2" | "A3" | "A4";
  riskClass: "low" | "moderate" | "high" | "regulated";
  requiredScopes: string[];
  expectedReceiptKinds: string[];
  maxAttempts: number;
  timeoutMs?: number;
  rollback?: {
    supported: boolean;
    actionKind?: string;
    input?: Record<string, unknown>;
  };
  evidenceRefs: string[];
}
```

Rules:

- `A1-A3`: continue automatically when permissions, budget and risk contract allow it.
- `A4`: stop in `HUMAN_ACTION_REQUIRED` with a concrete reason and resumable checkpoint.
- Missing external credentials/authorization: `EXTERNAL_AUTH_REQUIRED`, not a fictional technical blocker.
- Every action uses an idempotency key.

## 6. ExecutionReceipt

No action is complete without evidence.

```ts
interface ExecutionReceipt {
  receiptId: string;
  runId: string;
  actionId: string;
  kind: string;
  status: "SUCCEEDED" | "FAILED" | "PARTIAL" | "REQUIRES_HUMAN" | "REQUIRES_EXTERNAL_AUTH";
  startedAt: string;
  completedAt: string;
  externalRef?: string;
  evidenceRefs: string[];
  output: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
```

Examples of receipts:

- GitHub commit/PR/CI run;
- deployed URL + healthcheck;
- CRM lead/opportunity ID;
- outbound-message ID;
- invoice ID;
- payment/collection proof reference;
- delivery proof;
- measured business outcome;
- R.E.M.E learning event ID.

## 7. Durable run/checkpoint contract

```ts
interface ExecutionRun {
  runId: string;
  assetId: string;
  objective: string;
  state: GenesisExecutionState;
  status: "RUNNING" | "WAITING" | "TERMINAL";
  revision: number;
  createdAt: string;
  updatedAt: string;
  currentAction?: ExecutableActionContract;
  receipts: ExecutionReceipt[];
  evidenceRefs: string[];
  attemptCounters: Record<string, number>;
  terminalReason?: string;
}
```

Checkpoint requirements:

- persist before and after each side effect;
- optimistic revision/version control;
- deterministic resume from latest committed revision;
- no silent loss of receipts;
- crash/restart must not duplicate successful side effects;
- all external actions must be replay-safe through idempotency keys or receipt lookup.

P0 code defines a `CheckpointStore` interface and a deterministic in-memory implementation for tests. Production persistence can bind to existing canonical SQL/Supabase runtime tables through an adapter without changing the state machine contract.

## 8. Next Action Resolver

The resolver consumes:

- current `ExecutionRun`;
- Revenue Engine output;
- Validation Relay output;
- World Model state/outcomes where available;
- current receipts/evidence;
- permissions/autonomy/budget/risk context.

It returns exactly one of:

1. `EXECUTE(actionContract)`;
2. `WAIT_HUMAN(reason)`;
3. `WAIT_EXTERNAL_AUTH(reason)`;
4. `TERMINAL_FAILURE(reason)`;
5. `COMPLETE(finalState)`.

No unstructured `nextAction` is allowed as the sole control output.

## 9. Action Executor Registry

```ts
interface ActionExecutor {
  adapterName: string;
  supports(kind: string): boolean;
  execute(action: ExecutableActionContract, context: ExecutionContext): Promise<ExecutionReceipt>;
}
```

P0 registry classes:

- `internal.engine.*` — Revenue Engine / Validation Relay / World Model / R.E.M.E bridge;
- `source.git.*` — source/build/CI receipt adapters;
- `deploy.*` — deployment provider adapters;
- `crm.*` — lead/opportunity/task adapters;
- `outreach.*` — email/WhatsApp/other authorized outreach adapters;
- `billing.*` — invoice/payment-request adapters;
- `payment.*` — collection-observation adapters;
- `delivery.*` — delivery evidence adapters;
- `reme.*` — learning persistence adapters.

Unavailable adapters must yield `REQUIRES_EXTERNAL_AUTH` or a precise failed receipt. They must not fabricate completion.

## 10. Continuous execution loop

Pseudo-contract:

```ts
while (!run.status.terminal) {
  checkpoint(run);
  const decision = resolveNextAction(run, context);

  if (decision is WAIT_HUMAN) return checkpoint(HUMAN_ACTION_REQUIRED);
  if (decision is WAIT_EXTERNAL_AUTH) return checkpoint(EXTERNAL_AUTH_REQUIRED);
  if (decision is TERMINAL_FAILURE) return checkpoint(TERMINAL_TECHNICAL_FAILURE);
  if (decision is COMPLETE) return checkpoint(decision.finalState);

  const action = decision.action;
  checkpoint(run with currentAction = action);
  const receipt = await registry.execute(action);
  checkpoint(applyReceipt(run, receipt));

  if (receipt.failed && retryable) apply bounded retry policy;
  else recompile state and continue;
}
```

The loop must not depend on chat-turn continuity.

## 11. Retry, correction and loop guard

For each action:

- max attempt count is explicit;
- retryable vs non-retryable errors are explicit;
- bounded backoff metadata is supported;
- successful receipt with same idempotency key must be reused, never duplicated;
- after exhausted retry, resolver may choose an alternate safe action if one exists;
- if no safe action exists, transition to `TERMINAL_TECHNICAL_FAILURE` with full evidence.

Default P0 maximum: 3 attempts per action unless a stricter adapter contract applies.

## 12. First Cash policy integration

`V4-DEC-020 — First Cash Commercial Release Policy™` remains authoritative.

M8, S7+, Independent Assurance Council™, Big4-style review and `PRODUCTION_PROVEN` MUST NOT automatically block a bounded paid pilot or first revenue.

They block only when required by:

- external mandate;
- applicable legal/regulatory contract;
- risk class / specific production contract;
- high-impact automated decision safeguards.

The orchestrator therefore carries separate `commercialGate` and `productionGate` decisions.

## 13. Human and external boundaries

The orchestrator must distinguish:

### Human action required
Examples:

- legally consequential approval;
- high-impact employment decision requiring human review;
- explicit CEO A4 veto/approval gate;
- contract signature by an authorized human where delegation is absent.

### External authorization required
Examples:

- missing provider credentials;
- missing domain/DNS control;
- payment provider not connected;
- external account authorization not granted.

Neither condition is treated as a generic `BLOCKED` state.

## 14. R.E.M.E feedback contract

After delivery, the orchestrator must seek an observed outcome and compare it with the forecast using the World Model runtime.

Minimum loop:

`forecast → action → observed outcome → evaluation → learning candidate → learning receipt → new state`.

R.E.M.E promotion must preserve evidence lineage and cannot silently rewrite canonical knowledge from an unverified observation.

`REME_LEARNED` requires a receipt/evidence reference.

## 15. MCP surface

P0 MCP tools:

- `genesis.execution.start`
- `genesis.execution.step`
- `genesis.execution.resume`
- `genesis.execution.inspect`
- `genesis.execution.apply_receipt`
- `genesis.execution.resolve_next_action`

`start` may optionally execute continuously until a terminal/wait state when `autoRun=true` and the caller has the required scope.

Suggested scopes:

- `execution:read`
- `execution:plan`
- `execution:run`
- `execution:receipt`
- provider-specific scopes remain additive.

## 16. Security and safety

Mandatory controls:

- existing RequestContext authorization remains active;
- no privilege escalation through orchestration;
- action contract required scopes are checked before execution;
- restricted data still requires approval context where applicable;
- secrets never enter receipts or public evidence;
- external side effects are idempotent and auditable;
- high-impact decisions remain human-reviewed where required;
- emergency stop can terminate/resume a run without corrupting evidence.

## 17. P0 implementation boundaries

P0 includes:

- deterministic state machine;
- action/receipt contracts;
- resolver;
- executor registry;
- in-memory checkpoint store for test proof;
- restart/resume semantics;
- idempotency and retry guard;
- integration with existing Revenue Engine, Validation Relay and World Model runtime;
- R.E.M.E learning receipt boundary;
- MCP tools;
- comprehensive unit/contract tests and CI proof.

P0 does not falsely claim:

- every external provider is already connected;
- actual cash can be collected without an authorized payment adapter;
- dynamic deployment is available without a deployment adapter/provider;
- production persistence is complete before a concrete persistent store adapter is proven.

These missing external bindings surface as explicit `EXTERNAL_AUTH_REQUIRED` / adapter capability gaps, while the kernel remains executable and resumable.

## 18. Acceptance tests

### A. Continuous execution
Given a fully authorized deterministic adapter set, a run started from a `READY_TO_SELL` product traverses multiple actions without manual state reinjection and terminates in `REVENUE_LEARNING_COMPLETE` after receipts for cash, delivery, measured outcome, R.E.M.E learning and Scale/Correct/Kill.

### B. Resume after interruption
After checkpointing a successful side effect, a new orchestrator instance resumes the run without re-executing that side effect.

### C. Idempotency
Replaying the same action/idempotency key returns/reuses the existing successful receipt and does not create a duplicate external effect.

### D. Human boundary
An A4 action terminates the automatic loop in `HUMAN_ACTION_REQUIRED`, preserving the exact pending action and all prior receipts.

### E. External authorization boundary
A missing provider credential yields `EXTERNAL_AUTH_REQUIRED`; it does not become a generic technical failure and does not fabricate success.

### F. Retry exhaustion
A retryable executor failure retries within the configured bound, then transitions to a safe alternate action or `TERMINAL_TECHNICAL_FAILURE` with evidence.

### G. First Cash policy
A sellable bounded pilot may proceed toward prospecting/payment even when terminal production gates are incomplete, unless the specific risk/external mandate contract requires them.

### H. R.E.M.E learning
A measured outcome produces an evidence-linked learning receipt and a deterministic `SCALE | CORRECT | KILL` decision before `REVENUE_LEARNING_COMPLETE`.

## 19. Non-regression rule

Future GENESIS features must not regress to `nextAction`-as-prose-only orchestration.

Any domain engine that returns a next action intended for autonomous execution must expose enough structured data for the orchestrator to create an `ExecutableActionContract`, or explicitly declare why execution requires a human/external boundary.

## 20. Definition of Done for the layer

The layer is **TEST_PROVEN** when:

1. the contracts compile;
2. RED tests prove the current runtime cannot execute/resume the loop;
3. GREEN tests prove continuous multi-step execution, receipts, checkpoints, idempotency, retries and terminal states;
4. MCP tools expose start/step/resume/inspect/apply-receipt;
5. existing MCP CI is green with no regression;
6. an evidence document records exact commits/runs/tests;
7. Notion/GENOME records `GEN-V4-EXEC-ORCH-001` with the accurate proof level.

It becomes **PRODUCTION_PROVEN** only after at least one real authorized provider path executes end-to-end with persistent storage, real side-effect receipts and observed outcome/R.E.M.E evidence.
