import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../..");
const migrationName = "20260825013500_harden_corridor_persistence_concurrency.sql";

function migration() {
  return readFileSync(resolve(repoRoot, "supabase/migrations", migrationName), "utf8");
}

describe("V4-DEC-017 concurrent idempotency hardening", () => {
  test("versions the concurrency hardening migration", () => {
    expect(migration()).toContain("pg_advisory_xact_lock");
  });

  test("serializes identical idempotency keys before entering the persistence core", () => {
    const sql = migration();
    expect(sql).toMatch(/hashtextextended/i);
    expect(sql).toMatch(/p_tenant_id[\s\S]*corridorId[\s\S]*version[\s\S]*p_input_hash/i);
    expect(sql).toMatch(/pg_advisory_xact_lock[\s\S]*persist_corridor_assessment_v1_unlocked/i);
  });

  test("makes the unlocked core unreachable to API roles", () => {
    const sql = migration();
    for (const role of ["public", "anon", "authenticated", "service_role"]) {
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.persist_corridor_assessment_v1_unlocked[\\s\\S]*from ${role}`, "i"));
    }
    expect(sql).toMatch(/grant execute on function public\.persist_corridor_assessment_v1[\s\S]*to service_role/i);
  });
});
