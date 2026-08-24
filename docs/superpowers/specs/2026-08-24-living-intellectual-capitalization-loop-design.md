# V4-DEC-016 Living Intellectual Capitalization Loop™ — Design

## Status

CEO-validated implementation design for `V4-DEC-016 — GENESIS Living Intellectual Capitalization Loop™`.

Canonical chain:

`Chat / signal → verification → decision → Notion canonical → GENESIS V4 → book material → product / execution → evidence → R.E.M.E™`

This is an extension of the GENESIS V4 ChatGPT Native Control Plane and Loop Engineering doctrine, not a new product or parallel framework.

## Goal

Turn durable conversations and external signals into governed, deduplicated, tenant-isolated and traceable intellectual capital that can be promoted into canonical Notion, GENESIS V4, the AfrIAgenesis® book manuscript and executable product work without letting chat memory become canonical by itself.

## Non-goals

- No Notion, GitHub, Supabase or service-role credential embedded in the runtime or repository.
- No direct model write to GENOME™, R.E.M.E™ or the manuscript without gate + execution contract + evidence.
- No second Loop Engineering engine.
- No raw-transcript book archive.
- No public Supabase Data API exposure for the capitalization ledger.

## Architecture

### 1. Deterministic tenant-bound runtime

`services/mcp-server/src/livingIntellectualCapitalization.ts` owns:

1. `compileChatSignal` — normalize a signal and derive tenant-bound cryptographic identifiers.
2. `evaluateEditorialSignal` — execute Editorial Signal Gate™.
3. `compileCapitalizationPlan` — produce tenant-bound idempotent write contracts only from the exact evaluated signal.
4. `recordCapitalizationEvidence` — authenticate connector receipts and close the proof chain.

The module performs no external network write. Connector execution remains outside the pure domain module. The MCP request context injects `tenantId`; callers do not choose another tenant inside the payload.

### 2. MCP tools

Exactly three governed tools are registered:

- `genesis.capitalization.evaluate_signal` — scope `capitalization:evaluate`
- `genesis.capitalization.compile_plan` — scope `capitalization:plan`
- `genesis.capitalization.record_evidence` — scope `capitalization:evidence`

They inherit `RequestContext`, ECES authorization, audit logging and restricted-data approval requirements.

R.E.M.E promotion is emitted as a governed target after complete proof closure; it is not a fourth MCP tool.

### 3. Private Supabase ledger

Private schema `genesis_capitalization` contains:

- `chat_signals`
- `editorial_gate_evaluations`
- `capitalization_plans`
- `capitalization_targets`
- `execution_receipts`
- `proof_chains`

The schema is not exposed through Supabase Data API. `PUBLIC`, `anon` and `authenticated` receive no schema/table privileges. RLS is enabled on every table as defense in depth. Server-side persistence is limited to the authorized service integration.

Every parent-child relation is tenant-bound through composite foreign keys, so a privileged persistence path cannot attach a child row from tenant B to a parent row from tenant A.

### 4. Write contracts

Supported target types:

- `notion_canonical`
- `genesis_v4`
- `book_manuscript`
- `product_execution`
- `reme`

Every target includes:

- `tenantId`
- deterministic `targetId`
- deterministic `idempotencyKey`
- `destinationRef`
- action (`append`, `link`, `create_execution_item`, `promote_candidate`)
- required evidence type
- issued `executionNonce`
- `allowedConnectorIds[]`
- status `PLANNED`

Product execution permits only the declared repository/deployment connectors. Canonical, book and R.E.M.E targets permit the Notion connector under the current implementation.

## Data contracts

### ChatSignalInput

Required:

- `tenantId: string` — injected from governed MCP `RequestContext`
- `conversationId: string`
- `sourceRef: string`
- `content: string`
- `sourceTimestamp: string`
- `verificationStatus: "unverified" | "verified" | "decision_validated"`
- `confidence: number` in `[0,1]`

Optional:

- caller signal reference
- `evidenceRefs[]`
- `canonicalDecisionRef`
- `bookSectionHint`
- `productRefs[]`
- `tags[]`
- `existingFingerprints[]`

### Signal identity and binding

Normalized content is hashed with SHA-256. The fingerprint is full-width 256-bit hexadecimal and includes `tenantId`; identical content in different tenants therefore has different fingerprints.

The compiler also derives a `bindingHash` over immutable evaluation inputs including tenant, signal identity, fingerprint, verification status, confidence, evidence references, canonical/book/product references and tags.

`compileCapitalizationPlan` recomputes the gate and refuses a supplied gate unless tenant, fingerprint, binding hash and evaluated result exactly match the current signal. A reused caller signal reference cannot transfer approval to modified content.

### Editorial Signal Gate™

The gate scores:

- verification
- durability
- strategic relevance
- editorial value
- execution relevance

Fail-closed rules:

- unverified input cannot become canonical/book material;
- confidence `< 0.65` fails;
- missing evidence is allowed only for `decision_validated` with `canonicalDecisionRef`;
- exact tenant-bound fingerprint replay becomes `DUPLICATE`;
- content shorter than 80 characters fails unless it is a validated decision with explicit canonical reference.

