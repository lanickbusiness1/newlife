# GENESIS V4 ChatGPT Native Control Plane — Design

**Date:** 2026-08-19  
**Status:** CEO approved  
**Decision:** Extend GENESIS V4; do not create GENESIS V5 or a parallel framework.

## Goal

Make ChatGPT Plus an executive cognitive/control surface over the existing GENESIS V4 runtime while preserving GENOME, R.E.M.E, World Model, ECES, AMAR, DeployBot and release governance as the authorities of record.

## Authority order

1. GENOME — canonical operating rules.
2. R.E.M.E — evidence-backed institutional memory.
3. World Model — dynamic operational state.
4. Project context — bounded working context.
5. ChatGPT Memory — non-canonical convenience cache.

## Extensions

### Context Compiler

Compiles a minimum context packet from canonical sources, current world state, constraints, permissions, controls and terminal/commercial goals.

### Control Protocol

Transforms a meaningful executive interaction into a governed state-transition contract.

Input: WHO, STATE, GOAL, WHY, CONTEXT, TOOLS, LIMITS, EVIDENCE, GATE.  
Output: DECISION, ACTION, EVIDENCE, STATE_CHANGE, RISK, COST, VALUE, NEXT_GATE, REME_UPDATE.

### Promotion Pipeline

Treats chat/project/research output as candidate knowledge until target-specific gates pass:

- Project context: working context only.
- World Model: evidence + sufficient confidence.
- R.E.M.E: evidence + M6 + evaluated outcome.
- GENOME: evidence + M8 + explicit CEO validation.

## Runtime integration

Extend `services/mcp-server` with deterministic functions and three least-privilege MCP tools:

- `genesis.context.compile` → `context:compile`
- `genesis.control.compile_transition` → `control:compile`
- `genesis.knowledge.evaluate_promotion` → `knowledge:promote`

## Non-regression

- No framework duplication.
- ChatGPT Memory can never bypass canonical gates.
- Fail closed on incomplete control contracts.
- Preserve RequestContext authorization, audit IDs and restricted-data approval context.
- A4/irreversible actions remain human-controlled.
- External persistence and provider actions remain explicit integrations, never implied by deterministic compilation alone.
