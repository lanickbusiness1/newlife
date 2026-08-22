# Genesis Veille Engine — World State Core v1 — Evidence Pack

Date: 2026-08-22
Repository: `lanickbusiness1/newlife`
Branch: `feature/genesis-veille-world-state-v1`
Pull request: #49
Verified head commit: `de7d06e14cbd4c8ebd5e9dd5435b2ce15a514c19`
GitHub Actions run: `32483062861` (run #55)

## Scope

First executable World State slice absorbed into the canonical **Genesis Veille Engine SaaS**. No new product created.

Implemented chain:

`Source Registry → Provenance Gate → Normalized Event Ledger → Country World State → Risk/Opportunity scoring → FastAPI → public Africa 54/54 cockpit`

## M6 technical evidence

Status: **PASS** for the scoped v1 slice.

- Python 3.12 CI executed from a clean GitHub-hosted Ubuntu runner.
- Full backend suite: **22 passed, 0 failed** (`python -m pytest -q`).
- Docker image build: PASS.
- Container boot: PASS.
- `/health` smoke verification: PASS.
- Public cockpit `/` smoke verification: PASS.
- Rollback path: revert PR/commit; v1 has no database migration.

## S7+ controls

Status: **PASS for code-level security and integrity controls in this slice**.

- Public read / private write separation.
- Ingestion requires `X-Genesis-Ingest-Key` matching `GENESIS_INGEST_KEY`.
- Empty or absent ingest key disables write ingestion.
- Secret comparison uses constant-time comparison.
- Unknown/inactive source IDs are rejected.
- Sensitive events require two distinct corroborating sources and corroboration count >= 2.
- Provenance states: `VERIFIED`, `CORROBORATED`, `OBSERVATION_ONLY`, `REJECTED`.
- Duplicate `event.id` values are rejected and cannot inflate country scores.
- Existing `source_id` metadata cannot be silently overwritten; conflicting metadata is rejected.
- No person-tracking, biometric targeting, covert collection, or offensive capability included.

## M8 readiness decision

Current decision: **HOLD for production deployment; GO for controlled integration/review.**

The scoped executable core is technically verified, but two production-sovereignty items remain before an official public release:

1. **Persistent ledger** — current source/event/world-state state is process-memory backed. Production requires durable storage, integrity checks, restart recovery, backup/restore evidence, and migration/rollback discipline.
2. **Frontend external dependency boundary** — the current cockpit references external mapping assets. A sovereign production release must remove or self-host this dependency and provide availability/degraded-mode evidence.

## Next automatic loop

`Persistent Store RED tests → SQLite/PostgreSQL-compatible repository abstraction → restart recovery tests → backup/restore evidence → frontend dependency elimination → container regression → M6 re-run → S7+ re-run → M8 GO/HOLD decision → Release Center packaging → deployment boundary check.`

## Evidence references

- GitHub Actions run #55: `32483062861`
- Backend job: `96773459847`
- Container smoke job: `96773522219`
- PR: `https://github.com/lanickbusiness1/newlife/pull/49`