Book candidate threshold: approved, total score `>= 0.72`, editorial value `>= 0.65`.

Execution candidate threshold: approved, execution relevance `>= 0.60`, at least one product reference.

### Capitalization plan

The planner emits:

- `notion_canonical` on approved gate;
- `genesis_v4` when canonical decision reference exists or `genesis_v4` tag is present;
- `book_manuscript` for a book candidate;
- one `product_execution` contract per distinct product reference for an execution candidate.

R.E.M.E is emitted only after a complete proof returns `REME_CANDIDATE`.

## Authenticated evidence closure

A receipt contains:

- `targetId`
- `receiptRef`
- `executedAt`
- `status`
- optional `artifactHash`
- `connectorId`
- issued target `nonce`
- `attestation`

The verifier requires `CAPITALIZATION_RECEIPT_HMAC_SECRET` at runtime and validates an HMAC-SHA256 over a canonical payload binding:

`tenant + plan + target + destination/action + connector + nonce + receipt fields`.

Closure fails closed when the verifier secret is unavailable, the nonce differs, the connector is not allow-listed or the attestation is invalid. Caller-controlled receipt strings alone can never yield `COMPLETE`.

Proof states:

- `COMPLETE` — every planned target has an authenticated successful receipt;
- `PARTIAL` — at least one authenticated target succeeds and at least one is missing/failed;
- `FAILED` — no planned target succeeds.

Only `COMPLETE` yields `REME_CANDIDATE`.

## Database trust model

The persistence schema stores runtime binding fields, execution nonces, connector allowlists and receipt trust state.

Tenant-aware lineage constraints include:

- gate → signal: `(tenant_id, chat_signal_id)`
- plan → signal: `(tenant_id, chat_signal_id)`
- plan → gate: `(tenant_id, editorial_gate_evaluation_id, chat_signal_id)`
- target → plan: `(tenant_id, capitalization_plan_id)`
- receipt → target: `(tenant_id, capitalization_target_id)`
- proof → plan: `(tenant_id, capitalization_plan_id)`

Verified database receipts require HMAC-SHA256 metadata. The pre-hardening bootstrap evidence is retained for historical lineage as `legacy_unverified`; it is not upgraded retroactively and cannot satisfy the hardened runtime verifier.

## Idempotence and deduplication

Defenses:

1. full-width tenant-bound SHA-256 normalized-content fingerprint;
2. binding hash tying the gate to immutable signal inputs;
3. tenant-bound target/idempotency keys;
4. per-target execution nonce;
5. HMAC-authenticated connector receipts;
6. tenant-aware database foreign keys.

Near-duplicate semantic detection remains a future World Model capability and is not claimed here.

## Security invariants

- ChatGPT memory remains `non_canonical_cache`.
- Restricted data still requires `approvalContext` through ECES.
- Private schema remains outside browser/Data API exposure.
- `PUBLIC`, `anon`, `authenticated` have no privileges on the schema/tables.
- No `SECURITY DEFINER` function is introduced by V4-DEC-016.
- No secret is committed.
- No proof completion without authenticated execution receipts.
- No cross-tenant lineage even through privileged persistence.

RLS-without-policy notices on this private schema are intentional: client roles have no schema/table access. This is fail-closed, not an omitted client policy.

## Rollback

Two rollback layers exist:

1. feature rollback can remove the isolated `genesis_capitalization` schema when destructive rollback is explicitly authorized and evidence has been exported;
2. the security-hardening rollback can restore the pre-hardening schema shape for controlled recovery, with an explicit warning that it discards post-hardening binding/attestation columns.

Rollback is an emergency recovery mechanism, not an automatic downgrade path.

## Test requirements

Vitest must prove at minimum:

1. approved durable routing to canonical/GENESIS/book/product targets;
2. fail-closed verification/confidence behavior;
3. exact duplicate rejection;
4. validated short-decision exception;
5. target omission when editorial/execution requirements are absent;
6. COMPLETE/PARTIAL/FAILED evidence states;
7. R.E.M.E contract only after complete proof;
8. three least-privilege MCP tools;
9. every ledger table has RLS and explicit revokes;
10. tenant-scoped SHA-256 identity/idempotency;
11. gate↔signal immutable binding;
12. HMAC receipt tamper/wrong-connector/missing-verifier rejection;
13. tenant-aware composite database lineage;
14. rollback artifacts are present.

## Done definition

`V4-DEC-016` reaches `CODÉ — VERIFIED` only when all are evidenced:

- implementation committed;
- private migrations applied to linked Supabase runtime;
- audit, typecheck, tests and build green;
- security/performance advisors reviewed and feature-caused findings resolved or explicitly justified;
- rollback artifacts present;
- three MCP tools registered;
- canonical Notion/book writes executed through authorized connectors;
- evidence lineage recorded;
- M6, S7+ and M8 evidence recorded;
- R.E.M.E update completed;
- independent PR review has no unresolved valid blocking finding;
- merged `main` passes its post-merge CI.

A historical pre-hardening receipt is never presented as post-hardening cryptographic proof.
