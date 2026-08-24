import type { GovernmentEvent } from "./guineaDigitalStateControl.js";

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

export function getGuineaPersistenceStatus(_env: Record<string, string | undefined>) {
  throw new Error("NOT_IMPLEMENTED");
}

export async function persistGovernmentEvent(
  _executor: SqlExecutor,
  _event: GovernmentEvent
): Promise<PersistenceReceipt> {
  throw new Error("NOT_IMPLEMENTED");
}
