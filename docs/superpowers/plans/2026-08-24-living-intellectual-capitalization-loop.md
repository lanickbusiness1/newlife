# V4-DEC-016 Living Intellectual Capitalization Loop™ — Implementation Plan

**Goal:** Implement and close the governed chain `Chat/signal → canonical Notion → GENESIS V4 → AfrIAgenesis® book → product/execution → authenticated evidence → R.E.M.E™`.

**Architecture:** Extend the existing MCP control plane with a tenant-bound deterministic capitalization module and three least-privilege tools. Persist lineage in a private Supabase schema. External writes stay connector-driven; planning authority, deduplication state and execution evidence are independently authenticated/governed.

**Tech Stack:** TypeScript 5.9, Node 24 CI, Vitest 3.2, MCP SDK, Zod, PostgreSQL 17 / Supabase.

**Spec:** `docs/superpowers/specs/2026-08-24-living-intellectual-capitalization-loop-design.md`

## Global constraints

- V4-DEC-016 scope is already validated; do not reopen it.
- `tenantId` comes from governed MCP `RequestContext` and binds every deterministic identity and persistence lineage.
- ChatGPT memory remains non-canonical.
- No Notion/Supabase/service-role/HMAC secret committed.
- No direct browser/Data API access to the private ledger tables.
- No new product or duplicate Loop Engineering engine.
- No completion claim from unsigned/caller-created receipt strings.
- No caller-controlled deduplication snapshot in the MCP trust path.
- TDD RED → GREEN is mandatory for functional and security behavior.

## Task 1 — Domain RED contract

- [x] Create `livingIntellectualCapitalization.test.ts` before implementation.
- [x] Capture initial CI RED proving missing runtime module rather than unrelated regression.
- [x] Preserve legacy suite while introducing the new contract.

## Task 2 — Tenant-bound signal and Editorial Signal Gate™

- [x] Implement `compileChatSignal`.
- [x] Normalize content/references.
- [x] Use full-width SHA-256 fingerprint including tenant.
- [x] Derive tenant-bound deterministic signal identity.
- [x] Derive immutable `bindingHash` for evaluated signal inputs.
- [x] Implement verification/confidence/evidence/editorial/execution gates.
- [x] Reject exact duplicate fingerprint within tenant.

## Task 3 — Capitalization plan and gate binding

- [x] Implement `compileCapitalizationPlan`.
- [x] Recompute the gate from the supplied signal before issuing write contracts.
- [x] Reject gate reuse when tenant, signal, fingerprint, binding hash or gate result differs.
- [x] Generate tenant-bound target and idempotency keys.
- [x] Issue per-target execution nonce and connector allowlist.
- [x] Route approved signals to canonical, GENESIS, book and product targets according to gate result.
- [x] Canonicalize product references and targets before `planId` derivation.
- [x] Prove logically identical product sets yield identical plan/target/idempotency identities regardless of input order.

## Task 4 — Planning authority, authenticated evidence and R.E.M.E

- [x] Sign the complete canonical plan manifest with `GENESIS_CAPITALIZATION_PLAN_HMAC_SECRET` under `capitalization:plan`.
- [x] Require the planning-authority attestation before `record_evidence` accepts any plan.
- [x] Reject truncated/substituted/mutated plans even when target receipts are otherwise valid.
- [x] Require connector id, nonce and HMAC-SHA256 attestation on receipts.
- [x] Bind receipt attestation to tenant + plan + target + destination/action + idempotency + connector + nonce + receipt fields.
- [x] Fail closed when plan or receipt verifier secret is unavailable.
- [x] Reject wrong connector, wrong nonce and tampered receipt.
- [x] Canonicalize authenticated receipt order before `proofId` derivation.
- [x] Prove identical evidence sets yield identical proof identity regardless of arrival order.
- [x] Return `COMPLETE/PARTIAL/FAILED` only from authenticated evidence.
- [x] Emit R.E.M.E `promote_candidate` contract only after `COMPLETE + REME_CANDIDATE`.

## Task 5 — Three least-privilege MCP tools

- [x] `genesis.capitalization.evaluate_signal` / `capitalization:evaluate`.
- [x] `genesis.capitalization.compile_plan` / `capitalization:plan`.
- [x] `genesis.capitalization.record_evidence` / `capitalization:evidence`.
- [x] Inject tenant from `RequestContext`.
- [x] Read planning/receipt HMAC verifiers from runtime environment; do not commit them.
- [x] Expose feature trust state through health/control-plane metadata.

## Task 6 — Authoritative deduplication state

- [x] Implement `capitalizationState.ts` using native Node `fetch` and no extra package.
- [x] Load tenant fingerprints server-side before both `evaluate_signal` and `compile_plan`.
- [x] Ignore/overwrite caller-supplied `existingFingerprints` in the MCP trust path.
- [x] Fail closed with `CAPITALIZATION_DEDUP_STATE_UNAVAILABLE` if authoritative state is unavailable.
- [x] Create service-only RPC `public.genesis_capitalization_known_fingerprints(text)`.
- [x] Use `SECURITY INVOKER`, never `SECURITY DEFINER`.
- [x] Revoke execute from `PUBLIC`, `anon`, `authenticated`; grant only `service_role` (plus owner/postgres).
- [x] Apply the RPC migration to the linked Supabase project and verify live behavior.
- [x] Add RPC rollback artifact.

