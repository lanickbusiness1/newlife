import { Pool, type PoolClient } from "pg";
import type { GovernmentEvent } from "./guineaDigitalStateControl.js";
import {
  getGuineaPersistenceStatus,
  persistGovernmentEvent,
  type PersistenceReceipt,
  type SqlExecutor
} from "./guineaStatePersistence.js";

let pool: Pool | undefined;

function getPool(env: NodeJS.ProcessEnv): Pool {
  const status = getGuineaPersistenceStatus(env);
  if (!status.configured) {
    throw new Error("GUINEA_PERSISTENCE_NOT_CONFIGURED");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: env.GENESIS_GUINEA_DATABASE_URL,
      max: 4,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      allowExitOnIdle: false
    });
  }

  return pool;
}

function asExecutor(client: PoolClient): SqlExecutor {
  return {
    async query<T = Record<string, unknown>>(text: string, params?: unknown[]) {
      const result = await client.query(text, params);
      return {
        rowCount: result.rowCount,
        rows: result.rows as T[]
      };
    }
  };
}

export async function persistGovernmentEventViaPostgres(
  event: GovernmentEvent,
  env: NodeJS.ProcessEnv = process.env
): Promise<PersistenceReceipt> {
  const client = await getPool(env).connect();
  try {
    return await persistGovernmentEvent(asExecutor(client), event);
  } finally {
    client.release();
  }
}

export async function closeGuineaPostgresPool(): Promise<void> {
  if (pool) {
    const active = pool;
    pool = undefined;
    await active.end();
  }
}
