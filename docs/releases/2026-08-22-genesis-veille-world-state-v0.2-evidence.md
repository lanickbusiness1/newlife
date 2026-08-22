# Genesis Veille Engine — World State Core v0.2 — M6 / S7+ / M8 Evidence Pack

Date: 2026-08-22
Canonical product: **Genesis Veille Engine SaaS** (`PRD-VEILLE-001`)
Repository: `lanickbusiness1/newlife`
Branch: `feature/genesis-veille-world-state-v1`
Pull request: #49
Verified application/control commit: `01f66904971a62bd425c31db42a95d2cb4774931`
GitHub Actions run: `32547983318` (run #94)
Threat model: `docs/security/2026-08-22-genesis-veille-world-state-v0.2-threat-model.md`

## Decision summary

- **M6 technical gate:** PASS
- **S7+ scoped code / security / integrity gate:** PASS
- **ECES World State scoped control pack:** TEST_PROVEN / ready for external review
- **M8 controlled integration / external review:** GO
- **M8 production deployment:** HOLD

The World State technical P0 blockers identified during this loop are closed: durable state, container replacement recovery, backup/restore, sovereign frontend runtime, browser security headers, payload bounds, tamper detection and non-root container execution are now test- or CI-proven. Production remains on HOLD because the canonical Genesis Veille product still requires external Big4 review and retains broader product-level gates beyond this World State slice.

## Verified executable chain

`Source Registry → Provenance Gate → Durable Accepted Event Ledger → Country World State → Risk/Opportunity scoring → FastAPI → sovereign public Africa 54/54 cockpit`

## Fresh verification evidence — run #94

Backend control job completed successfully:
- **31 passed, 0 failed**;
- `python -m pip check`: PASS — no broken requirements;
- `python -m compileall -q app`: PASS;
- application-path secret pattern scan: PASS;
- provenance negative/positive cases: PASS;
- API access-control and input-validation cases: PASS;
- source integrity and event idempotence: PASS;
- persistent repository and application restart recovery: PASS;
- SQLite backup/restore: PASS;
- direct payload tamper detection: PASS;
- frontend sovereignty contract: PASS;
- public response security-header contract: PASS;
- non-root Dockerfile contract: PASS.

Container integration job completed successfully:
- Docker image build: PASS;
- persistent Docker volume creation: PASS;
- first container boot: PASS;
- runtime UID verified as **10001**, not root: PASS;
- `/health`: PASS;
- public cockpit `/`: PASS;
- authenticated source creation: PASS;
- authenticated event ingestion: PASS;
- state computed before restart: PASS;
- first container destroyed: PASS;
- second container created with the same durable volume: PASS;
- second-container runtime UID remains 10001: PASS;
- trusted source recovered: PASS;
- accepted event recovered: PASS;
- country `event_count` preserved after container replacement: PASS;
- cleanup: PASS.

## Durable ledger controls

v0.2 uses a SQLite-backed repository using Python standard-library persistence primitives for this release slice.

Controls:
- schema version ledger;
- WAL journal mode;
- `synchronous=FULL`;
- unique primary keys for source IDs and event IDs;
- canonical JSON serialization;
- SHA-256 payload integrity verification on read;
- constant-time digest comparison;
- direct tamper detection test;
- duplicate event rejection;
- conflicting source trust-metadata rejection;
- restart recovery by hydrating registry and World State from accepted durable records;
- native SQLite backup and restore test;
- default container state path `/data/genesis-world-state.db`;
- Docker `/data` volume boundary.

Important limitation: the SHA-256 digest is an integrity check against accidental or partial mutation, not an external cryptographic attestation against a privileged database writer. External signed evidence / WORM anchoring remains a later governance layer.

## Sovereign frontend and browser controls

The previous runtime dependency on third-party mapping libraries and external map tiles has been removed.

The cockpit now:
- ships as self-contained HTML/CSS/JavaScript inside the product container;
- uses an internal Africa 54/54 coordinate field;
- performs no third-party runtime map fetch;
- requires no CDN script or stylesheet;
- preserves relative same-origin API calls;
- presents degraded mode instead of fabricating live values;
- renders event text through DOM `textContent`;
- emits `X-Content-Type-Options: nosniff`;
- emits `X-Frame-Options: DENY`;
- emits `Referrer-Policy: no-referrer`;
- disables camera, microphone and geolocation through `Permissions-Policy`;
- emits a same-origin Content Security Policy with `frame-ancestors 'none'` and `object-src 'none'`.

Residual CSP note: because the cockpit remains a single self-contained HTML artifact, inline style/script directives are currently allowed. A later static-asset split can remove this exception and move to nonce/hash-based CSP.

## Ingest abuse-resistance controls

- source IDs are bounded to 128 characters;
- source names are bounded to 256 characters;
- source type and licence class are bounded to 64 characters;
- event IDs are bounded to 128 characters;
- event types are bounded to 64 characters;
- titles are bounded to 512 characters;
- source cardinality per event is bounded to 16;
- corroboration count is bounded to 16;
- summary is bounded to 4,000 characters;
- sector is bounded to 128 characters;
- per-source IDs in an event are bounded to 128 characters.

These model bounds reduce trivial storage-amplification abuse. Internet-scale request-body limits, distributed rate limiting and concurrency policy remain deployment/gateway controls rather than claims of this application slice.

## Container least privilege

- image declares dedicated `genesis` system user/group UID/GID 10001;
- `/data` ownership is assigned before switching user;
- runtime uses `USER genesis`;
- CI verifies the actual running UID is 10001 before and after container replacement;
- persistent volume write/recovery remains successful under non-root execution.

## Existing S7+ controls retained

- public read / private write separation;
- `X-Genesis-Ingest-Key` / `GENESIS_INGEST_KEY` for writes;
- ingestion disabled when the key is absent or empty;
- constant-time credential comparison;
- unknown or inactive sources rejected;
- sensitive events require two distinct sources and corroboration count >= 2;
- explicit provenance: `VERIFIED`, `CORROBORATED`, `OBSERVATION_ONLY`, `REJECTED`;
- rejected events do not enter the accepted-event ledger;
- duplicate events cannot inflate country scores;
- source trust metadata cannot be silently overwritten;
- no person tracking, biometric targeting, covert collection or offensive action capability in this slice.

## ECES traceability

The scoped threat model documents protected assets, trust boundaries, abuse cases, security invariants, residual risks and Big4 handoff conditions. Automated evidence now covers missing/wrong/empty credentials, contradictory trust changes, unknown source, sensitive single-source rejection, corroboration acceptance, low-confidence observation-only behavior, double execution/idempotence, payload tampering, restart recovery, backup/restore, dependency-free frontend runtime, browser security headers, bounded ingestion and runtime least privilege.

This does **not** change the canonical product-level `Conformité ECES` field by assertion. The catalogue remains authoritative; the World State slice is now materially prepared for the required external review and for re-evaluation of that product-level status.

## Rollback / recovery

Code rollback:
- revert the PR/commits to the previously verified version.

State recovery:
- persistent state lives outside the container image under the `/data` volume boundary;
- restart recovery and container replacement recovery are CI-proven;
- SQLite backup → reopen → restore behavior is unit-tested.

Before any future schema change, a versioned migration and rollback gate is required. v0.2 performs no destructive schema migration.

## M8 remaining production gates

The World State v0.2 technical slice is ready for controlled integration and external review. It is **not certified for production publication** because the canonical product still requires:

1. external Big4 review and product-level ECES re-evaluation;
2. broader Genesis Veille real-time search/crawler production restoration;
3. monetization/payment readiness where required by the canonical commercial release;
4. deployment-gateway evidence for distributed rate/body-size controls, monitoring and platform IAM;
5. final EGREED Deploy / DNS / HTTPS / official URL verification through authorized external infrastructure.

## Next automatic loop

`ECES evidence sync → real-time connector/crawler asset discovery → controlled ingestion adapter → connector provenance tests → M6/S7+ regression → M8/Big4 handoff → Release Center package → authorized EGREED/DNS deployment boundary`.
