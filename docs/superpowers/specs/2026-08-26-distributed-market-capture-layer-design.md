# Distributed Market Capture Layer™ — Design Spec

## Status

Approved in chat by CEO on 2026-08-26 for implementation under the canonical **Genesis Release-to-Revenue Control Plane™**. This is a transverse capability, not a standalone commercial product.

## Goal

Build a deterministic market-capture subsystem that converts `sector × territory × intent` into measurable commercial cells, qualifies inbound leads, attributes observed revenue, and decides `KILL | HOLD | SCALE` without inventing demand, location, provider capacity, or revenue evidence.

## Canonical Parent and Integration Boundary

Parent: `Genesis Release-to-Revenue Control Plane™`.

Existing runtime components to reuse:
- `DeployBot / Sovereign Delivery Runtime`
- `Domain Manager™`
- `Release Center™`
- `Compute & Inference Economics Control Layer™`
- `Revenue Engine™`
- `R.E.M.E™`

New module boundary:
- `services/mcp-server/src/marketCapture.ts`
- MCP registration in `services/mcp-server/src/index.ts`
- tests in `services/mcp-server/tests/marketCapture.test.ts`

The module MUST remain provider-neutral. Telephony, WhatsApp, CRM, DNS purchasing, paid media, and real provider dispatch are external adapters and are explicitly out of scope for this first implementation.

## Pilot Scope

Country: **Benin**.
Vertical: **Climatisation & Froid**.
Territories: **Cotonou** and **Abomey-Calavi**.

Initial ten Market Capture Cells™:

1. `BJ-COT-AC-REPAIR` — Cotonou — dépannage climatisation
2. `BJ-COT-AC-INSTALL` — Cotonou — installation climatiseur
3. `BJ-COT-AC-MAINT` — Cotonou — entretien climatisation
4. `BJ-COT-COLD-REPAIR` — Cotonou — dépannage froid commercial
5. `BJ-COT-AC-URGENT` — Cotonou — intervention urgente climatisation
6. `BJ-CAL-AC-REPAIR` — Abomey-Calavi — dépannage climatisation
7. `BJ-CAL-AC-INSTALL` — Abomey-Calavi — installation climatiseur
8. `BJ-CAL-AC-MAINT` — Abomey-Calavi — entretien climatisation
9. `BJ-CAL-COLD-REPAIR` — Abomey-Calavi — dépannage froid commercial
10. `BJ-CAL-AC-URGENT` — Abomey-Calavi — intervention urgente climatisation

## Core Data Contracts

### MarketCaptureCell

Required fields:
- `cellId: string`
- `countryCode: string`
- `territoryCode: string`
- `territoryName: string`
- `sector: string`
- `intentCode: string`
- `intentLabel: string`
- `status: "DRAFT" | "VALIDATING" | "ACTIVE" | "HOLD" | "KILLED" | "SCALE_READY"`
- `channels: { web: boolean; phone: boolean; whatsapp: boolean }`
- `claims: { realLocation: boolean; realProviderCoverage: boolean; uniqueUtility: boolean }`

A cell MUST fail closed when `realLocation`, `realProviderCoverage`, or `uniqueUtility` is false while the caller attempts activation or scale.

### LeadQualificationInput

Required fields:
- `cellId: string`
- `leadId: string`
- `contactPresent: boolean`
- `territoryConfirmed: boolean`
- `intentConfirmed: boolean`
- `urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"`
- `providerCoverageConfirmed: boolean`
- optional observed fields: `budgetAmount`, `availabilityWindow`, `problemDescription`

### LeadQualificationResult

Produces:
- `qualified: boolean`
- `score: number` in `[0,100]`
- `reasons: string[]`
- `routeEligible: boolean`

No missing field may be silently fabricated. Unknown stays unknown.

### CellEconomicsInput

Required observed values:
- `cellId: string`
- `attributedRevenue: number`
- `cellCost: number`
- `qualifiedLeads: number`
- `calls: number`
- `closedSales: number`

Derived metrics:
- `rmcc = attributedRevenue / cellCost` when `cellCost > 0`
- `revenuePerLead = attributedRevenue / qualifiedLeads` when `qualifiedLeads > 0`
- `revenuePerCall = attributedRevenue / calls` when `calls > 0`
- `providerCloseRate = closedSales / qualifiedLeads` when `qualifiedLeads > 0`

