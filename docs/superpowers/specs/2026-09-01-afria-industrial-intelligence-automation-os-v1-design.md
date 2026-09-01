# AfrIA Industrial Intelligence & Automation OS™ v1.0 — Design Specification

Date: 2026-09-01
Canonical asset: CAP-IND-AUTOMATION-001
Decision authority: V4-DEC-030 — Industrial Intelligence & Automation Capability Gate™
Repository: lanickbusiness1/newlife
Target path: apps/afria-industrial/
Status: DESIGN APPROVED — IMPLEMENTATION NOT STARTED

## 1. Purpose

AfrIA Industrial Intelligence & Automation OS™ v1.0 is a vendor-neutral industrial intelligence runtime for African factories, mines, utilities, ports, logistics sites, special economic zones, and other industrial infrastructure.

The v1.0 release proves one complete, controlled loop:

1. register industrial assets;
2. ingest or simulate time-series telemetry;
3. compute production and maintenance KPIs;
4. detect explainable anomalies;
5. surface alerts and site/line/machine state in a cockpit;
6. run an Industrial AI & Automation Readiness Assessment™;
7. preserve auditable evidence in a R.E.M.E-compatible ledger;
8. operate in an offline-first edge deployment pattern;
9. expose health, recovery, and rollback evidence.

This release is deliberately read-only with respect to industrial control equipment. It observes, analyzes, recommends, and proves. It does not issue PLC/PAC/robot commands.

## 2. Product Boundary

### Included in v1.0

- Industrial site, line, machine, sensor, and gateway registry.
- Deterministic industrial telemetry simulator.
- Time-series ingestion API.
- Abstract adapter contracts for MQTT and OPC UA read paths.
- Vendor-neutral normalized telemetry model.
- OEE, Availability, Performance, Quality, MTBF, MTTR, energy-per-unit, downtime, defect, and throughput calculations.
- Explainable anomaly detection using deterministic/statistical baseline methods suitable for local execution.
- Alert generation, acknowledgement state, severity, evidence, and provenance.
- Industrial Readiness Assessment scoring and recommendations.
- RBAC for viewer/operator/engineer/admin roles.
- Append-only evidence/audit ledger.
- Edge/offline-first buffering and deferred synchronization semantics.
- Healthcheck, liveness/readiness endpoints, degraded-mode indication, and recovery evidence.
- Frontend cockpit for assets, telemetry, KPIs, anomalies, alerts, energy, and readiness.
- Docker-based local/edge execution.
- Unit, integration, failure-mode, security, and acceptance tests.

### Explicitly excluded from v1.0

- PLC/PAC/robot write-back.
- Autonomous machine actuation.
- Safety-instrumented-system integration.
- Closed-loop process optimization.
- Computer-vision camera runtime in production; only an interface contract may exist.
- Vendor-specific proprietary drivers beyond mock/reference adapters.
- Production deployment to a real industrial site without a site-specific M6/S7+/M8 review.
- Claims of production savings, ROI, downtime reduction, or safety improvement without measured pilot evidence.

## 3. Architecture Decision

The product will live inside the existing `lanickbusiness1/newlife` monorepo, following the established AfrIA product pattern rather than introducing a separate repository or premature microservice split.

```text
apps/afria-industrial/
├── README.md
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── domain/
│   │   ├── services/
│   │   ├── adapters/
│   │   ├── persistence/
│   │   └── main.py
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── Dockerfile
├── simulator/
│   ├── scenarios/
│   ├── generator/
│   └── tests/
├── adapters/
│   ├── contracts/
│   ├── mqtt/
│   └── opcua/
├── docs/
│   ├── architecture.md
│   ├── threat-model-ot.md
│   ├── readiness-assessment.md
│   ├── runbook.md
│   ├── rollback.md
│   └── evidence-model.md
├── docker-compose.yml
└── acceptance/
    └── scenarios/
```

The backend remains a modular monolith for v1.0. Internal module boundaries must be explicit enough to permit future extraction, but no network microservices are created without demonstrated scaling or isolation need.

