# V4-DEC-016 Living Intellectual Capitalization Loop™ — Design

## Status

CEO-validated implementation design for `V4-DEC-016 — GENESIS Living Intellectual Capitalization Loop™`.

Canonical chain:

`Chat / signal → verification → decision → Notion canonical → GENESIS V4 → book material → product / execution → evidence → R.E.M.E™`

This is an extension of the GENESIS V4 ChatGPT Native Control Plane and Loop Engineering doctrine, not a new product or parallel framework.

## Goal

Turn durable conversations and external signals into governed, deduplicated, tenant-isolated and traceable intellectual capital that can be promoted into canonical Notion, GENESIS V4, the AfrIAgenesis® book manuscript and executable product work without letting chat memory become canonical by itself.

## Non-goals

- No Notion, GitHub, Supabase, service-role or HMAC credential embedded in the runtime or repository.
- No direct model write to GENOME™, R.E.M.E™ or the manuscript without gate + execution contract + evidence.
- No second Loop Engineering engine.
- No raw-transcript book archive.
- No direct Data API exposure of the private capitalization tables.

## Architecture

### 1. Deterministic tenant-bound domain runtime

`services/mcp-server/src/livingIntellectualCapitalization.ts` owns:

1. `compileChatSignal` — normalize a signal and derive tenant-bound cryptographic identifiers.
2. `evaluateEditorialSignal` — execute Editorial Signal Gate™.
3. `compileCapitalizationPlan` — produce tenant-bound idempotent write contracts only from the exact evaluated signal.
4. `attestCapitalizationPlan` — bind the complete plan manifest to the planning authority with HMAC-SHA256.
5. `recordCapitalizationEvidence` — authenticate the planning authority plus connector receipts and close the proof chain.

The domain module performs no external network write. Connector execution remains outside it. The MCP request context injects `tenantId`; callers cannot select another tenant through payload data.

### 2. Authoritative deduplication state

`services/mcp-server/src/capitalizationState.ts` loads exact known fingerprints from Supabase for the governed tenant before `evaluate_signal` and `compile_plan`.

The MCP layer ignores caller-provided dedup snapshots. It calls the service-only RPC:

`public.genesis_capitalization_known_fingerprints(p_tenant_id text)`

The function is `SECURITY INVOKER`, reads the private ledger under `service_role`, and is executable only by `postgres`/`service_role`; `PUBLIC`, `anon` and `authenticated` have no execute permission.

Runtime configuration is secret-backed:

- `GENESIS_CAPITALIZATION_SUPABASE_URL` or `SUPABASE_URL`
- `GENESIS_CAPITALIZATION_SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_ROLE_KEY`

If authoritative state cannot be loaded, evaluation/planning fails closed with `CAPITALIZATION_DEDUP_STATE_UNAVAILABLE`; it never silently trusts a caller snapshot.

### 3. MCP tools

Exactly three governed tools are registered:

- `genesis.capitalization.evaluate_signal` — scope `capitalization:evaluate`
- `genesis.capitalization.compile_plan` — scope `capitalization:plan`
- `genesis.capitalization.record_evidence` — scope `capitalization:evidence`

They inherit `RequestContext`, ECES authorization, audit logging and restricted-data approval requirements.

R.E.M.E promotion is emitted as a governed target after complete proof closure; it is not a fourth MCP tool.

### 4. Private Supabase ledger

Private schema `genesis_capitalization` contains:

- `chat_signals`
- `editorial_gate_evaluations`
- `capitalization_plans`
- `capitalization_targets`
- `execution_receipts`
- `proof_chains`

`PUBLIC`, `anon` and `authenticated` receive no schema/table privileges. RLS is enabled on every table as defense in depth. Server-side persistence is limited to the authorized service integration.

Every parent-child relation is tenant-bound through composite foreign keys. `chat_signals`, `editorial_gate_evaluations`, `execution_receipts` and `proof_chains` are append-only to `service_role`; only the state-machine tables `capitalization_plans` and `capitalization_targets` remain updateable.

### 5. Write contracts

Supported target types:

- `notion_canonical`
- `genesis_v4`
- `book_manuscript`
- `product_execution`
- `reme`

Every target includes tenant, deterministic target ID/idempotency key, destination, action, evidence type, execution nonce, connector allowlist and `PLANNED` status.

Product references are normalized, deduplicated and sorted. Final targets are sorted by deterministic `targetId` before `planId` derivation and before return. Equivalent logical inputs therefore produce the same plan regardless of input ordering.

## Signal identity and gate binding

Normalized content is hashed with full-width SHA-256 and includes `tenantId`; identical content in different tenants has different fingerprints.

A `bindingHash` covers immutable evaluation inputs: tenant, signal identity, fingerprint, verification status, confidence, evidence references, canonical/book/product references and tags.

`compileCapitalizationPlan` recomputes the gate and rejects reuse unless tenant, fingerprint, binding hash and gate result match the exact signal.

Editorial fail-closed rules include:

- unverified input cannot become canonical/book material;
- confidence `< 0.65` fails;
- missing evidence is allowed only for `decision_validated` plus canonical reference;
- exact tenant-bound fingerprint replay becomes `DUPLICATE`;
- content shorter than 80 characters fails unless it is an explicit validated decision.

Book candidate threshold: approved + total score `>= 0.72` + editorial value `>= 0.65`.