Division-by-zero MUST return `null` for the affected metric, not a fabricated zero-performance claim.

## Deterministic Functions

### `compileMarketCaptureCell(input)`

Validates naming, territory, intent, claims and initial state. It does not provision DNS, numbers, providers, or content.

### `qualifyLead(input)`

Scores only explicit observations. Minimum hard requirements for a route-eligible lead:
- contact present
- territory confirmed
- intent confirmed
- provider coverage confirmed

Urgency may increase score but cannot override missing hard requirements.

### `calculateRMCC(input)`

Computes observed cell economics and derived ratios with null-safe division.

### `decideCellScale(input)`

Returns exactly one of `KILL`, `HOLD`, `SCALE` with reasons.

Mandatory fail-closed rules:
- `SCALE` forbidden without `uniqueUtility=true`
- `SCALE` forbidden without real provider coverage
- `SCALE` forbidden when attributed revenue is unobserved or zero
- `SCALE` forbidden when qualified lead count is below the configured minimum evidence threshold
- false location/business-presence claims force `KILL`

Default MVP evidence threshold: `qualifiedLeads >= 5` before `SCALE` can be considered.

Initial economic heuristic for the MVP:
- `KILL` if prohibited claim or fraud condition is present
- `SCALE` if all hard safeguards pass, `qualifiedLeads >= 5`, `attributedRevenue > 0`, and `rmcc >= 2`
- otherwise `HOLD`

This heuristic is deterministic and explicitly provisional. Future R.E.M.E™ learning may propose parameter changes but cannot silently mutate canonical thresholds.

## MCP Surface

Register four governed tools using the existing request context and ECES authorization pattern:

- `genesis.market_capture.compile_cell` — scope `market-capture:compile`
- `genesis.market_capture.qualify_lead` — scope `market-capture:qualify`
- `genesis.market_capture.evaluate_economics` — scope `market-capture:economics`
- `genesis.market_capture.decide_scale` — scope `market-capture:decide`

Every response remains wrapped by the existing governed response envelope in `index.ts`.

## M8 / Safety Invariants

The implementation MUST NOT:
- fabricate a business address, branch, provider, review, availability, price, or transaction;
- create or recommend false Google Business Profiles;
- treat duplicated doorway content as valid utility;
- optimize for evasion or hidden network detection;
- promote a cell to SCALE from impressions, rankings, or AI-generated content alone;
- treat model-estimated revenue as observed attributed revenue.

The implementation MUST:
- preserve uncertainty explicitly;
- keep Google/Search as one acquisition channel, not the economic source of truth;
- use observed revenue for RMCC;
- preserve auditable reasons for qualification and scale decisions;
- remain compatible with later telephony, WhatsApp, CRM, payment, DeployBot and Domain Manager adapters.

## Non-Goals for v0.1

Not included in this iteration:
- domain purchase or DNS mutation;
- microsite HTML generation;
- phone number procurement;
- live voice model integration;
- WhatsApp Business API integration;
- provider marketplace onboarding;
- payment collection;
- autonomous ad buying;
- live Google Business Profile creation;
- production deployment.

These remain separate follow-up adapters after the deterministic core reaches test-proven status.

## Acceptance Criteria

The feature is `TEST_PROVEN` only when automated tests demonstrate all of the following:

1. the ten pilot cells compile deterministically with stable IDs;
2. an invalid or deceptive location/provider claim cannot become ACTIVE or SCALE;
3. lead qualification never fabricates missing observations;
4. urgency cannot bypass missing contact, intent, territory, or provider coverage;
5. RMCC and secondary ratios are derived only from provided observed values;
6. division by zero returns null for non-computable metrics;
7. `SCALE` requires all safety claims, at least 5 qualified leads, positive attributed revenue, and `rmcc >= 2`;
8. false location or false provider coverage produces fail-closed behavior;
9. the four MCP tools enforce their declared scopes through the existing ECES authorization wrapper;
10. existing MCP server tests remain green.

## Evidence State

Before implementation: `SPEC_APPROVED`.
After tests and implementation pass locally/CI: `TEST_PROVEN`.
No `PRODUCTION_PROVEN` claim is permitted until real provider, DNS/HTTPS, routing, rollback and observed economic evidence exist.
