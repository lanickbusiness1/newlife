# V4-DEC-016 Living Intellectual Capitalization Loop™ — Design

## Status

CEO-validated implementation design for `V4-DEC-016 — GENESIS Living Intellectual Capitalization Loop™`.

Canonical chain:

`Chat / signal → verification → decision → Notion canonical → GENESIS V4 → book material → product / execution → evidence → R.E.M.E™`

This design extends the existing GENESIS V4 ChatGPT Native Control Plane and Loop Engineering doctrine. It does not create a new product or a parallel framework.

## Goal

Turn durable conversations and external signals into governed, deduplicated, traceable intellectual capital that can be promoted into canonical Notion, GENESIS V4, the AfrIAgenesis® book manuscript and executable product work without letting chat memory become canonical by itself.

## Non-goals

- Do not embed Notion, Google Drive or other third-party credentials in the MCP runtime.
- Do not let a model write directly to GENOME™, R.E.M.E™ or the book without an explicit gate result and write contract.
- Do not create a second Loop Engineering engine.
- Do not make the book a raw transcript archive.
- Do not expose the capitalization ledger through the public Supabase Data API.

## Architecture

### 1. Deterministic runtime module

Create `services/mcp-server/src/livingIntellectualCapitalization.ts` as a pure TypeScript module. It owns four responsibilities:

1. `compileChatSignal` — normalize a chat/conversation signal and generate a deterministic fingerprint.
2. `evaluateEditorialSignal` — apply the Editorial Signal Gate™ and decide whether the signal is durable enough for canonical/book capitalisation.
3. `compileCapitalizationPlan` — produce idempotent write contracts for each approved destination.
4. `recordCapitalizationEvidence` — verify receipts returned by external connectors and close the proof chain.

The module does not perform network I/O. External writes remain connector actions executed by the governing agent. This preserves provider independence, secret isolation and least privilege.

### 2. MCP tools

Register three governed tools in `services/mcp-server/src/index.ts`:

- `genesis.capitalization.evaluate_signal` — scope `capitalization:evaluate`
- `genesis.capitalization.compile_plan` — scope `capitalization:plan`
- `genesis.capitalization.record_evidence` — scope `capitalization:evidence`

The tools inherit the existing `RequestContext`, ECES authorization and audit logging.

### 3. Private Supabase ledger

Create a migration that introduces private schema `genesis_capitalization` with six tables:

- `chat_signals`
- `editorial_gate_evaluations`
- `capitalization_plans`
- `capitalization_targets`
- `execution_receipts`
- `proof_chains`

The schema is not added to `api.schemas`. All privileges are revoked from `PUBLIC`, `anon` and `authenticated`. RLS is enabled as defense in depth. The tables are intended for server-side persistence through a separately authorized database integration, not direct browser access.

### 4. Write contracts

A capitalization plan contains zero or more target contracts. Supported target types are:

- `notion_canonical`
- `genesis_v4`
- `book_manuscript`
- `product_execution`
- `reme`

Every target contract includes:

- deterministic `targetId`
- deterministic `idempotencyKey`
- destination type
- destination reference
- action (`append`, `link`, `create_execution_item`, `promote_candidate`)
- required evidence type
- status `PLANNED`

No target can be executed twice under the same idempotency key.

## Data contracts

### ChatSignalInput

Required:

- `conversationId: string`
- `sourceRef: string`
- `content: string`
- `sourceTimestamp: string`
- `verificationStatus: "unverified" | "verified" | "decision_validated"`
- `confidence: number` between 0 and 1

Optional:

- `signalId`
- `evidenceRefs[]`
- `canonicalDecisionRef`
- `bookSectionHint`
- `productRefs[]`
- `tags[]`
- `existingFingerprints[]`

### Normalized chat signal

The compiler trims content, normalizes whitespace, de-duplicates references, derives a lowercase canonical text representation and computes an FNV-1a based fingerprint. It returns a deterministic `signalId` when none is supplied.

### Editorial Signal Gate™

The gate scores five dimensions from 0 to 1:

- verification
- durability
- strategic relevance
- editorial value
- execution relevance