## 4. Core Domain Model

### Site
Represents an industrial operating location.

Required fields:
- site_id
- name
- country
- timezone
- industry
- operating_status
- data_residency_policy

### Line / Process Area
Represents a production line, utility process, conveyor chain, treatment process, or logical operating area.

Required fields:
- line_id
- site_id
- name
- process_type
- rated_capacity
- unit

### Asset
Represents a machine, PLC, motor, pump, conveyor, compressor, generator, meter, or other monitored equipment.

Required fields:
- asset_id
- site_id
- line_id
- asset_type
- manufacturer
- model
- criticality
- commissioning_date when known
- protocol_profile
- status

### Telemetry Point
Represents one normalized measurable signal.

Required fields:
- point_id
- asset_id
- metric
- unit
- timestamp
- value
- quality
- source
- provenance_id

### Production Event
Represents produced quantity, good quantity, reject quantity, planned time, run time, or downtime event.

### Anomaly
Required fields:
- anomaly_id
- asset_id
- metric
- detected_at
- method
- baseline
- observed_value
- deviation
- severity
- explanation
- evidence_refs

### Alert
Required fields:
- alert_id
- anomaly_id or rule_id
- site_id
- asset_id
- severity
- state
- raised_at
- acknowledged_at
- recommendation
- evidence_refs

### Evidence Record
Append-only record with:
- evidence_id
- event_type
- actor
- asset/site scope
- timestamp
- input_hash
- output_hash
- source_refs
- decision
- metadata

## 5. Telemetry and Adapter Model

All protocol integrations terminate in one normalized ingestion contract. The business logic never depends directly on a vendor SDK.

### Adapter contract

Each adapter must expose:

- `connect()`
- `health()`
- `discover_readable_points()`
- `read_batch()`
- `disconnect()`

No write method exists in the v1.0 adapter contract.

### v1.0 adapters

1. Simulator adapter — required and fully implemented.
2. MQTT read adapter — reference implementation or controlled integration path.
3. OPC UA read adapter — reference implementation or controlled integration path.

If third-party protocol libraries are unavailable in CI, the contracts and mocks remain testable and the production adapter is marked `PROVIDER_PENDING`; this must not block the simulator-backed acceptance release.

## 6. Simulator Design

The simulator is not decorative demo data. It is a deterministic industrial test harness.

Initial scenario set:

- healthy electric motor;
- bearing-temperature drift;
- pump cavitation-like vibration pattern;
- conveyor overload and micro-stops;
- energy inefficiency drift;
- quality/reject-rate degradation;
- network interruption and recovery;
- edge buffer growth while disconnected;
- delayed synchronization after reconnection.

Each scenario has:
- fixed seed;
- baseline period;
- fault injection timestamp;
- expected KPI effect;
- expected anomaly window;
- expected severity range;
- expected recovery behavior.

This enables reproducible acceptance tests.

## 7. KPI Engine

### OEE

`OEE = Availability × Performance × Quality`

Where:
- Availability = Run Time / Planned Production Time
- Performance = Actual Output / Theoretical Output for Run Time
- Quality = Good Units / Total Units

The engine must expose all three factors separately and reject mathematically invalid denominators rather than silently returning misleading percentages.

### MTBF

`MTBF = Operating Time / Number of Failures`

### MTTR

`MTTR = Total Repair Time / Number of Repairs`

### Energy per unit

`Energy per unit = Energy consumed / Good units`

Every KPI output must include:
- calculation period;
- source completeness;
- denominator validity;
- data-quality flag;
- evidence references.

No KPI may be labelled verified if required source data is incomplete.

## 8. Anomaly Engine

The first release prioritizes deterministic and explainable methods over opaque machine-learning claims.

Required baseline methods:
- threshold rule;
- rolling z-score;
- moving-average deviation;
- rate-of-change detection;
- missing-signal/staleness detection.

Each anomaly must explain:
- what changed;
- compared with which baseline;
- by how much;
- why severity was assigned;
- what input points were used.

Anomaly scoring must be pure and independently unit-testable.

