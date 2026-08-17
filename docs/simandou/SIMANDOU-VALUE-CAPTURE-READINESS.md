# Simandou Value Capture v1 — Readiness & Evidence Report

**Date:** 2026-08-17  
**Canonical parent:** `BP-MINING-GN-001 — AfrIAgenesis® Sovereign Mining OS™ Guinée`  
**Implementation branch:** `feature/simandou-value-capture-v1`  
**Parent branch:** `feature/mining-local-content-module-06`  
**Parent baseline SHA:** `7c28a2f93540c68c934e295e93e56c738673cc78`  
**Last code-verified SHA:** `b0682481d5c19828afa4bc660e53e666159793a2`  
**Last code-verification run:** GitHub Actions `32059899316` — **SUCCESS**

## Decision

**GO — governed synthetic sandbox and Draft PR.**  
**NO-GO — real institutional data, merge into parent, release, public production, legal certification or investment decision.**

This report records executable engineering evidence only. It does not represent GDB approval, Government of Guinea approval, legal certification, M8 final committee approval, Big4 certification or production deployment.

## What is executable

### Sovereign domain

- `OreLot`
- `GradeCertificate`
- `PortShipment`
- `SaleContract`
- `Invoice`
- `Payment`
- `FiscalRule`
- `FiscalObligation`
- `GovernmentReceipt`
- `StateEquityInterest`
- `DividendEvent`
- `FXRepatriationEvent`
- `ValueCaptureComponent`

Every critical object keeps tenant, project, version, evidence and explicit truth semantics.

### Fiscal governance

- no default Guinean fiscal rate is coded;
- fiscal formula is typed and explicit;
- source/version/effectivity/jurisdiction are required;
- a `HUMAN` with `LEGAL_APPROVER` is required before computation;
- expected versus received states are explicit: `PENDING`, `UNDER`, `MATCHED`, `OVER`, `CONTESTED`.

### Reconciliation

Deterministic reconciliation covers:

`Shipment → Sale → Invoice → Payment → FiscalObligation → GovernmentReceipt`

Mismatches create `ReconciliationException` semantics. The system never classifies an exception as fraud.

### Value Capture

- buckets are separated;
- source reuse across economic buckets is blocked;
- `FX_RETENTION` remains visible but is excluded from overlapping retained-economic-value aggregation;
- no Value Capture Ratio is emitted before a human-approved `ValueCaptureMethodology`;
- missing approval returns `METHOD_NOT_APPROVED`.

### Bankability

The deterministic scenario engine supports:

- export fines;
- beneficiation;
- DR-grade pellets;
- DRI/HBI;
- primary steel;
- rails/structures;
- industrial energy;
- logistics hub.

Outputs include EBITDA, NPV, IRR when mathematically resolvable, DSCR when debt service exists and sovereign ROI when public cost exists. Stress cases cover price -20%, price +20%, CAPEX +20% and OPEX +20%. All stress outputs are `SIMULATION`.

### Persistence & security

PostgreSQL migration `004_simandou_value_capture.sql` creates 15 Simandou tables with:

- composite tenant/project integrity;
- forced RLS;
- evidence and truth-class checks;
- version fields;
- anti-double-counting unique index;
- rollback script and re-apply proof.

The service/API reuse existing governed primitives for:

- verified auth-context boundary;
- RBAC;
- request-body tenant rejection;
- idempotency and replay protection;
- emergency stop;
- correlation IDs;
- append-only audit.

### Audit-chain incident closed

During verification, an intermittent audit test exposed a real chain-integrity defect: two events with the same timestamp could be reordered by UUID sorting. A deterministic regression test was added with equal timestamps and reverse lexical UUID order.

The audit sink was corrected to derive order exclusively from cryptographic graph links:

`previous_hash → event_hash`

It now rejects multiple roots, forks, orphan links, cycles, disconnected chains and invalid recomputed hashes. Timestamp/UUID ordering is no longer chain authority.

### Mission Control

`apps/afria-workforce-intelligence/simandou.html` + `simandou.js` provide a responsive low-bandwidth sandbox surface with:

