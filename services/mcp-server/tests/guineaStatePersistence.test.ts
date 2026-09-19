import { describe, expect, test } from "vitest";
import type { GovernmentEvent } from "../src/guineaDigitalStateControl";
import {
  getGuineaPersistenceStatus,
  persistGovernmentEvent,
  type SqlExecutor,
  type SqlQueryResult
} from "../src/guineaStatePersistence";

const event: GovernmentEvent = {
  eventId: "evt-persist-001",
  sourceSystem: "xroad",
  institutionId: "ande",
  serviceId: "civil-status",
  actorType: "system",
  timestamp: "2026-08-24T09:10:00Z",
  countryCode: "GN",
  correlationId: "corr-persist-001",
  classification: "internal",
  legalBasis: "public-service-delivery",
  dataResidency: "GN",
  evidenceHash: "sha256:persist001"
};

class FakeSql implements SqlExecutor {
  calls: Array<{ text: string; params?: unknown[] }> = [];
  insertRowCount = 1;
  failOnInsert = false;

  async query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<SqlQueryResult<T>> {
    this.calls.push({ text, params });

    if (this.failOnInsert && text.includes("insert into genesis_guinea_state.government_events")) {
      throw new Error("synthetic-db-failure");
    }

    if (text.includes("insert into genesis_guinea_state.government_events")) {
      return { rowCount: this.insertRowCount, rows: [] as T[] };
    }

    if (text.includes("from genesis_guinea_state.audit_ledger")) {
      return {
        rowCount: 1,
        rows: [{
          ledger_id: "ledger-001",
          payload_hash: "hash-001",
          recorded_at: "2026-08-24T09:10:01.000Z"
        }] as T[]
      };
    }

    return { rowCount: null, rows: [] as T[] };
  }
}

describe("V4-DEC-018 Guinea sovereign persistence port", () => {
  test("reports persistence configuration without exposing the connection string", () => {
    expect(getGuineaPersistenceStatus({})).toEqual({ configured: false, state: "UNCONFIGURED" });
    expect(getGuineaPersistenceStatus({ GENESIS_GUINEA_DATABASE_URL: "postgres://secret" })).toEqual({
      configured: true,
      state: "CONFIGURED"
    });
  });

  test("persists a canonical event transactionally and returns its audit receipt", async () => {
    const sql = new FakeSql();

    await expect(persistGovernmentEvent(sql, event)).resolves.toEqual({
      stored: true,
      idempotent: false,
      eventId: "evt-persist-001",
      audit: {
        ledgerId: "ledger-001",
        payloadHash: "hash-001",
        recordedAt: "2026-08-24T09:10:01.000Z"
      }
    });

    expect(sql.calls[0]?.text).toBe("begin");
    expect(sql.calls.some((call) => call.text.includes("on conflict (event_id) do nothing"))).toBe(true);
    expect(sql.calls.some((call) => call.params?.[0] === "evt-persist-001")).toBe(true);
    expect(sql.calls.at(-1)?.text).toBe("commit");
  });

  test("treats duplicate event_id as idempotent and reuses the existing audit receipt", async () => {
    const sql = new FakeSql();
    sql.insertRowCount = 0;

    await expect(persistGovernmentEvent(sql, event)).resolves.toMatchObject({
      stored: false,
      idempotent: true,
      eventId: "evt-persist-001",
      audit: { ledgerId: "ledger-001" }
    });
  });

  test("fails closed and rolls back when persistence fails", async () => {
    const sql = new FakeSql();
    sql.failOnInsert = true;

    await expect(persistGovernmentEvent(sql, event)).rejects.toThrow("GUINEA_PERSISTENCE_FAILED");
    expect(sql.calls.at(-1)?.text).toBe("rollback");
  });
});
