# Genesis Veille Engine — World State Core v0.2 — M6 / S7+ / M8 Evidence Pack

Date: 2026-08-22
Canonical product: **Genesis Veille Engine SaaS** (`PRD-VEILLE-001`)
Repository: `lanickbusiness1/newlife`
Branch: `feature/genesis-veille-world-state-v1`
Pull request: #49
Verified head commit: `01c254d56de3b225811f8fc53427ba32afa9a82e`
GitHub Actions run: `32547567697` (run #76)

## Decision summary

- **M6 technical gate:** PASS
- **S7+ scoped code / integrity gate:** PASS
- **M8 controlled integration / external review:** GO
- **M8 production deployment:** HOLD

The two P0 technical blockers recorded in the v0.1 evidence pack are now resolved. Production remains on HOLD because the canonical catalogue still requires external Big4 review and ECES remediation, and broader product gates (notably real-time search and payment/monetization readiness) are outside this World State slice.

## Verified executable chain

`Source Registry → Provenance Gate → Durable Accepted Event Ledger → Country World State → Risk/Opportunity scoring → FastAPI → sovereign public Africa 54/54 cockpit`

## Fresh verification evidence

GitHub Actions run #76 completed successfully on the verified head.

Backend test job:
- **26 passed, 0 failed**
- includes provenance, API, source integrity, event idempotence, persistent repository, application restart recovery, SQLite backup/restore, frontend contract, and sovereign frontend dependency checks.

Container integration job:
- Docker image build: PASS
- persistent Docker volume creation: PASS
- first container boot: PASS
- `/health`: PASS
- public cockpit `/`: PASS
- authenticated source creation: PASS
- authenticated event ingestion: PASS
- state computed before restart: PASS
- first container destroyed: PASS
- second container created with the same durable volume: PASS
- trusted source recovered: PASS
- accepted event recovered: PASS
- country `event_count` preserved after container replacement: PASS
- cleanup: PASS

## Durable ledger controls

v0.2 introduces a SQLite-backed repository using only Python standard-library persistence primitives for this release slice.

Controls:
- schema version ledger;
- WAL journal mode;
- `synchronous=FULL`;
- unique primary keys for source IDs and event IDs;
- canonical JSON serialization;
- SHA-256 payload integrity verification on read;
- constant-time digest comparison;
- duplicate event rejection;
- conflicting source trust-metadata rejection;
- restart recovery by hydrating registry and World State from accepted durable records;
- native SQLite backup and restore test;
- default container state path `/data/genesis-world-state.db`;
- Docker `/data` volume boundary.

Important limitation: the SHA-256 digest is an integrity check against accidental or partial mutation, not an external cryptographic attestation against a privileged database writer. External signed evidence / WORM anchoring is a later governance layer.

## Sovereign frontend controls

The previous runtime dependency on third-party mapping libraries and external map tiles has been removed.

The cockpit now:
- ships as self-contained HTML/CSS/JavaScript inside the product container;
- uses an internal Africa 54/54 coordinate field;
- performs no third-party runtime map fetch;
- requires no CDN script or stylesheet;
- preserves relative same-origin API calls;
- presents degraded mode instead of fabricating live values;
- renders event text through DOM `textContent` rather than interpolating untrusted event titles into HTML.

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
- no person tracking, biometric targeting, covert collection, or offensive action capability in this slice.

## Rollback / recovery

Code rollback:
- revert PR/commits to the previously verified v0.1 behavior.

State recovery:
- persistent state lives outside the container image under the `/data` volume boundary;
- restart recovery is CI-proven;
- SQLite backup → reopen → restore behavior is unit-tested.

Before any future schema change, a versioned migration and rollback gate is required. v0.2 does not perform destructive schema migrations.

## M8 remaining production gates

The World State v0.2 technical slice is ready for controlled integration and external review. It is **not certified for production publication** yet because the canonical product record still requires:

1. external Big4 review;
2. ECES conformity remediation;
3. broader Genesis Veille real-time search/crawler production restoration;
4. monetization/payment readiness where required by the canonical commercial release;
5. final EGREED Deploy / DNS / HTTPS / official URL verification through authorized external infrastructure.

## Next automatic loop

`Evidence pack → PR ready for external review → Notion sync → ECES/security hardening → real-time ingestion/search integration → M6/S7+ regression → M8 external review → Release Center package → EGREED/DNS deployment boundary`.
