import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../..");
const migrationName = "20260825012700_add_corridor_assessment_persistence_rpc.sql";

function migration() {
  return readFileSync(resolve(repoRoot, "supabase/migrations", migrationName), "utf8");
}

describe("V4-DEC-017 transactional persistence RPC contract", () => {
  test("versions the exact persistence RPC migration", () => {
    expect(migration()).toContain("persist_corridor_assessment_v1");
  });

  test("keeps the RPC service-role only and hardened against search-path escalation", () => {
    const sql = migration();
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/set search_path\s*=\s*pg_catalog,\s*public,\s*genesis_corridor/i);
    expect(sql).toMatch(/revoke all on function public\.persist_corridor_assessment_v1[\s\S]*from public/i);
    expect(sql).toMatch(/revoke all on function public\.persist_corridor_assessment_v1[\s\S]*from anon/i);
    expect(sql).toMatch(/revoke all on function public\.persist_corridor_assessment_v1[\s\S]*from authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.persist_corridor_assessment_v1[\s\S]*to service_role/i);
  });

  test("fails closed if assessment evidence is not pre-registered for the tenant", () => {
    const sql = migration();
    expect(sql).toContain("CORRIDOR_PERSISTENCE_EVIDENCE_NOT_REGISTERED");
    expect(sql).toMatch(/genesis_corridor\.evidence_sources/i);
  });

  test("persists the complete assessment lineage in one database transaction", () => {
    const sql = migration();
    for (const table of [
      "corridors",
      "corridor_evidence",
      "assessments",
      "economic_components",
      "strategic_score_evidence",
      "reme_events"
    ]) {
      expect(sql).toContain(`genesis_corridor.${table}`);
    }
    expect(sql).toMatch(/add column if not exists agent_id text/i);
  });

  test("implements append-first idempotency on tenant corridor engine version and input hash", () => {
    const sql = migration();
    expect(sql).toMatch(/input_hash/i);
    expect(sql).toContain("idempotent");
    expect(sql).toMatch(/select[\s\S]*from genesis_corridor\.assessments[\s\S]*engine_version[\s\S]*input_hash/i);
  });
});
