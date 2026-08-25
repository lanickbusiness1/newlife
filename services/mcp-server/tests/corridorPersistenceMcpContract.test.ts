import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "../src/index.ts"), "utf8");

describe("V4-DEC-017 MCP persistence write boundary", () => {
  test("keeps pure assessment and side-effecting persistence as separate tools", () => {
    expect(source).toContain('register("corridor.value_capture.assess"');
    expect(source).toContain('register("corridor.value_capture.assess_and_persist"');
  });

  test("requires an explicit corridor write scope for persistence", () => {
    expect(source).toMatch(/corridor\.value_capture\.assess_and_persist[\s\S]*"corridor:write"/);
  });

  test("routes persisted assessments through the fail-closed persistence adapter", () => {
    expect(source).toContain("persistCorridorAssessmentViaRpc");
    expect(source).toContain("GENESIS_CORRIDOR_SUPABASE_URL");
    expect(source).toContain("GENESIS_CORRIDOR_SERVICE_ROLE_KEY");
  });

  test("reports the persistence boundary in health without exposing secrets", () => {
    expect(source).toContain("corridorPersistenceRpc");
    expect(source).not.toMatch(/serviceRoleKey\s*:/);
  });
});
