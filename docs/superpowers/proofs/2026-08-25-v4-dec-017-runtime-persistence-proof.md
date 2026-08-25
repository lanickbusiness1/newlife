# V4-DEC-017 — Runtime Persistence Proof

Date: 2026-08-25
Decision: `V4-DEC-017 — Sovereign Corridor & Resource Value Capture Doctrine™`
Asset: `GEN-V4-CORRIDOR-VALUE-CAPTURE-001`
Engine version: `0.1.1`
Control-plane revision: `0.7.0`
Branch: `feat/v4-dec-017-corridor-runtime-persistence`
Stacked PR: #68, based on PR #60, itself based on PR #59.

## Truth status

`RUNTIME_CODE_VERIFIED + PRIVATE_PERSISTENCE_APPLIED + TRANSACTIONAL_RPC_APPLIED + LIVE_ROLLBACK_PROVEN + LIVE_IDEMPOTENCY_PROVEN + CONCURRENCY_GATE_APPLIED + DEPLOYMENT_SECRET_CONTRACT_VERSIONED`

This is **NOT `PRODUCTION_PROVEN`**. Remaining gates include merge governance, post-merge CI, production runtime secret provisioning, deployed MCP health/write-path proof, authoritative Tanga–Lamu–EACOP source ingestion, M6, S7+, M8, rollback/drill and external review.

## Architecture boundary

The deterministic calculation tool remains side-effect free:

- `corridor.value_capture.assess`
- permission scope: `corridor:assess`

The database write path is separate and explicit:

- `corridor.value_capture.assess_and_persist`
- permission scope: `corridor:write`
- calculates with the same deterministic engine
- persists through `persistCorridorAssessmentViaRpc`
- fails closed if persistence configuration is absent or if the database RPC rejects the request.

Runtime secrets are read only from environment variables:

- `GENESIS_CORRIDOR_SUPABASE_URL` (fallback `SUPABASE_URL`)
- `GENESIS_CORRIDOR_SERVICE_ROLE_KEY` (fallback `SUPABASE_SERVICE_ROLE_KEY`)

`services/mcp-server/render.yaml` declares the two GENESIS variables with `sync: false`; no secret value is committed.

## Database boundary

Supabase project bound by repository configuration:

- project name: `afria-recruit`
- project id: `hzrnrdeqscfesxlvfztx`
- private schema: `genesis_corridor`

Foundation tables:

1. `corridors`
2. `evidence_sources`
3. `corridor_evidence`
4. `assessments`
5. `economic_components`
6. `strategic_score_evidence`
7. `reme_events`
8. `ingestion_runs`

All eight tables have RLS enabled. Frontend roles `anon` and `authenticated` have no table privileges in the private schema.

Repository migrations:

- `20260824014956_create_genesis_corridor_persistence_v1.sql`
- `20260824015129_index_genesis_corridor_evidence_foreign_keys.sql`
- `20260825012700_add_corridor_assessment_persistence_rpc.sql`
- `20260825013500_harden_corridor_persistence_concurrency.sql`

Live Supabase migration ledger records the same migration names. Supabase generated application timestamps `20260825012726` and `20260825013608` for the two migrations applied on 2026-08-25; this timestamp difference is expected and does not change migration content/name intent.

## Transactional RPC

Public API entry point:

`public.persist_corridor_assessment_v1(text,text,text,uuid,text,jsonb,jsonb)`

Security properties verified live:

- `SECURITY DEFINER = true`
- `search_path = pg_catalog, public, genesis_corridor`
- `anon EXECUTE = false`
- `authenticated EXECUTE = false`
- `service_role EXECUTE = true`

The underlying core is now:

`public.persist_corridor_assessment_v1_unlocked(...)`

Direct execution is revoked from:

- `public`
- `anon`
- `authenticated`
- `service_role`

The wrapper computes an advisory-lock key from tenant + corridor id + engine version + input hash using `hashtextextended`, takes `pg_advisory_xact_lock`, then invokes the inaccessible core. The existing UNIQUE constraint on `(tenant_id, corridor_id, engine_version, input_hash)` remains the database-level duplicate barrier.

## Evidence-first transaction

The persistence core fails closed unless every `input.evidenceRefs` value is already registered for the same tenant in `genesis_corridor.evidence_sources`.

A successful transaction persists, atomically:

`Corridor → Corridor Evidence → Assessment → Economic Components → Strategic Score Evidence → R.E.M.E Events`

The assessment retains raw input, normalized assessment payload, actor id, agent id, correlation id and an audit id.

## Live rollback proof

A live call with an unregistered evidence reference raised:

