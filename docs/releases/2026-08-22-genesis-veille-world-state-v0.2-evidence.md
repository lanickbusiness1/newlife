# Genesis Veille Engine — World State Core v0.2 — M6 / S7+ / M8 Evidence Pack

Date: 2026-08-22
Canonical product: **Genesis Veille Engine SaaS** (`PRD-VEILLE-001`)
Repository: `lanickbusiness1/newlife`
Branch: `feature/genesis-veille-world-state-v1`
Pull request: #49
Verified application/control commit: `a614ecf576b06f4474be2c995c139dc27de6e7ff`
GitHub Actions run: `32554091669` (run #128)
Threat model: `docs/security/2026-08-22-genesis-veille-world-state-v0.2-threat-model.md`

## Decision summary

- **M6 technical gate:** PASS
- **S7+ scoped code / security / integrity gate:** PASS
- **ECES World State scoped control pack:** TEST_PROVEN / ready for external review
- **Governed public HTTP transport:** TEST_PROVEN
- **Durable registered-URL crawl scheduler:** TEST_PROVEN
- **M8 controlled integration / external review:** GO
- **M8 production deployment:** HOLD

World State v0.2 now proves durable source/event state, an additive versioned state migration for crawl targets, deterministic scheduler ticks, content idempotence, failure backoff, governed private target/tick APIs, container replacement recovery, backup/restore, sovereign frontend runtime, browser security headers, bounded inputs, tamper detection, non-root execution, a fail-closed public HTTP connector, and a real outbound HTTPS fetch through the same production transport class.

This does **not** mean unrestricted web search, automatic source discovery, unattended production scheduling, platform monitoring or production publication are complete.

## Verified executable chain

`Registered Source → Durable Crawl Target → Due Selection → exact allowed host → HTTPS/SSRF/robots/content controls → Connector Observation → content hash → Classifier → Provenance Gate → Durable Accepted Event Ledger → Country World State → next_due/backoff state → cockpit`

## Fresh verification evidence — run #128

Backend control job:
- **56 passed, 0 failed**;
- `python -m pip check`: PASS;
- `python -m compileall -q app`: PASS;
- application-path secret pattern scan: PASS;
- migration, persistence, scheduler, scheduler API, connector, provenance, integrity, browser, container-contract and recovery tests: PASS.

Live public HTTP transport job:
- production `SafeHttpTransport` executed from the GitHub runner against `https://example.org/`;
- final URL `https://example.org/`;
- content type `text/html`;
- extraction succeeded;
- job PASS.

`example.org` remains a neutral technical network-evidence target only. It is not a canonical AfrIAgenesis intelligence source and is not inserted into the World State ledger.

Container integration job:
- Docker image build PASS;
- persistent volume PASS;
- runtime UID 10001 / non-root PASS;
- health/public shell PASS;
- authenticated durable write PASS;
- deterministic stop → explicit removal → recreate PASS;
- source/event/country state survived replacement PASS;
- cleanup PASS.

## Durable scheduler / schema v2

State schema advances additively from v1 to v2. v2 adds `crawl_targets` without deleting or rewriting existing source/event records.

Test-proven controls:
- automatic v1 → v2 migration;
- existing source/event tables preserved;
- empty-state v2 → v1 rollback supported and tested;
- rollback refuses to discard existing crawl targets;
- crawl target canonical JSON + SHA-256 integrity;
- persistent target recovery after repository reopen;
- deterministic due-target selection (`enabled` and `next_due_at <= now`);
- interval bounded between 300 seconds and 7 days;
- first successful changed document passes through the governed connector pipeline;
- successful content hash stored as SHA-256;
- unchanged content advances freshness state without duplicating World State events;
- failure count/error persisted per target;
- exponential backoff bounded to 24 hours;
- one target failure does not convert a network observation into trusted evidence.

Governed scheduler API:
- `GET /api/v1/crawl-targets` — private;
- `POST /api/v1/crawl-targets` — private, durable storage required, active registered source/licence/allowed-host policy required;
- `POST /api/v1/crawler/tick` — private and explicit;
- scheduler disabled by default with `GENESIS_CRAWL_SCHEDULER_ENABLED`;
- HTTP connector independently disabled by default with `GENESIS_HTTP_CONNECTOR_ENABLED`;
- no implicit application background loop is started merely by importing or booting the service.

This is therefore a **durable registered-URL polling control plane**, not yet unrestricted real-time web discovery.

## Governed public HTTP connector

- authenticated `POST /api/v1/connectors/http/ingest`;
- active registered source required;
- crawlable licence class and exact `allowed_hosts` required;
- HTTPS only;
- credentials/fragments/non-default ports rejected;
- localhost/non-global literal or DNS-resolved addresses rejected;
- redirect targets manually revalidated and bounded;
- robots.txt evaluated;
- MIME types and response sizes bounded;
- output is observation, never trusted fact;
- every changed observation still passes through `ProvenanceGate`;
- deterministic event identity prevents replay inflation;
- sensitive single-source observations remain rejected.

## Durable ledger / recovery controls

- SQLite WAL;
- `synchronous=FULL`;
- source/event unique primary keys;
- canonical JSON + SHA-256 verification;
- direct tamper test;
- restart hydration;
- native SQLite backup/restore test;
- persistent `/data/genesis-world-state.db` boundary;
- full container replacement recovery.

SHA-256 protects integrity against accidental/partial mutation, not against a privileged writer capable of rewriting both payload and digest. External signed/WORM attestation remains a later governance layer.

For schema rollback, only empty v2 crawl state can be downgraded directly. Once targets exist, safe rollback requires preserved backup/restore rather than destructive schema downgrade.

## Sovereign frontend / least privilege

- self-contained cockpit, internal Africa 54/54 coordinates;
- no third-party map/CDN/tile runtime;
- same-origin API calls;
- degraded mode never fabricates live values;
- untrusted text rendered through `textContent`;
- CSP/browser security headers;
- dedicated container UID/GID 10001 proven in CI.

## ECES traceability

Automated evidence now covers authentication, source trust mutation, unknown/inactive sources, provenance/corroboration, replay/idempotence, payload tampering, restart/backup/restore, frontend sovereignty, browser controls, input bounds, non-root execution, SSRF/DNS/redirect/robots/licence/host policy, connector feature gating, state schema migration, crawl-target persistence, due selection, content freshness/idempotence, failure backoff, private scheduler APIs and live outbound HTTPS transport.

This scoped evidence does **not** overwrite the canonical product-level `Conformité ECES` status by assertion. Notion remains authoritative for product-wide conformity and Big4 review.

## M8 remaining production gates

The registered-URL polling control plane is ready for controlled integration and Big4 review. Production remains HOLD because the following remain open product-wide or deployment-side:

1. durable audit ledger for write attempts, connector/scheduler decisions and outcomes;
2. production runtime trigger/worker with concurrency lease/lock, monitoring and freshness SLOs;
3. discovery/search coverage beyond explicitly registered URLs and governed source onboarding;
4. gateway request-body/rate/concurrency controls, platform IAM, encrypted backups and external restore drill;
5. SBOM/container vulnerability evidence and external Big4/product-level ECES re-evaluation;
6. monetization/payment readiness where required;
7. EGREED Deploy, DNS, HTTPS and official public URL verification through authorized infrastructure.

## Next automatic loop

`Audit ledger → scheduler execution lease/monitoring → discovery governance → M6/S7+ regression → evidence sync → Big4 handoff → Release Center → authorized deployment boundary`.
