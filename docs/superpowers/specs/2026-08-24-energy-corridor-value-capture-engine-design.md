# Energy Corridor & Resource Value Capture Engine™ — Design

**Decision:** V4-DEC-017 — Sovereign Corridor & Resource Value Capture Doctrine™

**Status:** VALIDATED — implementation tranche 1

## Purpose

Implement V4-DEC-017 as a deterministic GENESIS V4 runtime capability inside the existing MCP server. The engine converts an explicitly sourced corridor assessment into sovereign value-capture metrics, a governed GO/HOLD/NO-GO recommendation, AfrIAgenesis intervention opportunities, evidence lineage and R.E.M.E-ready events.

This is not a new catalogue product. It is a specialized engine attached to Sovereign Industrialization & Resource Value Capture OS™ and Port & Corridor Sovereignty Intelligence™ / ASCISS™.

## P0 demonstrator

Tanga–Lamu–EACOP / East Africa.

The implementation must remain country- and corridor-agnostic so later Country Genesis or Sector OS instances can reuse it for ports, pipelines, railways, refineries, terminals, logistics corridors and industrial hubs.

## Runtime boundary

Tranche 1 is deterministic and evidence-first. It does not fetch external data, make irreversible decisions, write to third-party systems or claim live deployment proof. All inputs are caller-provided and must carry evidence references.

The engine is exposed through the existing governed MCP server. Authorization, audit envelope and ECES scope checks remain handled by `src/index.ts`.

## Canonical anchor

`GEN-V4-CORRIDOR-VALUE-CAPTURE-001`

Parent capabilities:

- `Sovereign Industrialization & Resource Value Capture OS™`
- `Port & Corridor Sovereignty Intelligence™ / ASCISS™`
- `GOIR™`
- `ECES™`
- `Revenue Economics Engine™`
- `R.E.M.E™`

## Input model

### Corridor identity

Required:

- `corridorId`
- `corridorName`
- `countries[]`
- `assetClass`: `pipeline | port | refinery | terminal | rail | road | multimodal | energy_hub | industrial_corridor | other`
- `asOf`
- `evidenceRefs[]`

### Economic value

Required:

- `totalEconomicValue`
- `currency`
- `valueComponents[]`

Each value component contains:

- `name`
- `grossValue`
- `localShare` in `[0, 1]`
- `evidenceRef`

The engine computes:

`localRetainedValue = Σ(grossValue × localShare)`

`Sovereign Value Capture Ratio™ = localRetainedValue / totalEconomicValue × 100`

Rules:

- total economic value must be positive;
- component values must be non-negative;
- sum of component gross values may not exceed total economic value;
- local share must be between 0 and 1;
- every component requires evidence;
- no missing value is imputed.

### Strategic scores

Caller supplies explicit normalized values in `[0, 100]` for:

- `corridorControl`
- `feedstockSecurity`
- `infrastructureReadiness`
- `marketReach`
- `localIndustrialization`
- `governanceRisk`
- `buyerAccess`
- `procurementReadiness`

Each metric must carry at least one evidence reference through the assessment-level `evidenceRefs` set. No silent normalization or external benchmark is performed in tranche 1.

## Derived metrics

### Strategic Readiness Score™

Weighted deterministic score:

- Corridor Control: 18%
- Feedstock Security: 18%
- Infrastructure Readiness: 16%
- Market Reach: 14%
- Local Industrialization: 18%
- Sovereign Value Capture Ratio: 16%

`strategicReadiness = 0.18*CC + 0.18*FS + 0.16*IR + 0.14*MR + 0.18*LI + 0.16*SVCR`

### Sovereignty Gap™

`sovereigntyGap = 100 - SVCR`

### AfrIAgenesis Opportunity Score™

Measures the addressable need for sovereign advisory/intelligence intervention, not the intrinsic quality of the corridor:

- Sovereignty gap: 35%
- Corridor control gap: 20%
- Local industrialization gap: 15%
- Governance risk: 10%
- Buyer access: 10%
- Procurement readiness: 10%

`opportunity = 0.35*(100-SVCR) + 0.20*(100-CC) + 0.15*(100-LI) + 0.10*governanceRisk + 0.10*buyerAccess + 0.10*procurementReadiness`

Interpretation: a structurally weak sovereignty position can create a high intervention opportunity, but it does not convert the corridor itself into a GO.

## Decision gate

Decision values: `GO | HOLD | NO_GO`.

### NO_GO

Any of the following:

- `SVCR < 20`
- `corridorControl < 30`
- `feedstockSecurity < 30`
- `governanceRisk >= 75`

### GO

All of the following:

- `strategicReadiness >= 70`
- `SVCR >= 40`
- `corridorControl >= 50`
- `feedstockSecurity >= 50`
- `governanceRisk <= 45`

### HOLD

All other valid cases.

The output must state the exact triggered gate rules.

## Output model

The engine returns:

- canonical anchor metadata;
- corridor identity;
- `localRetainedValue`;
- `unclassifiedValue`;
- `valueCoverageRatio`;
- `sovereignValueCaptureRatio`;
- five strategic component scores;
- `strategicReadinessScore`;
- `sovereigntyGap`;
- `afriagenesisOpportunityScore`;
- `decision`;
- `decisionReasons[]`;
- `blockers[]`;
- `opportunityLanes[]`;
- unique `evidenceRefs[]`;
- `remeEvents[]`.

## Opportunity lanes

The engine deterministically emits intervention lanes when thresholds are met:

- `ownership_and_value_capture` when `SVCR < 50`;
- `corridor_control_and_contracts` when `corridorControl < 60`;
- `feedstock_and_supply_security` when `feedstockSecurity < 60`;
- `industrialization_and_local_content` when `localIndustrialization < 60`;
- `governance_and_transparency` when `governanceRisk > 45`;
- `market_and_hinterland` when `marketReach < 60`;
- `procurement_and_ppp_advisory` when `procurementReadiness >= 50 && buyerAccess >= 50`.

## MCP interface

Add one governed tool in tranche 1:

`corridor.value_capture.assess`

Required permission scope:

`corridor:assess`

Input: `{ context, payload }` where payload matches the engine assessment model.

Output: existing governed envelope plus the deterministic assessment.

Health endpoint must expose the engine asset ID and version.

## Testing requirements

Tests must prove:

1. SVCR arithmetic is correct and evidence lineage is preserved.
2. Invalid value totals and local shares fail closed.
3. GO, HOLD and NO_GO thresholds are deterministic.
4. Opportunity score is distinct from project readiness.
5. Opportunity lanes are emitted from explicit gaps.
6. MCP registration exposes `corridor.value_capture.assess` under `corridor:assess`.
7. Health metadata exposes the engine anchor.
8. No function silently imputes missing metrics.

## Production truth rule

Passing unit tests and MCP CI establishes `CODE_VERIFIED` for tranche 1 only. V4-DEC-017 must not be labeled `PRODUCTION_PROVEN` until persistence, source ingestion, agents, cockpit, M6, S7+, M8, rollback evidence and R.E.M.E end-to-end proof are completed.