The architecture may expose a future pluggable model interface, but no external AI model is required for v1.0 acceptance.

## 9. Readiness Assessment

Industrial AI & Automation Readiness Assessment™ produces a controlled score across these dimensions:

1. asset visibility;
2. instrumentation coverage;
3. protocol interoperability;
4. data quality;
5. OT network resilience;
6. cybersecurity baseline;
7. maintenance maturity;
8. energy/production observability;
9. edge/offline readiness;
10. governance and sovereignty;
11. skills and operating ownership;
12. measurable business-case readiness.

Each dimension returns:
- score;
- evidence status;
- gaps;
- risk;
- recommended action;
- estimated implementation horizon.

The overall result is not a generic maturity badge. It must clearly separate observed evidence from declared information and assumptions.

## 10. Frontend Cockpit

Primary screens:

### Fleet / Site Overview
- site health;
- active alerts;
- OEE summary;
- energy trend;
- data freshness;
- connectivity/degraded-mode state.

### Line / Process View
- line state;
- throughput;
- availability/performance/quality;
- downtime timeline;
- top anomalies.

### Asset View
- asset metadata;
- live/recent telemetry;
- anomaly timeline;
- health indicators;
- maintenance evidence.

### Alerts
- severity;
- source;
- explanation;
- acknowledgement;
- recommended operator action;
- evidence chain.

### Energy & Yield
- energy per unit;
- throughput;
- waste/rejects;
- trend comparison.

### Readiness Assessment
- dimension scores;
- evidence strength;
- gaps;
- recommended 90-day pilot plan.

The frontend must never present simulated data as real plant data. Simulation mode must be visibly labelled.

## 11. API Surface

Minimum endpoints:

- `GET /health/live`
- `GET /health/ready`
- `GET /system/mode`
- `POST /sites`
- `GET /sites`
- `POST /lines`
- `GET /lines`
- `POST /assets`
- `GET /assets`
- `POST /telemetry/batch`
- `GET /telemetry`
- `GET /kpis/site/{site_id}`
- `GET /kpis/line/{line_id}`
- `GET /kpis/asset/{asset_id}`
- `GET /anomalies`
- `GET /alerts`
- `POST /alerts/{alert_id}/acknowledge`
- `POST /readiness/assessments`
- `GET /readiness/assessments/{assessment_id}`
- `GET /evidence`
- `GET /sync/status`

All mutating endpoints require authenticated role checks. No endpoint for machine actuation exists.

## 12. RBAC

Roles:

### Viewer
Read dashboards, telemetry, KPIs, anomalies, readiness results.

### Operator
Viewer permissions plus alert acknowledgement and operational annotations.

### Engineer
Operator permissions plus asset metadata configuration, threshold configuration, and adapter configuration.

### Admin
Engineer permissions plus identity/role administration and site-level settings.

No role receives machine write privileges in v1.0 because the capability does not exist.

## 13. Evidence and R.E.M.E Compatibility

Every material state transition must be evidence-addressable.

The evidence ledger captures:
- configuration changes;
- asset registration;
- telemetry batch provenance;
- anomaly generation;
- alert acknowledgement;
- readiness assessment generation;
- sync interruption/recovery;
- health/degraded-mode transition;
- test and acceptance run summaries where practical.

Evidence records are append-only through the public application API. Administrative compaction, if ever introduced, is outside v1.0.

## 14. Offline-First and Synchronization

The edge runtime must remain useful during upstream connectivity loss.

Required behavior:
- local ingestion continues;
- local KPI calculation continues;
- local anomaly detection continues;
- local cockpit remains available;
- outbound synchronization queues records;
- queue state is observable;
- reconnect triggers ordered replay;
- duplicate events are idempotently rejected;
- conflicting metadata updates are explicitly surfaced, not silently overwritten.

The system must expose `ONLINE`, `DEGRADED`, and `OFFLINE_EDGE` modes.

## 15. Persistence

v1.0 must use a persistence abstraction so simulator/local development and future production deployments can differ.

