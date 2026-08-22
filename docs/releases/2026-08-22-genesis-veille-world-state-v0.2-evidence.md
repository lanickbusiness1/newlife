# Genesis Veille Engine — World State Core v0.2 — M6 / S7+ / M8 Evidence Pack

Date: 2026-08-22
Canonical product: **Genesis Veille Engine SaaS** (`PRD-VEILLE-001`)
Repository: `lanickbusiness1/newlife`
Branch: `feature/genesis-veille-world-state-v1`
Pull request: #49
Verified application/control commit: `67ad6cb46a0815d0260c70ba7667227218d6dbe6`
GitHub Actions run: `32553659471` (run #114)
Threat model: `docs/security/2026-08-22-genesis-veille-world-state-v0.2-threat-model.md`

## Decision summary

- **M6 technical gate:** PASS
- **S7+ scoped code / security / integrity gate:** PASS
- **ECES World State scoped control pack:** TEST_PROVEN / ready for external review
- **Governed public HTTP transport:** TEST_PROVEN
- **M8 controlled integration / external review:** GO
- **M8 production deployment:** HOLD

World State v0.2 now proves durable state, container replacement recovery, backup/restore, sovereign frontend runtime, browser security headers, payload bounds, tamper detection, non-root execution, a fail-closed public HTTP connector, and a real outbound HTTPS fetch through the same production transport class. This does **not** mean that product-wide real-time search/discovery, continuous crawl scheduling, monitoring operations or production publication are complete.

## Verified executable chain

`Registered Source → exact allowed host → HTTPS/SSRF/robots/content controls → Connector Observation → Classifier → Provenance Gate → Durable Accepted Event Ledger → Country World State → Risk/Opportunity scoring → FastAPI → sovereign public Africa 54/54 cockpit`

## Fresh verification evidence — run #114

Backend control job:
- **44 passed, 0 failed**;
- `python -m pip check`: PASS — no broken requirements;
- `python -m compileall -q app`: PASS;
- application-path secret pattern scan: PASS;
- provenance, API, source integrity, event idempotence, persistence, backup/restore, tamper detection, browser security, container contract and connector security tests: PASS.

Live public HTTP transport job:
- production `SafeHttpTransport` executed from the GitHub runner against `https://example.org/`;
- final URL: `https://example.org/`;
- content type: `text/html`;
- extracted title: `Example Domain`;
- extracted text length: `142` characters;
- job: PASS.

`example.org` is only a neutral technical network-evidence target. It is **not** a canonical AfrIAgenesis intelligence source and its content is not inserted into the World State ledger.

Container integration job:
- Docker image build: PASS;
- persistent volume creation: PASS;
- first container boot: PASS;
- runtime UID **10001 / non-root**: PASS;
- `/health` and public cockpit `/`: PASS;
- authenticated source/event writes: PASS;
- deterministic first-container stop and explicit removal: PASS;
- second container created with the same durable volume: PASS;
- source, accepted event and country state survived replacement: PASS;
- cleanup: PASS.

A prior run exposed a Docker lifecycle race caused by immediate name reuse after `docker stop` on a container started with `--rm`. The cause was isolated to CI orchestration, not the ledger or connector. The workflow now uses explicit `stop → rm → recreate`, and run #114 proves the corrected replacement path.

## Governed public HTTP connector

The public HTTP connector is part of the existing Genesis Veille Engine; it is not a new product or a parallel crawler.

Controls:
- connector endpoint: `POST /api/v1/connectors/http/ingest`;
- same authenticated ingest boundary as trusted writes;
- connector disabled by default;
- runtime enablement only through `GENESIS_HTTP_CONNECTOR_ENABLED`;
- source must exist and be active;
- source must declare an allowed crawl licence class;
- source must explicitly register one or more `allowed_hosts`;
- HTTPS only;
- URL credentials, fragments and non-default HTTPS ports rejected;
- localhost and non-global literal IPs rejected;
- DNS resolution checked and non-global resolved addresses rejected;
- redirect targets are revalidated and redirect depth is bounded;
- `robots.txt` policy is evaluated;
- supported MIME types are allow-listed;
- robots and document payload sizes are bounded;
- HTML/text extraction is bounded;
- final URL is revalidated against the same host policy;
- connector output is an observation, never a trusted fact by itself;
- every observation passes through the existing `ProvenanceGate` before ledger insertion;
- deterministic event IDs prevent replay from inflating country scores;
- sensitive single-source observations remain rejected by the existing provenance policy;
- fake-transport API tests prove the connector contract without requiring Internet access.

## Durable ledger controls

- schema version ledger;
- SQLite WAL journal mode;
- `synchronous=FULL`;
- unique primary keys for source IDs and event IDs;
- canonical JSON serialization;
- SHA-256 payload integrity verification on read;
- constant-time digest comparison;
- direct tamper detection test;
- restart hydration of registry and World State;
- native SQLite backup/restore test;
- default container state path `/data/genesis-world-state.db`;
- Docker `/data` persistent-volume boundary.

The SHA-256 digest is an integrity control, not external cryptographic attestation against a privileged database writer. Signed/WORM evidence anchoring remains a later governance layer.

## Sovereign frontend and browser controls

- self-contained HTML/CSS/JavaScript in the product container;
- internal Africa 54/54 coordinate field;
- no runtime third-party map, CDN script, stylesheet or tile server;
- same-origin API calls;
- degraded mode instead of fabricated live values;
- untrusted event text rendered through DOM `textContent`;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Referrer-Policy: no-referrer`;
- camera, microphone and geolocation disabled through `Permissions-Policy`;
- same-origin CSP with `frame-ancestors 'none'` and `object-src 'none'`.

Residual CSP note: the self-contained cockpit currently requires inline style/script allowances. A later static-asset split can move to nonce/hash CSP.

## Ingest abuse-resistance and least privilege

Application models bound source IDs, names, type/licence values, event IDs, event types, titles, source cardinality, corroboration count, summaries and sector values. Connector URL/document sizes are separately bounded. Internet-scale body limits, distributed rate limiting and concurrency controls remain deployment-gateway responsibilities.

The container runs as dedicated UID/GID 10001 with `/data` ownership assigned before switching user. CI verifies the real running UID and verifies durable volume recovery under that non-root identity.

## ECES traceability

Automated evidence covers authentication failures, contradictory trust mutation, unknown/inactive sources, sensitive single-source rejection, corroboration acceptance, low-confidence observation-only behavior, replay/idempotence, payload tampering, restart recovery, backup/restore, frontend sovereignty, browser headers, bounded ingestion, runtime least privilege, public-URL SSRF controls, allowed-host enforcement, licence gating, connector disabled-by-default behavior, and actual outbound HTTPS transport.

This scoped evidence does **not** overwrite the canonical product-level `Conformité ECES` status by assertion. Notion remains authoritative for product-wide conformity and Big4 review.

## Rollback / recovery

- code rollback: repository revert;
- accepted state is decoupled from the image under `/data`;
- application restart and full container replacement recovery are CI-proven;
- SQLite backup/restore is test-proven;
- v0.2 performs no destructive schema migration.

Any future persistent crawl-target scheduler requires an explicit schema-version/migration/rollback gate.

## M8 remaining production gates

The World State and one-shot governed public HTTP transport are ready for controlled integration and Big4 review. Production remains HOLD because the following are not yet fully proven product-wide:

1. durable crawl-target registry, scheduler, freshness/backoff state and continuous source operations;
2. search/discovery coverage beyond explicitly registered URLs;
3. write-attempt / connector-decision audit ledger and production monitoring;
4. deployment-gateway body/rate/concurrency policy, platform IAM, encrypted backup operations and restore drill;
5. SBOM/container vulnerability evidence and external Big4/product-level ECES re-evaluation;
6. monetization/payment readiness where required by the canonical commercial release;
7. EGREED Deploy, DNS, HTTPS and official public URL verification through authorized infrastructure.

## Next automatic loop

`Durable crawl-target model → versioned SQLite migration → deterministic scheduler tick → freshness/backoff/idempotence tests → controlled connector execution → M6/S7+ regression → evidence sync → Big4 handoff → Release Center → authorized deployment boundary`.