- permanent `SYNTHETIC SANDBOX` banner;
- seven sovereign KPI cards;
- Mine-to-Cash;
- Expected vs Received;
- Exceptions & CAPA;
- Evidence Room;
- Scenario Lab;
- explicit `FACT`, `HYPOTHESIS`, `SIMULATION` labels;
- Value Capture gate locked at `METHOD_NOT_APPROVED` by default;
- no external fonts/video dependencies.

## TDD / CI evidence chain

- Baseline: run `32055988944` — SUCCESS.
- Domain objects: run `32056229388` — SUCCESS after RED.
- Reconciliation: run `32056480189` — SUCCESS after RED.
- Fiscal governance: run `32056823738` — SUCCESS after RED.
- Anti-double-counting Value Capture: run `32057060938` — SUCCESS after RED.
- PostgreSQL/RLS/rollback: run `32057469609` — SUCCESS after RED.
- PostgreSQL adapters: run `32057826975` — SUCCESS after RED.
- Governed service/audit: earlier run `32058211885` succeeded; later stress exposed the equal-timestamp ordering defect, which was reproduced and fixed rather than hidden.
- API: run `32058536125` — SUCCESS.
- Mission Control contract: RED confirmed on run `32059542603` before the UI files existed.
- Final code head + synthetic sovereign E2E: run `32059899316` — **SUCCESS**.

Final run gates all passed:

1. dependency audit;
2. TypeScript typecheck;
3. Mission Control JavaScript syntax;
4. PostgreSQL migrations 001–004;
5. non-owner application role;
6. Simandou schema/RLS contract;
7. deterministic full test suite;
8. sovereign security SQL controls;
9. migration 004 rollback + re-apply;
10. security migration 003 rollback + re-apply.

## Control review — sandbox scope

### M6 — logical quality

**Sandbox engineering assessment: PASS WITH PRODUCTION CONDITIONS.**

Evidence: domain invariants, typed fiscal rules, deterministic reconciliation, anti-double-counting, scenario calculations, API gates, synthetic E2E and regression suite.

### S7+ — security/resilience

**Sandbox engineering assessment: PASS WITH PRODUCTION CONDITIONS.**

Evidence: RLS, tenant isolation, RBAC, idempotency, emergency stop, append-only hash chain, migrations and rollback.

### M8 — strategic governance

**Not final.** The code may remain a synthetic sandbox and Draft PR. Human M8 decision is required before merge/release/real institutional use.

### Big4 / external review

**Not performed.** Deterministic bankability mechanics exist, but real CAPEX/OPEX, market assumptions, fiscal inputs, debt terms, sovereign guarantees and revenue models require independent challenge before institutional use.

## P0 blockers before real institutional pilot

1. **Atomic mutation + audit unit of work:** business mutation and audit append are currently separate transactions. A crash between them could create an audit gap. Production requires one transactional unit of work or an outbox/equivalent proven pattern.
2. **Institutional OIDC/JWKS/MFA:** test/sandbox identity resolution is not an institutional identity provider.
3. **Primary Guinean legal sources:** verified laws, regulations, conventions, amendments and project-specific obligations must replace synthetic rule fixtures.
4. **KPI methodology approval:** formulas for all seven sovereign KPIs must be formally approved and versioned; the system must remain fail-closed otherwise.
5. **Data-sharing and authority:** mandate, data owners, data-classification rules, retention, privacy, cross-border transfer and access matrix must be signed.
6. **Cockpit live integration:** the Mission Control surface is intentionally synthetic/static; read APIs and authorized institutional data adapters are not connected.
7. **Operational target:** staging infrastructure, secrets/KMS, backup/restore, monitoring/alerting, incident response, RTO/RPO and rollback must be proven on the chosen deployment target.
8. **Independent security review:** threat-model validation, pentest and privacy/legal review remain mandatory.
9. **M8 + external/Big4:** strategic governance and economic/commercial challenge remain mandatory before release.
10. **Pilot sponsor:** no real institutional sponsor/acceptance protocol is encoded by this engineering build.

## Promotion rule

The sandbox may be demonstrated only with synthetic data and the permanent sandbox disclosure visible. Any attempt to remove the disclosure, ingest real sensitive data, activate real fiscal rules, claim institutional certification, merge/release or deploy publicly without the required gates is a **NO-GO**.