Minimum logical stores:
- relational metadata store for sites/lines/assets/users/configuration;
- time-series capable telemetry store or a relational implementation that preserves time ordering for the proof release;
- append-only evidence store;
- local sync queue.

The first implementation may use PostgreSQL-compatible storage if it satisfies the acceptance workload. The design must not hard-code cloud-only services.

## 16. OT Security / S7+ Controls

Mandatory controls:
- read-only adapter boundary;
- no control-plane write endpoint;
- least-privilege RBAC;
- separate secrets/configuration per environment;
- structured audit logging;
- signed or hashed evidence records where applicable;
- input validation and bounded batch sizes;
- rate limiting for exposed APIs;
- secure defaults for CORS and network bind interfaces;
- no plaintext secrets in repository or images;
- dependency scanning in CI where available;
- explicit simulation/real-source provenance;
- documented backup/restore path;
- documented rollback path;
- fail-closed for unauthorized mutations;
- fail-safe UI behavior when telemetry is stale or incomplete.

Any future PLC write capability requires a separate architecture decision and safety review. It cannot be added as a small follow-up to this release.

## 17. Failure Modes

The implementation must explicitly handle:

### Telemetry source unavailable
- preserve previous state;
- mark source stale;
- stop claiming live data;
- raise data-quality alert after configured threshold.

### Database unavailable
- health readiness fails;
- ingestion returns controlled error or queues locally where supported;
- no silent data loss.

### Upstream sync unavailable
- switch to DEGRADED/OFFLINE_EDGE;
- queue outbound records;
- continue local analytics.

### Invalid telemetry
- reject malformed points;
- preserve batch-level error details;
- do not poison valid previously stored data.

### Clock skew
- identify suspicious timestamps;
- retain receipt timestamp separately;
- flag affected calculations when ordering is uncertain.

### Simulator fault
- test harness fails loudly;
- does not masquerade as plant failure.

## 18. Testing Strategy

Development is TDD-first.

### Unit tests
- KPI formulas and denominator edge cases;
- anomaly methods;
- readiness scoring;
- role permissions;
- idempotency;
- data-quality classification.

### Integration tests
- telemetry ingestion → persistence → KPI;
- telemetry → anomaly → alert → evidence;
- alert acknowledgement → evidence;
- readiness assessment → evidence;
- offline queue → reconnect → replay.

### Failure-mode tests
- network loss;
- upstream outage;
- stale telemetry;
- malformed payloads;
- duplicate batches;
- database recovery;
- clock skew.

### Security tests
- unauthorized mutations rejected;
- role boundary tests;
- oversize batch rejection;
- invalid source/provenance rejection;
- no actuation endpoints exposed.

### Acceptance scenario

A single command starts the stack. The simulator creates a site with representative assets and begins telemetry. A controlled anomaly is injected. The system must:

1. show the site and assets;
2. ingest telemetry;
3. calculate OEE/MTBF/MTTR/energy metrics;
4. detect the anomaly inside the declared expected window;
5. create an explainable alert;
6. preserve evidence;
7. survive an injected upstream network outage;
8. keep local analytics operational;
9. replay queued data after recovery;
10. generate a readiness assessment.

Passing this scenario plus the full automated test suite permits `TEST_PROVEN`. It does not permit `PRODUCTION_PROVEN`.

## 19. Deployment Model

### Local development
Docker Compose.

### Edge proof deployment
Docker Compose or equivalent container runtime on a single industrial edge host.

Required containers/logical processes:
- backend API;
- frontend;
- persistence;
- simulator in demo/test mode only.

Protocol adapters may run in-process for v1.0.

No external cloud dependency is mandatory for core local operation.

## 20. Observability

Required operational signals:
- API health;
- ingestion rate;
- rejected point count;
- data freshness;
- anomaly count by severity;
- alert backlog;
- sync queue depth;
- persistence latency/error count;
- adapter health;
- system mode.

Logs must be structured and must not include secrets.

## 21. Data Sovereignty

Default architecture assumes local industrial data remains locally processable.

