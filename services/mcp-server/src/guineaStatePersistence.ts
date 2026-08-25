import {
  validateGovernmentEvent,
  type GovernmentEvent
} from "./guineaDigitalStateControl.js";

export interface SqlQueryResult<T = Record<string, unknown>> {
  rowCount: number | null;
  rows: T[];
}

export interface SqlExecutor {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<SqlQueryResult<T>>;
}

export interface PersistenceReceipt {
  stored: boolean;
  idempotent: boolean;
  eventId: string;
  audit: {
    ledgerId: string;
    payloadHash: string;
    recordedAt: string;
  };
}

export interface PersistenceStatus {
  configured: boolean;
  state: "CONFIGURED" | "UNCONFIGURED";
}

interface AuditReceiptRow {
  ledger_id: string;
  payload_hash: string;
  recorded_at: string | Date;
}

export function getGuineaPersistenceStatus(
  env: Record<string, string | undefined>
): PersistenceStatus {
  const configured = Boolean(env.GENESIS_GUINEA_DATABASE_URL?.trim());
  return {
    configured,
    state: configured ? "CONFIGURED" : "UNCONFIGURED"
  };
}

function normalizeRecordedAt(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

export async function persistGovernmentEvent(
  executor: SqlExecutor,
  event: GovernmentEvent
): Promise<PersistenceReceipt> {
  const validation = validateGovernmentEvent(event);
  if (!validation.ok) {
    throw new Error(`GUINEA_PERSISTENCE_INVALID_EVENT: ${validation.errors.join(", ")}`);
  }

  try {
    await executor.query("begin");

    const insert = await executor.query(
      `insert into genesis_guinea_state.government_events (
        event_id,
        source_system,
        institution_id,
        service_id,
        actor_type,
        occurred_at,
        country_code,
        correlation_id,
        classification,
        legal_basis,
        data_residency,
        evidence_hash,
        payload
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
      on conflict (event_id) do nothing`,
      [
        event.eventId,
        event.sourceSystem,
        event.institutionId,
        event.serviceId,
        event.actorType,
        event.timestamp,
        event.countryCode,
        event.correlationId,
        event.classification,
        event.legalBasis,
        event.dataResidency,
        event.evidenceHash,
        JSON.stringify(event)
      ]
    );

    const receiptResult = await executor.query<AuditReceiptRow>(
      `select ledger_id, payload_hash, recorded_at
       from genesis_guinea_state.audit_ledger
       where record_type = $1 and record_id = $2
       order by recorded_at desc
       limit 1`,
      ["government_events", event.eventId]
    );

    const receipt = receiptResult.rows[0];
    if (!receipt) {
      throw new Error("GUINEA_PERSISTENCE_RECEIPT_MISSING");
    }

    await executor.query("commit");

    const stored = insert.rowCount === 1;
    return {
      stored,
      idempotent: !stored,
      eventId: event.eventId,
      audit: {
        ledgerId: receipt.ledger_id,
        payloadHash: receipt.payload_hash,
        recordedAt: normalizeRecordedAt(receipt.recorded_at)
      }
    };
  } catch (error) {
    try {
      await executor.query("rollback");
    } catch {
      // Preserve the original failure. Rollback failure is intentionally not hidden by a mock success.
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`GUINEA_PERSISTENCE_FAILED: ${message}`);
  }
}
