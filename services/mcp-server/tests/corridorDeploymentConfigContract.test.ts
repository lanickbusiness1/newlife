import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const renderYaml = readFileSync(resolve(import.meta.dirname, "../render.yaml"), "utf8");

describe("V4-DEC-017 deployment secret contract", () => {
  test("declares corridor persistence runtime variables without committing secret values", () => {
    for (const key of [
      "GENESIS_CORRIDOR_SUPABASE_URL",
      "GENESIS_CORRIDOR_SERVICE_ROLE_KEY"
    ]) {
      expect(renderYaml).toContain(`- key: ${key}`);
    }
    expect(renderYaml).toMatch(/key: GENESIS_CORRIDOR_SUPABASE_URL\s+sync: false/);
    expect(renderYaml).toMatch(/key: GENESIS_CORRIDOR_SERVICE_ROLE_KEY\s+sync: false/);
  });
});
