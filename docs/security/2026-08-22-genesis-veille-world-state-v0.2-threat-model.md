# Genesis Veille Engine — World State Core v0.2 — Threat Model

Date: 2026-08-22
Canonical product: **Genesis Veille Engine SaaS** (`PRD-VEILLE-001`)
Scope: World State Core v0.2 + governed public HTTP connector + durable scheduler + append-only audit evidence
Repository: `lanickbusiness1/newlife`
PR: #49
ECES reference: AfrIAgenesis® ECES™ 1.0 + Agentic Engineering & Coding Standard — ECES Anchored — v1.0

## Security objective

Preserve integrity, provenance, availability and accountability of public African intelligence state. Public clients must not mutate trusted sources, crawl targets, accepted events, scheduler policy or audit evidence. Outbound collection must not become a general-purpose network client, and control decisions must leave durable evidence without persisting credentials.

## Protected assets

- ingest credential;
- trusted Source Registry and explicit allowed hosts/licence state;
- durable crawl targets and freshness/backoff state;
- governed HTTP connector policy;
- accepted event ledger and derived Country World State;
- schema-v3 append-only audit evidence;
- persistent SQLite state and backup;
- sovereign Africa 54/54 cockpit;
- CI evidence informing M6/S7+/M8.

## Trust boundaries

1. **Public Internet → Read API:** anonymous read only.
2. **Controlled actor → Write/Control API:** authenticated source/event/target/connector/scheduler/audit controls.
3. **Scheduler → Target Registry:** only enabled due targets; scheduler disabled by default.
4. **Connector → Public network:** exact registered HTTPS host with DNS/redirect/robots/MIME/size controls; connector disabled by default.
5. **Observation → Trusted State:** mandatory `ProvenanceGate` before accepted-event insertion.
6. **Application → Persistent State:** source/event/target/audit canonical JSON + SHA-256.
7. **Container → Deployment Plane:** external secret/storage injection; non-root UID 10001.
8. **Engineering Evidence → Governance:** CI informs but never replaces Notion authority or Big4 review.

## Threat/control matrix

| ID | Threat | Current control | Residual / next control |
|---|---|---|---|
| T-01 | Unauthorized writes/control | authenticated routes; missing/wrong credential denied; constant-time compare | production workload identity/rotation |
| T-02 | Secret committed or leaked through audit | runtime injection; CI secret-pattern scan; audit never records supplied/expected secret | platform secrets manager + rotation evidence |
| T-03 | Source trust escalation | conflicting source trust metadata rejected and outcome auditable | governed source lifecycle/revocation |
| T-04 | Event replay inflates state | deterministic/unique event IDs | preserve across discovery adapters |
| T-05 | Sensitive misinformation accepted | two-source corroboration requirement | semantic source-independence later |
| T-06 | Unknown/inactive source accepted | registry/provenance/connector/scheduler checks | onboarding/revocation governance |
| T-07 | Observation treated as fact | provenance states + mandatory gate | downstream consumers must preserve provenance |
| T-08 | Stored XSS/browser abuse | `textContent`, CSP, frame denial, Permissions-Policy | remove inline CSP allowances later |
| T-09 | Third-party frontend compromise | no map/CDN/tile runtime | none known in current cockpit |
| T-10 | Persistent payload alteration | canonical JSON + SHA-256 + tamper tests | privileged writer can rewrite payload+digest; signed/WORM later |
| T-11 | Container loss loses state | `/data` persistence + replacement CI | provider volume SLA external |
| T-12 | Accidental state loss | SQLite backup/restore tests | encrypted off-host backup + restore drill |
| T-13 | Oversized/flooded requests | model/document bounds | gateway body/rate/concurrency controls |
| T-14 | Container privilege escalation | UID 10001 CI-proven | readonly FS/cap drop where supported |
| T-15 | Supply-chain compromise | pinned small dependency set + `pip check` | SBOM/vulnerability/base-image policy |
| T-16 | SSRF/private network access | HTTPS-only; exact host; DNS/global-IP checks | egress firewall/proxy defense-in-depth |
| T-17 | Redirect escapes policy | automatic redirects disabled; manual revalidation | cross-domain relationships explicit only |
| T-18 | Robots/licence bypass | robots evaluation + crawlable licence gate | source-specific legal onboarding |
| T-19 | Silent connector/scheduler activation | independent feature gates default false | production change-control evidence |
| T-20 | Unchanged document duplicates state | content SHA-256 state | richer normalization later |
| T-21 | Upstream failure hot-loop | persisted exponential backoff capped at 24h | jitter/circuit breaker at scale |
| T-22 | Concurrent scheduler workers double-execute targets | no implicit worker currently | **P0 next:** durable scheduler execution lease/lock |
| T-23 | Control action can be repudiated | schema-v3 append-only audit; attempt + terminal outcome; private audit API; container persistence | signed/WORM external anchoring later |
| T-24 | Audit tampering | SHA-256 verification + direct tamper test | privileged DB writer remains residual |
| T-25 | Audit leaks credential | bounded metadata only; auth denial excludes secret; automated no-secret test | centralized redaction policy if audit fields expand |
| T-26 | Audit ledger silently disappears on restart | audit evidence stored under same durable state boundary; container replacement verifies source/event traces survive | off-host audit replication/retention policy |
| T-27 | Audit growth becomes availability risk | bounded individual records | retention/export/rotation SLO needed before high-volume production |
| T-28 | Destructive schema downgrade | v3→v2 denied when audit exists; v2→v1 denied when crawl targets exist | stateful rollback through backup/restore |

