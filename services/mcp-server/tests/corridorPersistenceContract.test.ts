import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");

function readMigration(fileName: string) {
  return readFileSync(resolve(repoRoot, "supabase/migrations", fileName), "utf8");
}

describe("V4-DEC-017 genesis_corridor persistence contract", () => {
  test("versions the exact live persistence migrations", () => {
    const foundation = readMigration("20260824014956_create_genesis_corridor_persistence_v1.sql");
    const fkIndexes = readMigration("20260824015129_index_genesis_corridor_evidence_foreign_keys.sql");

    expect(foundation).toContain("create schema if not exists genesis_corridor");
    expect(fkIndexes).toContain("corridor_evidence_evidence_idx");
    expect(fkIndexes).toContain("economic_components_evidence_idx");
    expect(fkIndexes).toContain("strategic_score_evidence_evidence_idx");
  });

  test("keeps corridor data outside exposed public schemas and denies frontend roles", () => {
    const sql = readMigration("20260824014956_create_genesis_corridor_persistence_v1.sql");

    expect(sql).toContain("revoke all on schema genesis_corridor from public");
    expect(sql).toContain("revoke all on schema genesis_corridor from anon");
    expect(sql).toContain("revoke all on schema genesis_corridor from authenticated");
    expect(sql).toContain("grant usage on schema genesis_corridor to service_role");
    expect(sql).toContain("revoke all on all tables in schema genesis_corridor from anon");
    expect(sql).toContain("revoke all on all tables in schema genesis_corridor from authenticated");
  });

  test("enables RLS on every corridor persistence table", () => {
    const sql = readMigration("20260824014956_create_genesis_corridor_persistence_v1.sql");
    const tables = [
      "corridors",
      "evidence_sources",
      "corridor_evidence",
      "assessments",
      "economic_components",
      "strategic_score_evidence",
      "reme_events",
      "ingestion_runs"
    ];

    for (const table of tables) {
      expect(sql).toContain(`alter table genesis_corridor.${table} enable row level security`);
    }
  });

  test("persists score-to-evidence lineage and immutable assessment evidence snapshots", () => {
    const sql = readMigration("20260824014956_create_genesis_corridor_persistence_v1.sql");

    expect(sql).toContain("score_evidence_snapshot jsonb not null");
    expect(sql).toContain("create table if not exists genesis_corridor.strategic_score_evidence");
    expect(sql).toContain("evidence_id uuid not null references genesis_corridor.evidence_sources(id) on delete restrict");
    expect(sql).toContain("score_key text not null check (score_key in ('corridorControl','feedstockSecurity','infrastructureReadiness','marketReach','localIndustrialization','governanceRisk','buyerAccess','procurementReadiness'))");
  });

  test("preserves append-first assessment integrity and sovereign score constraints", () => {
    const sql = readMigration("20260824014956_create_genesis_corridor_persistence_v1.sql");

    expect(sql).toContain("unique (tenant_id, corridor_id, engine_version, input_hash)");
    expect(sql).toContain("check (classified_value <= total_economic_value)");
    expect(sql).toContain("check (local_retained_value <= classified_value)");
    expect(sql).toContain("check (abs((sovereignty_gap + sovereign_value_capture_ratio) - 100) <= 0.001)");
    expect(sql).toContain("decision text not null check (decision in ('GO','HOLD','NO_GO'))");
  });
});