## Task 7 — Private Supabase ledger

- [x] Create schema `genesis_capitalization`.
- [x] Create six tables: signals, gates, plans, targets, receipts, proofs.
- [x] Revoke schema/table privileges from `PUBLIC`, `anon`, `authenticated`.
- [x] Enable RLS on every table; no permissive client policies.
- [x] Add tenant-aware composite foreign keys through the entire ledger.
- [x] Add covering indexes for composite FKs.
- [x] Store binding hashes, nonces, connector allowlists and receipt trust fields.
- [x] Preserve bootstrap evidence as `legacy_unverified`; never retroactively claim cryptographic trust.
- [x] Make `chat_signals`, `editorial_gate_evaluations`, `execution_receipts` and `proof_chains` append-only to `service_role`.
- [x] Keep UPDATE only on state-machine tables `capitalization_plans` and `capitalization_targets`.
- [x] Add base, security-hardening, append-only and RPC rollback artifacts.

## Task 8 — Security review TDD cycles

- [x] RED: missing runtime module only; GREEN: original capitalization behavior.
- [x] RED: tenant/hash/gate/receipt/FK weaknesses; GREEN: SHA-256, gate binding, HMAC receipts, tenant-aware lineage.
- [x] RED: missing R.E.M.E contract; GREEN: governed post-proof promotion target.
- [x] RED: unsigned plan, receipt-order proof identity, mutable evidence tables; GREEN: plan HMAC, canonical proof order, append-only privileges.
- [x] RED: caller-controlled dedup state and order-sensitive plan identity; GREEN: authoritative Supabase state + canonical product/target ordering.
- [x] Keep historical functional tests green while adding dedicated security regressions.

## Task 9 — Runtime and database verification

- [x] CI: `npm ci --ignore-scripts`.
- [x] CI: `npm audit --audit-level=high`.
- [x] CI: `npm run typecheck`.
- [x] CI: `npm test`.
- [x] CI: `npm run build`.
- [x] Apply base ledger migration to repository-linked `afria-recruit` Supabase.
- [x] Apply tenant/security hardening migration.
- [x] Apply append-only migration.
- [x] Apply authoritative dedup RPC migration.
- [x] Verify six tables RLS=true.
- [x] Verify `anon`/`authenticated` have no table grants.
- [x] Verify composite tenant-aware FKs in live database.
- [x] Verify immutable evidence tables are `INSERT,SELECT` only to `service_role`; plans/targets retain UPDATE.
- [x] Verify RPC is `SECURITY INVOKER` and service-role-only.
- [x] Run Supabase security advisor.
- [x] Run Supabase performance advisor; no V4-DEC-016 FK is left unindexed.

Intentional advisor state: `rls_enabled_no_policy` INFO for the six private tables. Because client roles have neither schema usage nor table privileges, absence of client RLS policies is the fail-closed server-only design.

## Task 10 — Real capitalization loop / provenance

- [x] Use V4-DEC-016 as first durable signal.
- [x] Execute authorized canonical Notion write.
- [x] Execute GENESIS/Loop Engineering write.
- [x] Execute AfrIAgenesis® manuscript write.
- [x] Record repository/CI execution target.
- [x] Close bootstrap proof and promote R.E.M.E.
- [x] After hardening, relabel historical bootstrap receipts `legacy_unverified` rather than pretending they were HMAC-authenticated.

The historical loop proves connector execution and lineage before the security upgrade. Post-hardening cryptographic trust is enforced for all future runtime evidence; a new external connector receipt must satisfy planning-authority and connector HMAC verification before any new `COMPLETE` result.

## Task 11 — M6 → S7+ → M8 → independent review → merge

- [x] M6 functional gates: deterministic behavior, typecheck, tests, build, schema integrity.
- [x] S7+ hardening: least privilege, tenant isolation, private schema, fail-closed dedup, plan authority, authenticated receipts, immutable evidence, rollback.
- [x] M8 scope: no product duplication, no canonical-memory bypass, evidence lineage retained.
- [ ] Run independent review against the exact current hardened HEAD and resolve every valid blocking finding.
- [ ] Merge PR #61 only after latest MCP CI + Canonical Release + review gates are green.
- [ ] Verify post-merge `main` CI on the actual merged SHA.
- [ ] Write final merge/CI/Supabase/review evidence back to canonical Notion and R.E.M.E.

## Completion rule

Do not mark `DONE`, `CODÉ — VERIFIED`, `MERGED` or `PRODUCTION_PROVEN` before the applicable gates are evidenced. Branch-level completion is insufficient. Closing sequence:

`current-HEAD CI green → independent current-HEAD review green → merge → merged-SHA main CI green → canonical proof update`.

`PRODUCTION_PROVEN` is stricter: the deployed MCP runtime must also have authoritative Supabase URL/service-role configuration plus distinct plan/receipt HMAC secrets and must close a new post-hardening authenticated loop. Historical bootstrap evidence alone does not satisfy that production claim.
