# Genesis Veille Engine — World State Core v0.2 — Threat Model

Date: 2026-08-22
Canonical product: **Genesis Veille Engine SaaS** (`PRD-VEILLE-001`)
Scope: World State Core v0.2 + governed public HTTP connector + durable registered-URL scheduler
Repository: `lanickbusiness1/newlife`
PR: #49
ECES reference: AfrIAgenesis® ECES™ 1.0 + Agentic Engineering & Coding Standard — ECES Anchored — v1.0

## 1. Security objective

Preserve integrity, provenance and availability of public African intelligence state while ensuring that public users cannot modify trusted sources, crawl targets, connector policy, accepted events or derived country scores, and that outbound collection cannot be abused as a general-purpose network client or silently activated scheduler.

This slice is public-intelligence infrastructure, not a system for person tracking, biometric identification, covert collection, offensive cyber operations or automated coercive action.

## 2. Protected assets

1. `GENESIS_INGEST_KEY` — write-ingress credential.
2. Trusted Source Registry — identity, type, licence, reliability, active state and explicit `allowed_hosts`.
3. Durable Crawl Target Registry — URL, source relationship, country/type classification hints, cadence and operational freshness/backoff state.
4. Governed HTTP connector policy — HTTPS/host/DNS/robots/redirect/content bounds.
5. Accepted Event Ledger — normalized accepted events plus provenance decision.
6. Persistent SQLite state schema v2 — source, event and crawl-target payloads.
7. Derived Country World State.
8. Backup copy and schema rollback evidence.
9. Public Africa 54/54 cockpit.
10. CI evidence used for M6/S7+/M8 decisions.

## 3. Trust boundaries

### TB-01 — Public Internet → Read API
Anonymous clients may read public intelligence endpoints only.

### TB-02 — Controlled Ingestor → Write/Control API
Only actors possessing the ingest credential may register sources, create/list crawl targets, invoke one-shot connector ingestion or request a scheduler tick. Durable crawl-control endpoints are private.

### TB-03 — Scheduler → Crawl Target Registry
The scheduler executes only enabled, due targets already persisted in schema v2. It does not discover or invent destinations. Both scheduler and HTTP connector are independently disabled by default.

### TB-04 — Connector → Public Source Network
When explicitly enabled, the connector may fetch only HTTPS URLs whose exact host is registered on an active crawlable source. DNS, redirects, robots, MIME and size controls are applied before an observation exists.

### TB-05 — Observation → Trusted State
A network observation and its content hash are operational inputs, not accepted intelligence. Changed observations still cross `ProvenanceGate`; unchanged content never creates a new event.

### TB-06 — Application → Persistent State
Canonical source/event/target payloads are stored with SHA-256 integrity checks. State schema migration v1→v2 is additive.

### TB-07 — Container → Host / Deployment Plane
Secrets and durable storage are injected externally; runtime UID 10001 is non-root.

### TB-08 — Engineering Evidence → Governance
CI evidence informs gates but does not replace Notion canonical authority or Big4 review.

## 4. Threats, controls and residual risk

