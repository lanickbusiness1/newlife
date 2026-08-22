# Genesis Veille Engine — World State Core v0.2 — Threat Model

Date: 2026-08-22
Canonical product: **Genesis Veille Engine SaaS** (`PRD-VEILLE-001`)
Scope: World State Core v0.2 + governed public HTTP connector
Repository: `lanickbusiness1/newlife`
PR: #49
ECES reference: AfrIAgenesis® ECES™ 1.0 + Agentic Engineering & Coding Standard — ECES Anchored — v1.0

## 1. Security objective

Preserve integrity, provenance and availability of public African intelligence state while ensuring that public users cannot modify trusted sources, connector policy, accepted events or derived country scores, and that outbound collection cannot be abused as a general-purpose network client.

This slice is public-intelligence infrastructure, not a system for person tracking, biometric identification, covert collection, offensive cyber operations or automated coercive action.

## 2. Protected assets

1. `GENESIS_INGEST_KEY` — write-ingress credential.
2. Trusted Source Registry — source identity, source type, licence class, reliability tier, active state and explicit `allowed_hosts`.
3. Governed HTTP connector policy — HTTPS/host/DNS/robots/redirect/content bounds.
4. Accepted Event Ledger — normalized events plus provenance decision.
5. Persistent SQLite state — source and accepted-event canonical payloads.
6. Derived Country World State — counts, provenance distribution, confidence, risk and opportunity scores.
7. Backup copy — recovery state.
8. Public cockpit — trusted presentation boundary for Africa 54/54.
9. CI evidence — tests, live transport evidence and container-replacement evidence used for M6/S7+/M8 decisions.

## 3. Trust boundaries

### TB-01 — Public Internet → Read API
Anonymous public clients can reach public read endpoints. Expected capability: read only.

### TB-02 — Controlled Ingestor → Write API
Only controlled ingest services possessing the ingest credential may register sources, ingest structured events or invoke the HTTP connector endpoint. Expected capability: submit bounded objects; never bypass provenance validation.

### TB-03 — Connector → Public Source Network
When explicitly enabled, the HTTP connector may fetch only HTTPS URLs whose exact host is registered on an active crawlable source. DNS results, redirects, robots policy, MIME type and payload size are re-evaluated before an observation is produced. The connector is disabled by default.

### TB-04 — Application → Persistent State
Only accepted source/event objects cross into durable `/data` state. A connector observation is not durable trusted intelligence until it passes `ProvenanceGate`.

### TB-05 — Container → Host / Deployment Plane
Secrets and durable storage are injected externally; application runtime is non-root UID 10001.

### TB-06 — Engineering Evidence → Governance
GitHub CI evidence informs M6/S7+/M8 but does not replace Notion canonical governance or external Big4 review.

## 4. Threats, controls and residual risk

| ID | Threat | Existing control | Residual / next control |
|---|---|---|---|
| T-01 | Unauthorized source/event/connector write | deny-by-default authenticated write routes; missing/empty ingest key disables writes; constant-time compare | shared secret remains; production should rotate and move toward workload/per-ingestor identity |
| T-02 | Credential committed to code | runtime environment injection; application-path secret-pattern scan in CI | repository/platform-wide secret management and rotation evidence at release gate |
| T-03 | Source trust escalation | conflicting source trust metadata rejected | source lifecycle/revocation audit remains operational governance |
| T-04 | Event replay inflates state | unique/deterministic event IDs; duplicate rejection | distributed discovery connectors must preserve deterministic identity strategy |
| T-05 | Sensitive misinformation enters accepted state | sensitive event requires two distinct registered sources and corroboration >=2 | semantic independence/mirror-source detection remains future control |
| T-06 | Unknown/inactive source accepted | connector and provenance gate reject unknown/inactive source | governed onboarding/revocation remains operational process |
| T-07 | Observation presented as verified fact | explicit provenance states; connector output passes ProvenanceGate | downstream consumers must preserve provenance semantics |
| T-08 | Stored XSS | DOM `textContent`, CSP/security headers, same-origin frontend | inline script/style allowance remains until static-asset split |
| T-09 | Third-party frontend compromise | no third-party map/CDN/tile runtime | none known for current cockpit runtime |
| T-10 | Persistent payload alteration | canonical JSON + SHA-256 verification; tamper test | privileged DB writer can rewrite payload+digest; signed/WORM attestation later |
| T-11 | Container loss causes state loss | durable `/data`; deterministic container replacement CI | platform volume SLA remains external |
| T-12 | Accidental state loss | SQLite backup/restore test | encrypted scheduled backup + off-host restore drill required |
| T-13 | Clickjacking/browser capability abuse | frame denial, CSP, Permissions-Policy, no-referrer | keep synchronized with future capabilities |
| T-14 | MIME/content confusion | `nosniff`; connector MIME allowlist | richer document parsers require their own sandboxing later |
| T-15 | Oversized application/connector input | Pydantic bounds; source-list limits; connector byte limits | gateway request-body/rate/concurrency policy still required |
| T-16 | Request flood / DoS | bounded operations; authenticated writes; no expensive AI call in slice | reverse-proxy rate/concurrency limits + monitoring before internet-scale production |
| T-17 | Container privilege escalation | dedicated runtime UID 10001 proven in CI | readonly filesystem/capability dropping where platform permits |
| T-18 | Supply-chain compromise | small pinned Python set; `pip check`; frontend has no third-party runtime | SBOM, vulnerability scan and base-image policy still required |
| T-19 | Destructive mutation | no delete endpoint or destructive migration | scheduler schema migration requires versioned reversible migration gate |
| T-20 | Privacy/PII ingestion | public-intelligence scope; no private/health/biometric authorization | connector-level PII classifier/redaction policy not yet present |
| T-21 | Backend outage leads to fabricated intelligence | degraded mode; no fabricated live values | stale-data/freshness monitoring required |
| T-22 | SSRF to localhost/private/metadata service | HTTPS-only policy; blocks localhost/non-global literal IP; DNS result must be global | production egress firewall should independently enforce destinations |
| T-23 | DNS rebinding / public hostname resolves private | DNS checked before request; any non-global resolved address rejected | TOCTOU risk remains at OS resolver/connection layer; egress proxy/firewall is defense-in-depth |
| T-24 | Redirect escapes registered source | automatic redirects disabled; each redirect manually revalidated; exact host allowlist; bounded depth | future cross-domain source relationships must be explicitly registered, never inferred |
| T-25 | Robots/licence policy bypass | crawlable licence-class gate; robots.txt evaluated before fetch | legal/source-specific terms still require governed source onboarding |
| T-26 | Arbitrary huge/binary document fetched | MIME allowlist, Content-Length/read byte bounds, Accept-Encoding identity | PDF/media parsing is not authorized in this connector slice |
| T-27 | Connector silently activates | feature gate defaults false; global runtime requires `GENESIS_HTTP_CONNECTOR_ENABLED` | production change control must record any enablement |
| T-28 | Direct network result bypasses provenance | connector only returns observation; endpoint routes through existing `ConnectorPipeline`/`ProvenanceGate` | preserve this invariant for scheduler/discovery layers |

