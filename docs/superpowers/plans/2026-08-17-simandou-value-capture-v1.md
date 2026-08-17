# Simandou Value Capture v1 Implementation Plan

> **Execution mode:** governed TDD on `feature/simandou-value-capture-v1`, branched from `feature/mining-local-content-module-06` at `7c28a2f93540c68c934e295e93e56c738673cc78`.

**Goal:** Deliver a synthetic, testable vertical slice: `OreLot → Shipment → Sale → Payment → FiscalObligation → GovernmentReceipt → ValueCapture → Mission Control`, with deterministic Scenario/Bankability outputs and no production claims.

**Architecture:** Reuse the existing AfrIA Workforce Intelligence backend, security controls, RLS patterns, audit/idempotency/emergency-stop controls and Module 6 local-content domain. Add Simandou-specific mine-to-cash, reconciliation, value-capture and bankability modules without creating a new autonomous application.

**Tech Stack:** TypeScript/Node, PostgreSQL 16, JWT RS256/OIDC-ready, RLS, GitHub Actions, existing PWA shell, Node tests + SQL tests.

## Global Constraints

- No commit directly to `main`.
- Synthetic data only.
- TDD mandatory: RED before GREEN for each new behavior.
- Fiscal rules versioned and human-approved; no default tax rates.
- `FACT`, `HYPOTHESIS`, `SIMULATION` remain distinct.
- No double counting in sovereign value aggregation.
- Preserve tenant/project isolation, RLS, audit, idempotency and emergency stop.
- M6, S7+, M8 and Big4 remain distinct gates.
- No claim of production, legal certification, fraud, or institutional deployment from synthetic evidence.

## Tasks

1. Reproducible baseline and branch CI.
2. Mine-to-Cash domain objects and truth classification.
3. Deterministic reconciliation engine.
4. Fiscal rule compilation and expected-vs-received.
5. Anti-double-counting Value Capture ledger.
6. PostgreSQL migration 004 with RLS, tests and rollback.
7. PostgreSQL repository adapters.
8. Governed service with audit/idempotency/emergency stop.
9. HTTP API v1 with strict identity/tenant boundary.
10. Deterministic Scenario & Bankability engine.
11. Simandou Mission Control PWA surface.
12. CI/security regression/evidence pack and Draft PR.

## Definition of Done for sandbox

- Synthetic E2E flow works from ore lot to government receipt and value-capture snapshot.
- Every material result is traceable to evidence and truth class.
- CI runs dependency audit, typecheck, Node tests, PostgreSQL migrations/tests and rollback.
- Draft PR targets `feature/mining-local-content-module-06`, not `main`.
- Readiness dossier states sandbox-only and lists production blockers.
