import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(resolve(here, "../src/index.ts"), "utf8");

describe("V4-DEC-036 Industrial Dependency MCP exposure", () => {
  test("registers the industrial dependency readiness adapter as a governed tool", () => {
    expect(indexSource).toContain("GENESIS_V4_INDUSTRIAL_DEPENDENCY_ADAPTER_ANCHOR");
    expect(indexSource).toContain("compileIndustrialDependencyReadiness");
    expect(indexSource).toContain('register("industry.dependency_readiness.compile"');
  });

  test("surfaces the industrial adapter in the MCP health contract", () => {
    expect(indexSource).toContain("industrialDependencyAdapter:");
    expect(indexSource).toContain("GENESIS_V4_INDUSTRIAL_DEPENDENCY_ADAPTER_ANCHOR.assetId");
  });
});
