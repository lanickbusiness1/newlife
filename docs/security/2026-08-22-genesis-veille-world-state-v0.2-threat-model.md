# Genesis Veille Engine — World State Core v0.2 — Threat Model

Date: 2026-08-22
Canonical product: **Genesis Veille Engine SaaS** (`PRD-VEILLE-001`)
Scope: World State Core v0.2 only
Repository: `lanickbusiness1/newlife`
PR: #49
ECES reference: AfrIAgenesis® ECES™ 1.0 + Agentic Engineering & Coding Standard — ECES Anchored — v1.0

## 1. Security objective

Preserve the integrity, provenance and availability of public African intelligence state while ensuring that public users can read the World State but cannot modify trusted sources, accepted events or derived country scores.

This slice is **public-intelligence infrastructure**, not a system for person tracking, biometric identification, covert collection, offensive cyber operations or automated coercive action.

## 2. Protected assets

1. `GENESIS_INGEST_KEY` — write-ingress credential.
2. Trusted Source Registry — source identity, source type, licence class, reliability tier and active state.
3. Accepted Event Ledger — normalized events plus provenance decision.
4. Persistent SQLite state — source and accepted-event canonical payloads.
5. Derived Country World State — counts, provenance distribution, confidence, risk and opportunity scores.
6. Backup copy — recovery state.
7. Public cockpit — trusted presentation boundary for Africa 54/54.
8. CI evidence — tests and container-replacement evidence used for M6/S7+/M8 decisions.

## 3. Trust boundaries

### TB-01 — Public Internet → Read API
Anonymous public clients can reach `/`, `/health`, `/api/v1/sources`, `/api/v1/events` and `/api/v1/world-state/countries/{iso3}`.

Expected capability: read only.

### TB-02 — Controlled Ingestor → Write API
Only controlled ingest services possessing the ingest credential may call `POST /api/v1/sources` and `POST /api/v1/events`.

Expected capability: submit bounded source/event objects; never bypass provenance validation.

### TB-03 — Application → Persistent State
The application writes accepted source/event objects to the `/data` persistence boundary.

Expected capability: append or idempotently register; no public deletion/update endpoint exists in v0.2.

### TB-04 — Container → Host / Deployment Plane
The product container must not assume trust in the host or deployment platform. Secrets and persistent storage are injected externally.

### TB-05 — Engineering Evidence → Governance
GitHub CI evidence informs M6/S7+/M8 but does not replace Notion canonical governance or external Big4 review.

## 4. Threats, controls and residual risk