## Automated and live evidence

Run #144 (`32554430047`) is fully GREEN.

Backend evidence: **62 passed, 0 failed**, dependency consistency, Python compilation and secret-pattern scan all PASS.

Coverage includes:
- auth failure audit without secret persistence;
- source `ATTEMPTED → SUCCEEDED/DENIED` evidence;
- connector/scheduler denied decisions;
- append-only duplicate audit rejection;
- audit SHA-256 tamper detection;
- v2→v3 migration and rollback refusal when audit evidence exists;
- private audit read endpoint;
- prior provenance, SSRF, DNS, redirects, robots, licence, scheduler, freshness/backoff and recovery controls.

Container smoke additionally proves `SOURCE_REGISTER` and `EVENT_INGEST` audit evidence exists before replacement and remains readable from the same persistent volume after a full stop/remove/recreate cycle.

The live transport job continues to prove real outbound HTTPS through `SafeHttpTransport` using `https://example.org/` as technical evidence only.

## Security invariants

1. Public read never implies public write/control.
2. Connector/scheduler code present never implies enabled.
3. Scheduler executes only persisted enabled/due targets.
4. Outbound access stays exact-host/HTTPS constrained.
5. Network documents remain observations until provenance acceptance.
6. Source trust cannot silently change.
7. Event replay/unchanged content cannot inflate World State.
8. Sensitive events cannot be accepted from one source.
9. Persistent payload/audit mutation must fail integrity verification.
10. Audit evidence must not contain ingest credentials.
11. Control actions produce durable attempt/outcome evidence where instrumented.
12. Application/container loss must not imply loss of accepted/audit state.
13. Schema downgrade must not silently discard crawl or audit state.
14. No outage path may fabricate live intelligence.
15. Production remains governed by ECES/M8/Big4.

## M8 / Big4 handoff position

**GO for controlled integration / Big4 external review; HOLD for production.**

Materially closed: persistent World State, sovereign frontend, public connector security, live transport, registered-URL scheduling, freshness/backoff/idempotence, schema migrations and append-only control auditability.

Remaining production gates:
- scheduler lease/lock and production worker identity/trigger;
- monitoring/freshness SLO and audit retention/export;
- governed discovery/search beyond registered URLs;
- gateway rate/body/concurrency controls;
- deployment IAM, encrypted off-host backup and restore drill;
- SBOM/container vulnerability evidence;
- product-level ECES re-evaluation + external Big4;
- monetization/payment and authorized production deployment gates.
