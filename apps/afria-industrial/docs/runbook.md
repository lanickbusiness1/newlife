# Operator runbook — proof environment

## Start
```bash
cp .env.example .env
# Replace every change-me-* value.
docker compose up --build -d
curl --fail http://localhost:8000/health/ready
curl --fail http://localhost:8000/system/metrics
```
Expected ready state: database accessible and `evidence_integrity=true`. Cockpit is `http://localhost:8080` and must display simulation provenance.

## Diagnose
Use `/health/live` for process liveness, `/health/ready` for DB + evidence readiness, `/system/mode` for ONLINE/OFFLINE_EDGE, `/system/metrics` for operational signals, `/sync/status` for queue depth and `/evidence` for chain state. Stale/suspect telemetry must never be presented as live.

## Backup
```bash
python - <<'PY'
import sqlite3
src=sqlite3.connect('/data/industrial.db')
dst=sqlite3.connect('/data/industrial-backup.db')
src.backup(dst)
dst.close(); src.close()
PY
```
Record backup hash and release identifier in deployment evidence.

## Stop
```bash
docker compose down
```
Do not remove the persistent volume unless destruction is explicitly authorized and retention requirements are satisfied.
