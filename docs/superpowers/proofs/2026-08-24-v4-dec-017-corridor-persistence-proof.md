# V4-DEC-017 — Corridor Persistence Foundation — Verification Proof

## Status

`TRANCHE 2 FOUNDATION — PERSISTENCE_SCHEMA_APPLIED + REPO_VERSIONED + CONTRACT_TESTED — NOT PRODUCTION_PROVEN`

Decision: `V4-DEC-017 — Sovereign Corridor & Resource Value Capture Doctrine™`

Runtime parent asset: `GEN-V4-CORRIDOR-VALUE-CAPTURE-001`

Repository: `lanickbusiness1/newlife`

Stacked branch: `feat/v4-dec-017-corridor-persistence`

Stacked PR: `#60 — feat: persist V4-DEC-017 corridor evidence and assessments`

Base: `feat/v4-dec-017-corridor-value-capture` / PR #59

Supabase project: `afria-recruit` (`hzrnrdeqscfesxlvfztx`) as configured by the repository's Supabase project binding.

## Live migrations applied

### Foundation

Migration version: `20260824014956`

Migration name: `create_genesis_corridor_persistence_v1`

Repository file:

`supabase/migrations/20260824014956_create_genesis_corridor_persistence_v1.sql`

### Evidence foreign-key indexes

Migration version: `20260824015129`

Migration name: `index_genesis_corridor_evidence_foreign_keys`

Repository file:

`supabase/migrations/20260824015129_index_genesis_corridor_evidence_foreign_keys.sql`

The second migration was added after Supabase performance advisors identified three evidence foreign keys without covering indexes. Re-running the advisor after the migration no longer returned those three `unindexed_foreign_keys` findings.

## Private schema boundary

Schema: `genesis_corridor`

The schema is intentionally outside the repository's exposed API schemas. Frontend-facing roles are denied at schema and table levels.

Verified live privilege result:

- `anon`: 0 table privileges in `genesis_corridor`
- `authenticated`: 0 table privileges in `genesis_corridor`
- `service_role`: 19 explicit table privileges

RLS is enabled on all eight corridor tables. No frontend RLS policies are created intentionally: this tranche is backend-only and deny-by-default.

## Tables

1. `genesis_corridor.corridors`
2. `genesis_corridor.evidence_sources`
3. `genesis_corridor.corridor_evidence`
4. `genesis_corridor.assessments`
5. `genesis_corridor.economic_components`
6. `genesis_corridor.strategic_score_evidence`
7. `genesis_corridor.reme_events`
8. `genesis_corridor.ingestion_runs`

## Data integrity

The schema preserves:

- tenant-scoped corridor identity;
- evidence registry with authority tier, verification status and source metadata;
- corridor-to-evidence relations;
- append-first assessment payloads keyed by tenant, corridor, engine version and input hash;
- value arithmetic constraints;
- `SVCR + sovereigntyGap ≈ 100` database check;
- GO/HOLD/NO_GO decision constraint;
- normalized economic component evidence;
- normalized evidence for all eight strategic score keys;
- R.E.M.E-ready event persistence;
- source ingestion run audit state.

Assessment and evidence-detail tables are intentionally not granted UPDATE to `service_role`; mutable lifecycle updates are restricted to corridor metadata, evidence source verification state and ingestion-run progress.

## Repository TDD evidence

### RED

MCP CI `#192`

Run ID: `32681166523`

Job ID: `97298016665`

Result: expected failure.

- 46 pre-existing tests passed.
- 5 new persistence contract tests failed only because the exact migration files were not yet versioned in the repository.
- Failure mode: `ENOENT` for `20260824014956_create_genesis_corridor_persistence_v1.sql`.

### GREEN

MCP CI `#194`

Run ID: `32681217999`

Job ID: `97298156099`

Result: success.

- `npm audit --audit-level=high`: 0 vulnerabilities
- TypeScript strict typecheck: PASS
- Vitest: 7 files, **51/51 tests PASS**
- build: PASS

The five persistence tests enforce:

- exact migration version/file presence;
- private-schema privilege denial;
- RLS on all eight tables;
- score-to-evidence persistence contract;
- append-first assessment integrity and sovereign score constraints;
- evidence foreign-key index migration presence.

## Security advisor state

For `genesis_corridor`, the Supabase security advisor reports only INFO notices that RLS is enabled without policies. This is intentional for the private backend-only schema because `anon` and `authenticated` have no schema/table privileges.

Two WARN findings currently visible on the Supabase project concern the pre-existing public `investor_demo_kpis()` SECURITY DEFINER function and are outside the V4-DEC-017 migration scope.

## Performance advisor state

The three evidence foreign-key findings introduced by the first migration were remediated by migration `20260824015129`.

`unused_index` INFO findings immediately after creation are not treated as removal signals before production traffic exists.

## Production truth rule

This tranche proves a real persisted database foundation, but it does not yet prove that the MCP runtime writes live assessments into it.

Current state:

`DOCTRINE_VALIDATED + RUNTIME_CODE_VERIFIED + EVIDENCE_PROVENANCE_HARDENED + PRIVATE_PERSISTENCE_SCHEMA_APPLIED + MIGRATIONS_VERSIONED + CONTRACT_TESTED`

Forbidden state:

`PRODUCTION_PROVEN`

Still required:

- runtime persistence adapter and transactional write path;
- authoritative source ingestion and verification;
- live Tanga–Lamu–EACOP evidence registry;
- specialized source/verification agents;
- executive corridor cockpit;
- deployed MCP/database integration verification;
- M6;
- S7+;
- M8/review;
- rollback execution proof;
- end-to-end R.E.M.E persistence and replay proof.
