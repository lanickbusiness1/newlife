# V4-DEC-016 Living Intellectual Capitalization Loop™ — Implementation Plan

**Goal:** Implement and close the governed chain `Chat/signal → canonical Notion → GENESIS V4 → AfrIAgenesis® book → product/execution → authenticated evidence → R.E.M.E™`.

**Architecture:** Extend the existing MCP control plane with a tenant-bound deterministic capitalization module and three least-privilege tools. Persist lineage in a private Supabase schema. External writes stay connector-driven; proof closure requires authenticated receipts, not caller assertions.

**Tech Stack:** TypeScript 5.9, Node 24 CI, Vitest 3.2, MCP SDK, Zod, PostgreSQL 17 / Supabase.

**Spec:** `docs/superpowers/specs/2026-08-24-living-intellectual-capitalization-loop-design.md`

## Global constraints

- V4-DEC-016 scope is already validated; do not reopen it.
- `tenantId` comes from governed MCP `RequestContext` and must bind every deterministic identity and persistence lineage.
- ChatGPT memory remains non-canonical.
- No Notion/Supabase/service-role/HMAC secret committed.
- No browser/Data API exposure for the ledger.
- No new product or duplicate Loop Engineering engine.
- No completion claim from unsigned/caller-created receipt strings.
- TDD RED → GREEN is mandatory for functional and security behavior.

## Task 1 — Domain RED contract

- [x] Create `livingIntellectualCapitalization.test.ts` before implementation.
- [x] Capture CI RED proving missing runtime module rather than unrelated regression.
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

## Task 4 — Authenticated evidence and R.E.M.E

- [x] Require connector id, nonce and HMAC-SHA256 attestation on receipts.
- [x] Bind attestation to tenant + plan + target + destination/action + connector + nonce + receipt fields.
- [x] Fail closed when verifier secret is unavailable.
- [x] Reject wrong connector, wrong nonce and tampered receipt.
- [x] Return `COMPLETE/PARTIAL/FAILED` only from verified receipt set.
- [x] Emit R.E.M.E `promote_candidate` contract only after `COMPLETE + REME_CANDIDATE`.

## Task 5 — Three least-privilege MCP tools

- [x] `genesis.capitalization.evaluate_signal` / `capitalization:evaluate`.
- [x] `genesis.capitalization.compile_plan` / `capitalization:plan`.
- [x] `genesis.capitalization.record_evidence` / `capitalization:evidence`.
- [x] Inject tenant from `RequestContext`.
- [x] Read receipt HMAC verifier from runtime environment; do not commit it.
- [x] Expose feature anchor through health/control-plane metadata.

## Task 6 — Private Supabase ledger

- [x] Create schema `genesis_capitalization`.
- [x] Create six tables: signals, gates, plans, targets, receipts, proofs.
- [x] Revoke schema/table privileges from `PUBLIC`, `anon`, `authenticated`.
- [x] Enable RLS on every table; no permissive client policies.
- [x] Grant only required server-side SELECT/INSERT/UPDATE to service integration.
- [x] Add rollback artifact.
- [x] Trigger MCP CI for migration/rollback changes.

## Task 7 — Security hardening after independent review

- [x] Add security regression tests before fixes.
- [x] Replace 32-bit fingerprint with tenant-bound SHA-256.
- [x] Bind gate to immutable signal state.
- [x] Require connector-authenticated evidence.
- [x] Strengthen static RLS/revoke assertions per table.
- [x] Add tenant-aware composite foreign keys through the entire ledger.
- [x] Add covering indexes for composite FKs.
- [x] Preserve bootstrap evidence as `legacy_unverified`; never retroactively claim cryptographic trust.
- [x] Add security-hardening rollback artifact.

## Task 8 — Runtime and database verification

- [x] CI: `npm ci --ignore-scripts`.
- [x] CI: `npm audit --audit-level=high`.
- [x] CI: `npm run typecheck`.
- [x] CI: `npm test`.
- [x] CI: `npm run build`.
- [x] Apply base ledger migration to repository-linked `afria-recruit` Supabase.
- [x] Apply tenant/security hardening migration.
- [x] Verify six tables RLS=true.
- [x] Verify `anon`/`authenticated` have no table grants.
- [x] Verify composite tenant-aware FKs in live database.
- [x] Run Supabase security advisor.
- [x] Run Supabase performance advisor; no feature FK is left unindexed.

Intentional advisor state: `rls_enabled_no_policy` INFO for the six private tables. Because client roles have neither schema usage nor table privileges, absence of client RLS policies is the fail-closed server-only design.

## Task 9 — Real capitalization loop / provenance

- [x] Use V4-DEC-016 as first durable signal.
- [x] Execute authorized canonical Notion write.
- [x] Execute GENESIS/Loop Engineering write.
- [x] Execute AfrIAgenesis® manuscript write.
- [x] Record repository/CI execution target.
- [x] Close bootstrap proof and promote R.E.M.E.
- [x] After hardening, relabel historical bootstrap receipts `legacy_unverified` rather than pretending they were HMAC-authenticated.

The historical loop proves connector execution and lineage before the security upgrade. Post-hardening cryptographic trust is proven by regression/CI and enforced for all future runtime evidence; a new external connector receipt must satisfy HMAC verification before any new `COMPLETE` result.

## Task 10 — M6 → S7+ → M8 → independent review → merge

- [x] M6 functional gates: deterministic behavior, typecheck, tests, build, schema integrity.
- [x] S7+ hardening: least privilege, no embedded secret, private schema, fail-closed gates, idempotence, authenticated receipts, rollback.
- [x] M8 scope: no product duplication, no canonical-memory bypass, evidence lineage retained.
- [ ] Run independent review against current hardened HEAD and resolve every valid blocking finding.
- [ ] Merge PR #61 only after latest CI + review gates are green.
- [ ] Verify post-merge `main` CI on the actual merged SHA.
- [ ] Write final merge/CI/Supabase evidence back to canonical Notion and R.E.M.E.

## Completion rule

Do not mark `DONE`, `PRODUCTION_PROVEN` or equivalent before the final four unchecked items are evidenced. A green feature branch is necessary but not sufficient; the closing state is `review green → merged main → post-merge CI green → canonical proof updated`.