Execution candidate threshold: approved + execution relevance `>= 0.60` + at least one product reference.

## Planning authority and evidence trust

### Plan attestation

`capitalization:plan` signs the complete canonical plan manifest using:

`GENESIS_CAPITALIZATION_PLAN_HMAC_SECRET`

The manifest binds tenant, plan ID, signal binding/fingerprint, status, R.E.M.E state, blockers and every canonical target including destination, action, idempotency key, execution nonce and connector allowlist.

`record_evidence` rejects missing, malformed or mismatching plan attestations. An evidence-only caller cannot truncate, substitute or mutate a legitimate plan and inherit authority.

### Connector receipt attestation

Each receipt contains target, receipt reference, execution timestamp/status, optional artifact hash, connector ID, issued nonce and HMAC-SHA256 attestation.

The verifier uses:

`GENESIS_CAPITALIZATION_RECEIPT_HMAC_SECRET`

and optionally restricts connectors further with `GENESIS_CAPITALIZATION_TRUSTED_CONNECTORS`.

The receipt HMAC binds tenant + plan + target + destination/action + idempotency key + connector + nonce + receipt fields. Wrong connector, wrong nonce, tampering or absent verifier fails closed.

Before deriving `proofId`, authenticated receipts are sorted canonically by target ID and receipt reference. The same evidence set therefore yields the same proof identity regardless of arrival order.

Proof states:

- `COMPLETE` — every planned target has an authenticated successful receipt;
- `PARTIAL` — at least one succeeds and at least one is missing/failed;
- `FAILED` — no planned target succeeds.

Only `COMPLETE` yields `REME_CANDIDATE`.

## Database trust model

Tenant-aware lineage constraints include:

- gate → signal: `(tenant_id, chat_signal_id)`
- plan → signal: `(tenant_id, chat_signal_id)`
- plan → gate: `(tenant_id, editorial_gate_evaluation_id, chat_signal_id)`
- target → plan: `(tenant_id, capitalization_plan_id)`
- receipt → target: `(tenant_id, capitalization_target_id)`
- proof → plan: `(tenant_id, capitalization_plan_id)`

Verified database receipts require HMAC metadata. Pre-hardening bootstrap evidence is preserved as `legacy_unverified`; it is never retroactively represented as cryptographically verified.

## Idempotence and deduplication defenses

1. authoritative tenant fingerprint state loaded server-side;
2. full-width tenant-bound SHA-256 fingerprint;
3. immutable signal binding hash;
4. canonical product/target order;
5. tenant-bound target/idempotency keys;
6. planning-authority HMAC over complete manifest;
7. per-target execution nonce;
8. HMAC-authenticated connector receipts;
9. canonical receipt ordering before proof identity;
10. tenant-aware database foreign keys and append-only proof records.

Near-duplicate semantic detection remains a future World Model capability and is not claimed here.

## Security invariants

- ChatGPT memory remains `non_canonical_cache`.
- Restricted data still requires `approvalContext` through ECES.
- Private ledger tables remain inaccessible to client roles.
- The dedup RPC is `SECURITY INVOKER`, never `SECURITY DEFINER`.
- No secret is committed.
- No planning contract if authoritative dedup state is unavailable.
- No proof completion without a valid planning-authority attestation and authenticated execution receipts.
- No cross-tenant lineage even through privileged persistence.
- Immutable evidence tables cannot be rewritten by `service_role`.

RLS-without-policy notices on the six private tables are intentional because client roles have neither schema usage nor table privileges.

## Rollback

Rollback artifacts exist for:

1. full isolated feature schema removal;
2. tenant/security hardening;
3. append-only privilege hardening;
4. authoritative dedup RPC removal.

Rollback is controlled recovery, not an automatic downgrade path.

## Test requirements

Vitest must prove at minimum:

1. durable routing to canonical/GENESIS/book/product targets;
2. fail-closed verification/confidence behavior;
3. exact duplicate rejection;
4. short validated-decision exception;
5. target omission when requirements are absent;
6. COMPLETE/PARTIAL/FAILED evidence states;
7. R.E.M.E only after complete proof;
8. exactly three least-privilege MCP tools;
9. per-table RLS/revokes and tenant-aware FKs;
10. tenant-scoped SHA-256 identity/idempotency;
11. gate↔signal immutable binding;
12. plan-attestation enforcement and plan-tamper rejection;
13. receipt tamper/wrong-connector/missing-verifier rejection;
14. proof identity invariant to receipt order;
15. append-only immutable evidence privileges;
16. plan identity invariant to product-reference order;
17. authoritative service-only dedup state and caller snapshot rejection;
18. rollback artifacts.

## Done definition

`V4-DEC-016` reaches `CODÉ — VERIFIED` only when all are evidenced:

- implementation committed;
- all linked Supabase migrations applied;
- audit, typecheck, full tests and build green;
- security/performance advisors reviewed and feature-caused findings resolved or explicitly justified;
- rollback artifacts present;
- canonical Notion/book writes and R.E.M.E lineage recorded;
- M6, S7+ and M8 evidence recorded;
- independent current-HEAD review has no unresolved valid blocking finding;
- PR merged to `main`;
- actual merged SHA passes post-merge CI.

`PRODUCTION_PROVEN` additionally requires the deployed MCP runtime to have all required secret-backed configuration and to complete a new post-hardening authenticated loop. Historical bootstrap evidence alone is not sufficient for that production claim.