Mandatory fail-closed rules:

- `unverified` input cannot become canonical or book material.
- confidence below `0.65` cannot become canonical or book material.
- missing evidence is allowed only for `decision_validated` signals that include a `canonicalDecisionRef`.
- exact fingerprint duplicate is rejected as `DUPLICATE`.
- content shorter than 80 characters is rejected as `INSUFFICIENT_SIGNAL` unless it is a validated decision with an explicit canonical reference.

A signal becomes `BOOK_CANDIDATE` when:

- it is not duplicate,
- verification passes,
- total score is at least `0.72`, and
- editorial value is at least `0.65`.

A signal becomes `EXECUTION_CANDIDATE` when execution relevance is at least `0.60` and at least one product reference exists.

### Capitalization plan

The planner accepts the normalized signal and gate result. It generates:

- `notion_canonical` whenever the gate is approved,
- `genesis_v4` when a canonical decision reference exists or the signal is tagged `genesis_v4`,
- `book_manuscript` when the gate is `BOOK_CANDIDATE`,
- `product_execution` for each product reference when it is an `EXECUTION_CANDIDATE`,
- `reme` only after execution evidence is later recorded; it is not pre-authorized by the initial plan.

### Evidence closure

`recordCapitalizationEvidence` receives a plan and connector receipts. Each receipt contains:

- `targetId`
- `receiptRef`
- `executedAt`
- `status: "success" | "failed"`
- optional `artifactHash`

The proof result is:

- `COMPLETE` when every planned target has a successful receipt,
- `PARTIAL` when at least one target succeeded and at least one is missing/failed,
- `FAILED` when no planned target succeeded.

A complete proof returns `nextGate: "REME_CANDIDATE"`. Partial or failed proof returns `nextGate: "EXECUTION_REPAIR"`.

## Idempotence and deduplication

Two defenses are required:

1. normalized content fingerprint prevents exact semantic-text replay after whitespace/case normalization;
2. per-target idempotency keys prevent duplicate writes for the same signal and destination.

The runtime does not claim semantic embedding similarity. Near-duplicate semantic detection can be added later through the World Model without changing these contracts.

## Security

- ChatGPT memory remains `non_canonical_cache`.
- Restricted data still requires `approvalContext` through the existing MCP request gate.
- The Supabase ledger stays in a private schema and is not added to Data API exposure.
- `PUBLIC`, `anon` and `authenticated` receive no privileges on the schema or tables.
- No `SECURITY DEFINER` function is introduced.
- No service role key, Notion token or database secret is committed.
- External connectors must return receipts before the system claims end-to-end completion.

## Rollback

The repository will include an explicit rollback SQL artifact. In a controlled dev/staging validation, rollback removes only the `genesis_capitalization` schema introduced by this feature. Production execution must export/retain ledger evidence before destructive rollback.

## Tests

Vitest coverage must prove:

1. verified durable signal is accepted and routed to canonical + book + product targets;
2. unverified or low-confidence signal fails closed;
3. exact fingerprint duplicate is rejected;
4. short validated CEO decision with canonical reference can pass despite short content;
5. book destination is absent for low editorial value;
6. product destination is absent without product references;
7. evidence closure distinguishes COMPLETE/PARTIAL/FAILED;
8. MCP index registers three least-privilege tools;
9. migration contains the six required tables, RLS and explicit revokes;
10. rollback artifact removes only the feature schema.

## Done definition

`V4-DEC-016` moves from `SPÉCIFIÉ — NON ENCORE CODÉ` to `CODÉ — VERIFIED` only when all of the following exist:

- implementation code;
- migration committed and applied to the linked Supabase project or a verified staging equivalent;
- tests passing;
- typecheck passing;
- build passing;
- npm security audit passing at the repository threshold;
- Supabase security advisor reviewed after DDL;
- rollback artifact present and validated;
- MCP tools registered;
- one real canonical Notion + book write executed through authorized connectors with receipts recorded in the proof chain;
- M6, S7+ and M8 evidence recorded;
- R.E.M.E™ update completed.