`CORRIDOR_PERSISTENCE_EVIDENCE_NOT_REGISTERED`

A follow-up query proved **0 leaked corridor rows**, confirming rollback of the partial corridor upsert inside the failed transaction.

The same fail-closed behavior was rechecked after the concurrency wrapper was applied; the error propagated from the inaccessible core through the wrapper and the database again contained no leaked test rows.

## Live successful + idempotent proof

Before concurrency hardening, a TEST ONLY tenant with three registered evidence sources executed the full write path.

First call receipt:

- corridor UUID: `106a2d51-42fe-45ac-92cd-e63baef921f8`
- assessment UUID: `688f7627-277f-4918-8c08-2c88304f7eeb`
- input hash: `57503a70dc5148d9498e8a8a73763cb9161ee1655380e647a5c39b00d68e1dca`
- `idempotent = false`
- `reme_event_count = 4`

Second call with the stored identical payload returned the same corridor UUID, the same assessment UUID, the same input hash, `idempotent = true`, and the same four R.E.M.E events.

Persisted lineage before cleanup was exactly:

- 1 corridor
- 3 evidence sources
- 3 corridor-evidence links
- 1 assessment
- 5 economic components
- 8 strategic score-evidence links
- 4 R.E.M.E events

All TEST ONLY rows were deleted. Final cleanup verification returned zero test corridors, zero test evidence sources, zero test assessments and zero test R.E.M.E events.

A true simultaneous two-session concurrency load test has **not** been claimed. Concurrency safety is currently supported by the database UNIQUE constraint, deterministic transaction-scoped advisory lock and repository contract tests; a deployed concurrent E2E test remains part of production proof.

## TDD / CI evidence

### Adapter

RED — MCP CI #351:
- existing 51 tests stayed green
- new tests failed only because `src/corridorPersistence.ts` did not yet exist.

GREEN — MCP CI #352:
- adapter implemented
- audit/typecheck/tests/build passed.

### Transactional RPC

RED — MCP CI #353:
- 55 prior tests stayed green
- five RPC contract tests failed only because the migration file did not yet exist.

GREEN — MCP CI #354:
- 60/60 tests passed
- audit/typecheck/build passed.

### MCP write boundary

RED — MCP CI #355:
- 60 previous tests stayed green
- four new tests failed only because `assess_and_persist`, `corridor:write` and persistence health/config wiring did not yet exist.

GREEN — MCP CI #357:
- 64/64 tests passed
- audit 0 vulnerabilities
- typecheck PASS
- build PASS.

### Concurrent idempotency

RED — MCP CI #358:
- previous system remained green
- three new concurrency contract tests failed only because the advisory-lock migration did not yet exist.

GREEN — MCP CI #359:
- 67/67 tests passed across 11 files
- audit 0 vulnerabilities
- typecheck PASS
- build PASS.

### Deployment secret contract

RED — MCP CI #360:
- previous system remained intact
- the new deployment contract failed only because the two `sync:false` declarations were absent from `render.yaml`.

GREEN — MCP CI #361:
- **68/68 tests passed across 12 files**
- npm audit: **0 vulnerabilities**
- strict TypeScript typecheck: PASS
- build: PASS.

## Cross-workflow safety

Changes under `supabase/migrations/**` also trigger `AfrIA Recruit Canonical Release` on pull requests. Verified runs keep release deployment disabled on PRs: the verification job runs, while `Deploy verified artifact` and `Prove public release` are skipped. This prevents V4-DEC-017 migration work from silently publishing Recruit.

## Security advisor

After the V4-DEC-017 RPC and concurrency migrations, Supabase security advisor shows no `anon` or `authenticated` SECURITY DEFINER warning for either corridor persistence function.

The remaining SECURITY DEFINER warnings concern the pre-existing `public.investor_demo_kpis()` function and are outside V4-DEC-017.

Private-schema `RLS enabled, no policy` INFO findings are intentional deny-by-default boundaries for `genesis_corridor`; direct frontend privileges are revoked.

## Remaining production gates

1. Merge/review governance for PR #59 → #60 → #68.
2. Provision the two runtime environment values in the actual MCP deployment environment; secret values must never be committed.
3. Deploy the merged MCP revision and prove `/health` reports `corridorPersistenceRpc = configured`.
4. Execute a deployed `corridor.value_capture.assess_and_persist` smoke test through the MCP permission boundary, including denied `corridor:assess`-only write attempt.
5. Build authoritative source ingestion and register real Tanga–Lamu–EACOP evidence.
6. Execute the first authoritative demonstrator assessment.
7. M6, S7+, M8, rollback/drill, external review.
8. Only then evaluate `PRODUCTION_PROVEN`.
