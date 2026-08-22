# Genesis Veille Engine — World State Core v0.2 — M6 / S7+ / M8 Evidence Pack

Date: 2026-08-22
Canonical product: **Genesis Veille Engine SaaS** (`PRD-VEILLE-001`)
Repository: `lanickbusiness1/newlife`
Branch: `feature/genesis-veille-world-state-v1`
Pull request: #49
Verified control head: `1ac12efaf9e784b11b8a7bff723aea63e32876ee`
Application audit commit: `739be4feaf85aca2a63644e609d945dfb7083c0b`
GitHub Actions run: `32554430047` (run #144)
Threat model: `docs/security/2026-08-22-genesis-veille-world-state-v0.2-threat-model.md`

## Decision summary

- **M6 technical gate:** PASS
- **S7+ scoped code / security / integrity gate:** PASS
- **ECES World State scoped control pack:** TEST_PROVEN / ready for external review
- **Governed public HTTP transport:** TEST_PROVEN
- **Durable registered-URL scheduler:** TEST_PROVEN
- **Append-only control audit ledger:** TEST_PROVEN
- **M8 controlled integration / Big4 review:** GO
- **M8 production deployment:** HOLD

## Verified executable chain

`Registered Source → Durable Crawl Target → Due Selection → HTTPS/SSRF/robots/content controls → Connector Observation → content hash → Classifier → Provenance Gate → Accepted Event Ledger → Country World State → freshness/backoff → Append-only Audit Evidence`.

This is a governed durable registered-URL polling control plane. It is not yet unrestricted web discovery and it does not start an unattended network worker merely because the application boots.

## Fresh verification evidence — run #144

Backend control job:
- **62 passed, 0 failed**;
- `pip check`: PASS;
- Python compile: PASS;
- application secret-pattern scan: PASS.

Live transport job:
- production `SafeHttpTransport` executed against `https://example.org/`;
- HTTPS extraction succeeded;
- technical target only; no insertion into canonical intelligence state;
- job PASS.

Container integration job:
- build PASS;
- runtime UID 10001 / non-root PASS;
- persistent volume PASS;
- health/public shell PASS;
- source/event durable writes PASS;
- `SOURCE_REGISTER` and `EVENT_INGEST` audit evidence present before replacement;
- deterministic `stop → rm → recreate` PASS;
- source/event/country state recovered PASS;
- `SOURCE_REGISTER` and `EVENT_INGEST` audit evidence recovered from the same durable volume after replacement PASS.

## State schema v3 and audit ledger

Schema v3 is additive over v2 and adds `audit_records` without deleting source, event or crawl-target state.

Test-proven controls:
- v1 → v2 → v3 migration path;
- direct v2 → v3 migration;
- empty audit-state v3 → v2 rollback;
- rollback refuses to discard existing audit evidence;
- audit records are append-only: duplicate audit IDs are rejected;
- canonical JSON + SHA-256 integrity verification;
- direct audit payload tampering is detected;
- private `GET /api/v1/audit` control surface;
- bounded action/outcome/resource/reason/source/target/details model;
- write credentials are never stored in audit payloads;
- failed authentication records `AUTHORIZATION / DENIED` with route and reason only;
- source registration records distinct `ATTEMPTED` then terminal `SUCCEEDED` or `DENIED` evidence;
- event ingestion records attempt and provenance-dependent outcome;
- connector disabled/failed/success decisions are auditable;
- scheduler disabled/attempted/terminal summaries are auditable;
- audit ledger persists across real container replacement.

The ledger is append-only at the application contract level. A privileged database writer could still alter payload and digest together; signed/WORM anchoring remains a later defense-in-depth control.

## Durable registered-URL polling

- schema v2 crawl targets preserved under schema v3;
- target state includes cadence, due time, last attempt/success, failure count, last content SHA-256 and last error;
- due selection is deterministic;
- unchanged content does not duplicate World State events;
- changed observations still pass through `ProvenanceGate`;
- failure backoff is persistent and bounded;
- target list/create and scheduler tick are private controls;
- durable storage is mandatory;
- `GENESIS_HTTP_CONNECTOR_ENABLED=false` by default;
- `GENESIS_CRAWL_SCHEDULER_ENABLED=false` by default;
- no implicit background crawl loop.

## Public HTTP security boundary

- exact registered host + crawlable licence required;
- HTTPS only;
- credentials/fragments/non-default ports rejected;
- localhost/non-global literal and DNS-resolved addresses rejected;
- redirects manually revalidated and bounded;
- robots.txt evaluated;
- MIME and payload sizes bounded;
- connector output is observation, never accepted evidence by itself;
- sensitive single-source observations remain rejected.

## Persistent-state and recovery controls

- SQLite WAL + `synchronous=FULL`;
- canonical JSON/SHA-256 checks for source/event/target/audit records;
- backup/restore test;
- durable `/data/genesis-world-state.db` boundary;
- non-root container runtime;
- application restart and full container replacement recovery CI-proven.

## M8 remaining production gates

Production remains HOLD because the following remain open product-wide or deployment-side:

1. scheduler execution lease/lock preventing concurrent duplicate ticks;
2. production trigger/worker identity, monitoring and freshness SLOs;
3. governed discovery/search beyond explicitly registered URLs;
4. gateway rate/body/concurrency controls, platform IAM, encrypted off-host backups and restore drill;
5. SBOM/container vulnerability evidence and external Big4/product-level ECES re-evaluation;
6. monetization/payment readiness where required;
7. EGREED Deploy, DNS, HTTPS and official public URL verification through authorized infrastructure.

## Next automatic loop

`Scheduler execution lease → monitoring/freshness → discovery governance → M6/S7+ regression → evidence sync → Big4 handoff → Release Center → authorized deployment boundary`.
