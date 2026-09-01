# Rollback procedure

A release is deployable only with a known previous image/tag and verified SQLite backup.

1. Freeze new ingestion or enter an approved maintenance window.
2. Capture `/health/ready`, `/system/metrics`, `/sync/status` and evidence state.
3. Create and hash a SQLite backup.
4. Stop candidate containers without deleting the volume.
5. Start previously approved backend/frontend image tags.
6. If DB restoration is needed, restore to a new file first, run `PRAGMA integrity_check`, then switch the configured DB path; never overwrite the only candidate copy.
7. Verify health, evidence integrity, asset/telemetry counts, sync depth and cockpit provenance.
8. Record reason, source/target release, backup hash, operator and results in R.E.M.E evidence.

Real-site rollback is not proven until rehearsed on target-equivalent hardware under site change management.