| ID | Threat | Existing control | Residual / next control |
|---|---|---|---|
| T-01 | Unauthorized source/event write | deny-by-default write routes; `X-Genesis-Ingest-Key`; writes disabled if key missing/empty; constant-time compare | single shared secret remains; production should rotate and eventually use workload identity/per-ingestor credentials |
| T-02 | Ingest credential committed to code | production credential read from environment only | repository-wide secret scanning and deployment secret policy still required at release gate |
| T-03 | Source trust escalation by re-registering same ID | conflicting source trust metadata rejected with `409 SOURCE_ID_CONFLICT` | source lifecycle/revocation workflow must be governed separately |
| T-04 | Event replay inflates risk/opportunity | unique `event.id`; duplicate rejected with `409 DUPLICATE_EVENT_ID` | upstream deterministic event-id strategy required for distributed connectors |
| T-05 | Sensitive misinformation enters accepted state | sensitive event requires two distinct registered sources and corroboration count >= 2 | semantic independence of sources is not yet machine-proven; connector governance must avoid mirrored-source false corroboration |
| T-06 | Unknown/inactive source accepted | provenance gate rejects unknown/inactive source IDs | trusted source onboarding remains an operational governance process |
| T-07 | Low-confidence single-source observation presented as verified fact | explicit `OBSERVATION_ONLY`; cockpit displays provenance | editorial wording and downstream API consumers must preserve provenance semantics |
| T-08 | Stored XSS through event/source text | cockpit uses DOM `textContent` for event text; same-origin architecture; CSP/security headers | inline script/style requires CSP `'unsafe-inline'`; later split static assets and adopt nonce/hash CSP |
| T-09 | Third-party map/CDN compromise or outage | no runtime third-party map library, stylesheet, script or tile server | none for current frontend map runtime |
| T-10 | Database payload alteration/corruption | canonical JSON + SHA-256 digest; verification on read; tamper test | SHA-256 stored beside payload is not proof against privileged DB writer; later signed/WORM evidence anchoring required |
| T-11 | Container replacement loses intelligence state | `/data` durable boundary; CI destroys/replaces container and proves state recovery | deployment platform volume durability/backup SLA remains external |
| T-12 | Accidental state loss | SQLite native backup/restore test | scheduled encrypted backup, retention and off-host restore drill required in deployment environment |
| T-13 | Browser embedding/clickjacking | `X-Frame-Options: DENY`; CSP `frame-ancestors 'none'` | none known for this slice |
| T-14 | Browser capability abuse | Permissions-Policy disables camera, microphone and geolocation; referrer disabled | keep policy synchronized with future product capabilities |
| T-15 | MIME sniffing/content confusion | `X-Content-Type-Options: nosniff` | none known for current endpoints |
| T-16 | Oversized payload / storage exhaustion | Pydantic structural validation exists | **OPEN P0/P1 HARDENING:** explicit field/list size bounds and gateway/body-size/rate limits |
| T-17 | Request flood / denial of service | no expensive AI call in this slice; write credential reduces write surface | **OPEN:** reverse-proxy rate limit, concurrency/body-size limit and monitoring required before internet-scale production |
| T-18 | Container privilege escalation | container isolation exists | **OPEN HARDENING:** run application as non-root; readonly filesystem where platform permits |
| T-19 | Supply-chain dependency compromise | small pinned Python dependency set; frontend runtime has no third-party dependencies | base image digest/SBOM/vulnerability scan not yet release-proven |
| T-20 | Deletion or destructive mutation | no delete endpoint or destructive migration in v0.2 | future delete/migration operations require explicit human approval + reversible migration |
| T-21 | Privacy breach / PII ingestion | product scope is public intelligence, not personal intelligence | connector policy must reject unnecessary personal/sensitive data; no PII classifier exists yet |
| T-22 | Public data presented during backend outage | degraded mode; no fabricated fallback values | availability monitoring and stale-data timestamp should be added in later operational layer |

## 5. Abuse cases covered by current automated evidence

- missing ingest key → write refused;
- wrong ingest key → write refused;
- empty configured key → ingestion disabled;
- unknown source → event rejected;
- sensitive single-source event → rejected;
- corroborated sensitive event → accepted as `CORROBORATED`;
- low-confidence single-source event → `OBSERVATION_ONLY`;
- duplicate event → rejected without score inflation;
- source ID metadata overwrite attempt → rejected without trust downgrade/upgrade;
- direct accepted-event payload tampering → detected during repository read;
- process/application restart → state recovered;
- container destruction/replacement → state recovered from durable volume;
- backup → restore → source/event recovered;
- third-party frontend runtime dependency → prohibited by contract test;
- public cockpit response → security headers required by contract test.

## 6. Data classification

World State v0.2 accepts only data suitable for a public-intelligence product. The current schema does not authorize secrets, credentials, private humanitarian case data, health records, precise person location, biometric data or other special-category personal information.

Any future connector processing protected client, government, humanitarian or health data must use a separate governed data boundary and cannot inherit the public-read policy of this World State slice.

## 7. Security invariants

1. Public read must never imply public write.
2. `REJECTED` events never enter the accepted ledger.
3. A source ID cannot silently change trust metadata.
4. An event ID cannot be counted twice.
5. A sensitive event cannot be accepted from one source.
6. Persistent payload alteration must fail integrity verification.
7. Loss of an application container must not imply loss of accepted state.
8. Frontend availability must not depend on a third-party map runtime.
9. No outage path may fabricate live intelligence.
10. Production deployment remains human/external-review gated under ECES.

## 8. M8 / Big4 handoff position

Current position: **GO for controlled integration and external review; HOLD for production**.

Before Big4 handoff is considered technically complete, close or explicitly disposition at least:
- bounded request fields / list cardinality;
- non-root container execution;
- secret scanning / dependency and container vulnerability evidence;
- gateway rate/body-size policy;
- auditability of write attempts and accepted/rejected ingestion decisions;
- deployment-platform backup/restore and IAM evidence.

Production publication additionally remains blocked by the canonical Genesis Veille product gates: ECES remediation, real-time search/crawler readiness, commercial/payment readiness where applicable, and authorized EGREED Deploy + DNS + HTTPS + official URL verification.