Any synchronization outside the local/site environment must be policy-controlled and attributable by:
- destination;
- purpose;
- data class;
- retention;
- legal/contractual authority;
- encryption state;
- evidence record.

The v1.0 proof implementation should use synthetic data only unless a separate authorized data set is provided.

## 22. Commercial Wedge

The implementation supports the packaged service:

**Industrial AI & Automation Readiness Assessment™**

Target delivery: 10–20 days.

Outputs:
- OT/IT map;
- asset and protocol inventory;
- data-quality assessment;
- cyber baseline;
- AI use-case matrix;
- ROI/TCO assumptions;
- edge/offline architecture;
- 90-day pilot roadmap;
- prioritized evidence gaps.

The application is the execution and proof engine for that assessment, not a separate commercial product.

## 23. Release Gates

### M6 — Quality
Requires:
- reproducible build;
- automated test evidence;
- deterministic simulator acceptance;
- KPI formula verification;
- no known severity-1 functional defect;
- healthcheck and rollback documentation.

### S7+ — Security
Requires:
- RBAC tests;
- read-only OT boundary proof;
- secret scan;
- dependency review;
- threat model;
- failure-mode tests;
- no unsafe hidden control path.

### M8 — Governance
Requires:
- evidence completeness;
- economic viability assumptions separated from proof;
- sovereignty rules documented;
- production claims bounded;
- pilot conditions and external review triggers defined.

### External review
Required before any safety-critical or regulated real-site production deployment when the engagement risk profile triggers the external-review gate.

## 24. Release Truth States

Allowed progression:

`ARCHITECTURE` → `BUILDING` → `TEST_PROVEN` → `STAGING_READY` → `PILOT_READY` → site-specific review → `PRODUCTION_PROVEN`

The repository or catalogue must never claim `PRODUCTION_PROVEN`, `DEPLOYED`, or `DELIVERED_*` from simulation-only evidence.

## 25. Non-Functional Targets for v1.0 Proof

These are proof-release targets, not industrial SLA commitments:

- API health endpoint responds within 500 ms under acceptance workload.
- Normalized telemetry ingestion supports at least 100 points/second on the local acceptance environment.
- Dashboard data refresh target: 2–5 seconds in demo mode.
- Offline queue preserves ordering and idempotent replay.
- Acceptance stack starts from documented commands on a clean environment.
- All critical calculations are deterministic for the same input data.

Real-site capacity and SLA values must be benchmarked against target hardware before contractual use.

## 26. Implementation Sequence

The implementation plan must decompose work in this order:

1. repository skeleton and test harness;
2. core domain types and persistence contracts;
3. KPI engine;
4. deterministic simulator;
5. telemetry ingestion;
6. anomaly engine;
7. alert/evidence flow;
8. readiness assessment;
9. RBAC/security boundaries;
10. offline queue/sync semantics;
11. API composition;
12. frontend cockpit;
13. Docker/health/observability;
14. failure-mode tests;
15. full acceptance scenario;
16. M6/S7+/M8 evidence pack.

## 27. Definition of Done — v1.0

v1.0 is done only when all conditions are true:

- code exists in `apps/afria-industrial/`;
- automated tests pass;
- deterministic simulator acceptance passes;
- frontend demonstrates the complete observable flow;
- no machine-control write path exists;
- Docker execution is documented and reproducible;
- health/degraded/offline states are visible;
- evidence ledger captures required transitions;
- readiness assessment is generated from explicit evidence/assumptions;
- rollback and recovery procedures are documented;
- M6 and S7+ evidence is complete;
- M8 status is explicitly recorded;
- catalogue status is updated with the real proven state only.

## 28. Future Decisions Explicitly Deferred

Separate ADRs are required for:
- real PLC/PAC write-back;
- safety-related control loops;
- proprietary vendor SDKs;
- camera/vision runtime;
- multi-site cloud control plane;
- Kubernetes or distributed microservice architecture;
- regulated critical-infrastructure production deployment;
- formal predictive-maintenance ML model training on client data.

These are not implicit scope extensions of v1.0.
