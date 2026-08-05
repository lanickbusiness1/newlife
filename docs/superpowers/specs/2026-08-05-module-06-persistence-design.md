# MODULE 06 Persistence & Institutional Readiness Design

## Status

Approved continuation of `MODULE 06 — Local Content, Workforce & Value Retention Intelligence™` on branch `feature/mining-local-content-module-06`.

## Objective

Replace the in-memory-only runtime path with transaction-safe PostgreSQL adapters while preserving the existing domain invariants, human approval gates, tenant isolation, append-only audit, idempotency and emergency-stop controls.

## Scope

This increment delivers:

1. an asynchronous `LocalContentRepository` port;
2. an explicit transaction boundary used by every mutating service command;
3. a PostgreSQL repository implementation for rules, workforce records, assessments, succession plans, audit trail and Mission Control counts;
4. PostgreSQL-backed idempotency and tenant emergency-stop adapters;
5. non-owner application-role integration tests proving RLS and tenant isolation;
6. CI execution against ephemeral PostgreSQL 16.

This increment does not deliver a cockpit, real employee data, a production identity provider, legal-source approval, deployment or a production-readiness claim.

## Architecture

### Domain and service boundary

Business rules remain in `mining-local-content.ts` and `mining-local-content-service.ts`. SQL code must not contain legal-compliance calculations or HR decision logic.

The repository port becomes asynchronous. All service operations return promises. Mutating service methods execute repository writes and their audit event in one transaction through:

```ts
export interface LocalContentRepository {
  transaction<T>(work: (repository: LocalContentRepository) => Promise<T>): Promise<T>;
  // asynchronous persistence methods
}
```

The in-memory adapter implements `transaction` as a deterministic atomic snapshot/restore boundary for tests. The PostgreSQL adapter uses a dedicated client with `BEGIN`, `SET LOCAL app.tenant_id`, `COMMIT` and `ROLLBACK`.

### PostgreSQL adapter

`PostgresLocalContentRepository` receives a narrow pool interface compatible with `pg.Pool`. It never opens a global connection. Each operation is tenant-scoped and uses parameterized SQL.

Domain objects are rehydrated through dedicated mapping functions. Database-generated timestamps are not used to alter domain versioning. Duplicate-key and missing-row conditions map to `ControlError` without leaking SQL details.

### Tenant isolation

Every transaction sets `app.tenant_id` from the authenticated tenant before querying tenant-owned tables. Integration tests use a non-owner role so `FORCE ROW LEVEL SECURITY` is exercised rather than bypassed by the table owner.

No repository method accepts a tenant identifier inferred from request payloads. Tenant identifiers come from authenticated context and domain objects already validated by the service.

### Persistent security adapters

`PostgresIdempotencyStore` implements the existing `IdempotencyStore` port using `local_content_idempotency_keys`. Inserts are conflict-safe. Reuse of a key with a different request hash remains rejected by the API layer.

`PostgresEmergencyStopGuard` reads `local_content_module_controls` for the authenticated tenant. A fail-closed database error returns a controlled 503 decision.

Audit events are inserted only through the repository transaction that performs the governed mutation. The database trigger continues to prevent update and delete operations.

## Data flow

```plain text
Verified bearer token
→ AuthContext
→ API validation and idempotency lookup
→ governed service command
→ repository transaction
→ SET LOCAL app.tenant_id
→ business row writes
→ append-only audit write
→ COMMIT
→ controlled HTTP response
```

On any persistence or audit failure:

```plain text
error
→ ROLLBACK
→ no partial business state
→ controlled service/API error
```

## Error handling

- SQL errors are never returned verbatim to API callers.
- Duplicate identities map to existing `ControlError` messages.
- Missing rows map to existing not-found controls.
- Transaction failures roll back all writes, including audit events.
- Idempotency-store or emergency-control unavailability fails closed.
- Invalid database rows cause a controlled hydration failure and no silent coercion.

## Testing strategy

1. Existing unit and HTTP tests are converted to await asynchronous service methods.
2. In-memory transaction tests prove rollback when audit append fails.
3. PostgreSQL integration tests prove create/read/update flows and Mission Control counts.
4. A forced audit failure proves no partial business row remains.
5. Non-owner-role tests prove one tenant cannot read or write another tenant’s records.
6. Persistent idempotency tests prove replay, expiry and conflict behavior.
7. Persistent emergency-stop tests prove tenant-specific stop and resume behavior.
8. Full CI reruns type-check, all tests, migrations, SQL security tests and migration rollback.

## Acceptance criteria

- All existing tests remain green after asynchronous conversion.
- New PostgreSQL integration tests pass against PostgreSQL 16.
- A mutation and its audit event commit atomically.
- A forced audit failure leaves no business row.
- RLS blocks cross-tenant reads and writes using a non-owner application role.
- Persistent idempotency and emergency-stop adapters pass deterministic tests.
- No real personal data, secrets or production credentials are committed.
- PR #9 remains draft and production remains NO-GO.