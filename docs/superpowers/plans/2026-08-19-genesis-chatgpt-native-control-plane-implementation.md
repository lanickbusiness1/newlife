# GENESIS V4 ChatGPT Native Control Plane — Implementation Plan

**Goal:** Extend the existing GENESIS V4 MCP control plane with context compilation, governed state-transition compilation and evidence-gated knowledge promotion.

## Task 1 — Deterministic core

- Add `services/mcp-server/src/chatgptControlPlane.ts`.
- Implement `compileGenesisContext`.
- Implement `compileControlTransition` with fail-closed blockers.
- Implement `evaluateKnowledgePromotion` with target-specific gates.

## Task 2 — Tests

- Add `services/mcp-server/tests/chatgptControlPlane.test.ts`.
- Prove authority order and non-canonical ChatGPT Memory.
- Prove READY and BLOCKED transition paths.
- Prove World Model, R.E.M.E and GENOME promotion gates.
- Prove MCP registrations and least-privilege scopes.

## Task 3 — MCP integration

- Register `genesis.context.compile` with `context:compile`.
- Register `genesis.control.compile_transition` with `control:compile`.
- Register `genesis.knowledge.evaluate_promotion` with `knowledge:promote`.
- Expose the control-plane anchor in `/health`.
- Increment control-plane revision only; do not imply external persistence.

## Task 4 — Assurance and release

- Run MCP CI: audit, typecheck, tests and build.
- Review PR diff for accidental duplication or weakened authorization.
- Merge only after green checks.
- Record the resulting commit/PR/CI evidence in R.E.M.E / GENOME delta.
- Treat provider deployment as a separate evidence gate; never claim `DELIVERED_SERVICE` without an accessible healthcheck.