| ID | Threat | Existing control | Residual / next control |
|---|---|---|---|
| T-01 | Unauthorized source/event/connector/scheduler write | deny-by-default authenticated control routes; missing key disables writes; constant-time compare | shared secret remains; production workload identity/rotation needed |
| T-02 | Credential committed to code | runtime injection + application secret-pattern scan | platform secret-manager evidence/rotation at release gate |
| T-03 | Source trust escalation | conflicting source trust metadata rejected | source lifecycle/revocation audit needed |
| T-04 | Event replay inflates state | deterministic/unique event IDs | preserve identity across discovery adapters |
| T-05 | Sensitive misinformation accepted | two distinct sources/corroboration required | semantic source-independence remains future control |
| T-06 | Unknown/inactive source accepted | connector/provenance/scheduler target checks | governed onboarding/revocation process |
| T-07 | Observation shown as verified fact | explicit provenance; changed connector observations cross ProvenanceGate | downstream provenance semantics must remain intact |
| T-08 | Stored XSS | textContent + CSP/security headers | inline script/style allowance remains |
| T-09 | Third-party frontend compromise | no third-party map/CDN/tile runtime | none known in current cockpit |
| T-10 | Persistent payload alteration | canonical JSON + SHA-256 + tamper tests | privileged writer can rewrite payload+digest; signed/WORM later |
| T-11 | Container loss loses state | persistent `/data`, replacement CI | provider volume SLA external |
| T-12 | Accidental state loss | SQLite backup/restore test | encrypted off-host backup + restore drill |
| T-13 | Clickjacking/browser capability abuse | frame denial/CSP/Permissions-Policy | update with future features |
| T-14 | MIME/content confusion | nosniff + connector MIME allowlist | richer parsers need sandboxing |
| T-15 | Oversized input | Pydantic and connector bounds | gateway body/rate/concurrency controls |
| T-16 | Request flood/DoS | bounded operations and authenticated controls | reverse-proxy rate/concurrency + monitoring |
| T-17 | Container privilege escalation | runtime UID 10001 CI-proven | readonly FS/capability drop where supported |
| T-18 | Supply-chain compromise | pinned small Python set + pip check | SBOM/vulnerability/base-image policy required |
| T-19 | Destructive migration | v1→v2 additive; v2→v1 only allowed when no targets | stateful rollback must use preserved backup/restore |
| T-20 | Privacy/PII ingestion | public-intelligence scope | PII classifier/redaction not yet implemented |
| T-21 | Backend outage fabricates intelligence | degraded mode does not fabricate | freshness monitoring/SLOs required |
| T-22 | SSRF to local/private/metadata | HTTPS only; non-global literal/DNS IP rejected | egress firewall/proxy defense-in-depth |
| T-23 | DNS rebinding | DNS checked before request | resolver/connect TOCTOU remains; egress network control needed |
| T-24 | Redirect escapes source | manual bounded redirects + revalidation | cross-domain relationships must be explicit |
| T-25 | Robots/licence bypass | crawlable licence + robots evaluation | source-specific legal review on onboarding |
| T-26 | Huge/binary fetch | MIME and byte bounds | PDF/media parsing not authorized in this slice |
| T-27 | Connector silently activates | `GENESIS_HTTP_CONNECTOR_ENABLED` defaults false | production change control/audit required |
| T-28 | Network result bypasses provenance | observation only; pipeline/ProvenanceGate mandatory | preserve in discovery layers |
| T-29 | Scheduler silently activates | `GENESIS_CRAWL_SCHEDULER_ENABLED` defaults false; explicit private tick; no background loop | external production trigger must be authenticated/monitored |
| T-30 | Scheduler crawls arbitrary destination | targets must reference active source; exact host policy validated at registration and fetch | target modification lifecycle needs governed API/audit |
| T-31 | Unchanged content creates duplicate events | SHA-256 content state; unchanged result only advances schedule | canonicalization may need richer document-specific normalization later |
| T-32 | Upstream failure causes hot loop | persisted exponential backoff capped at 24h | add jitter/circuit breaker at production scale |
| T-33 | One bad target blocks all targets | scheduler isolates target execution failures | concurrency/lease model needed for multi-worker runtime |
| T-34 | Concurrent workers double-execute same due target | no implicit worker exists in this slice | P0 before production: durable lease/lock or single-writer scheduler runtime |
| T-35 | Crawl operational history can be repudiated | current target state stores latest attempt/success/error | P0 next: append-only audit ledger for attempts/decisions/outcomes |

## 5. Automated and live evidence

Run #128 (`32554091669`) proves **56 backend tests**, live public HTTPS transport and Docker recovery.

Automated evidence now includes:
- authentication failures and private scheduler-control routes;
- source trust overwrite rejection;
- unknown/inactive source;
- provenance/corroboration behavior;
- replay/idempotence;
- payload tampering;
- process/container restart and backup/restore;
- frontend sovereignty/browser headers;
- input bounds/non-root runtime;
- SSRF, DNS, redirect, robots, licence and allowed-host controls;
- connector disabled-by-default;
- schema v1→v2 migration;
- empty-state v2→v1 rollback and refusal to lose crawl targets;
- durable crawl target reopen recovery;
- deterministic due selection;
- changed-content success path;
- unchanged-content no-duplicate path;
- persisted failure/backoff state;
- scheduler disabled-by-default;
- controlled scheduler tick persisting event and target state.

The live transport job uses `https://example.org/` strictly as technical egress evidence; it is not a canonical intelligence source and is not persisted as World State evidence.

## 6. Data classification

This slice accepts only public-intelligence data. It does not authorize credentials, private humanitarian case data, health records, precise person location, biometric data or other special-category personal information. Protected-data connectors require a separate governed boundary.

## 7. Security invariants

1. Public read never implies public write/control.
2. Connector code present never implies connector enabled.
3. Scheduler code present never implies scheduler enabled.
4. Scheduler may execute only persisted enabled/due targets; it does not invent destinations.
5. Outbound access remains exact-host/HTTPS constrained.
6. Network documents remain observations until ProvenanceGate accepts them.
7. `REJECTED` events never enter the accepted ledger.
8. Source trust metadata cannot silently change.
9. Event IDs cannot be counted twice; unchanged crawl content cannot create duplicate state.
10. Sensitive events cannot be accepted from one source.
11. Persistent payload alteration must fail integrity verification.
12. Application/container loss must not imply accepted-state loss.
13. Schema downgrade must not silently discard crawl state.
14. Frontend availability must not depend on third-party map runtime.
15. No outage path may fabricate live intelligence.
16. Production remains governed by ECES/M8/Big4.

## 8. M8 / Big4 handoff position

Current position: **GO for controlled integration and Big4 external review; HOLD for production**.

Closed or materially improved: application bounds, non-root runtime, secret-pattern scan, governed HTTP connector, live transport proof, deterministic container replacement, durable crawl target model, additive migration, scheduler freshness/idempotence/backoff and private explicit scheduler control API.

Remaining technical/product-wide items:
- append-only write/connector/scheduler audit ledger;
- production scheduler lease/lock, trigger, monitoring and freshness SLOs;
- discovery/search beyond registered URLs;
- gateway rate/body/concurrency controls;
- deployment IAM/encrypted backup/restore drill;
- SBOM/container vulnerability evidence;
- product-level ECES re-evaluation and external Big4 review;
- monetization/payment and authorized production deployment gates.
