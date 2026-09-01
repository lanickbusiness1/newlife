# Architecture — v1 proof runtime

`apps/afria-industrial/` is a modular monolith for one edge host. FastAPI owns API/application composition, SQLite WAL provides local persistence behind repository interfaces, React/Vite provides the cockpit, and deterministic simulator data uses the same normalized read path intended for MQTT and OPC UA providers.

Data flow: read-only adapter → normalized telemetry → SQLite WAL → KPI/anomaly services → alert/evidence services → API → cockpit. Outbound synchronization is optional and passes through a sovereignty-aware queue carrying destination, purpose, data class, retention, legal/contractual authority, and encryption state.

Local ingestion, KPI calculation, anomaly detection, cockpit reads, readiness scoring, and evidence generation do not require cloud connectivity. When upstream is unavailable, sync reports `OFFLINE_EDGE`, queues events in sequence, and replays idempotently. Identical IDs are duplicates; different payloads under the same ID are conflicts.

Mutations require environment-provisioned API keys and RBAC. Operator can acknowledge alerts; engineer can mutate registry, telemetry and readiness. CORS is allowlist-only with credentials disabled. Synthetic source remains `SIMULATOR`; MQTT/OPC UA placeholders remain `PROVIDER_PENDING` until real integration evidence exists.