## 5. Automated and live evidence

Automated negative/positive evidence covers:
- missing/wrong/empty ingest credential;
- source trust overwrite attempt;
- unknown/inactive source;
- sensitive single-source rejection and corroborated acceptance;
- low-confidence observation-only status;
- replay/idempotence;
- payload tampering;
- process restart and full container replacement recovery;
- backup/restore;
- third-party frontend dependency prohibition;
- browser headers;
- bounded model inputs;
- non-root runtime;
- connector disabled-by-default behavior;
- HTTP/non-HTTPS restrictions;
- URL credentials/fragments/non-default ports;
- localhost/private/link-local targets;
- unregistered host;
- DNS non-global result rejection;
- redirect revalidation;
- licence and `allowed_hosts` enforcement;
- sensitive connector observation still subject to ProvenanceGate.

Fresh run #114 (`32553659471`) also proves a real outbound HTTPS fetch through `SafeHttpTransport` to `https://example.org/`, returning `text/html`, title `Example Domain` and 142 extracted characters. The target is technical evidence only and is not inserted into the intelligence ledger.

## 6. Data classification

World State v0.2 accepts only data suitable for a public-intelligence product. The schema does not authorize credentials, private humanitarian case data, health records, precise person location, biometric data or other special-category personal information.

Future connectors processing protected government/client/humanitarian/health data require a separate governed data boundary and cannot inherit the public-read policy of this slice.

## 7. Security invariants

1. Public read never implies public write.
2. Connector code present never implies connector enabled.
3. Outbound connector access is exact-host/HTTPS constrained and cannot intentionally target non-public addresses.
4. A network document is an observation, not evidence accepted into World State until ProvenanceGate passes.
5. `REJECTED` events never enter the accepted ledger.
6. Source trust metadata cannot silently change.
7. Event IDs cannot be counted twice.
8. Sensitive events cannot be accepted from one source.
9. Persistent payload alteration must fail integrity verification.
10. Loss of an application container must not imply loss of accepted state.
11. Frontend availability must not depend on third-party map runtime.
12. No outage path may fabricate live intelligence.
13. Production deployment remains externally governed under ECES/Big4.

## 8. M8 / Big4 handoff position

Current position: **GO for controlled integration and Big4 external review; HOLD for production**.

Closed or materially improved since the prior handoff: application field/list bounds, non-root runtime, secret-pattern scan, governed one-shot HTTP connector, public-network transport proof and deterministic container replacement.

Remaining technical/product-wide handoff items include:
- durable crawl-target scheduling/discovery/freshness/backoff operations;
- write-attempt and connector-decision auditability;
- gateway rate/body/concurrency controls and monitoring;
- deployment-platform IAM and encrypted backup/restore drill;
- SBOM/container vulnerability evidence;
- product-level ECES re-evaluation and external Big4 review;
- monetization/payment and authorized production deployment gates.
