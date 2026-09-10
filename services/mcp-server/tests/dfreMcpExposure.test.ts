import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(resolve(here, "../src/index.ts"), "utf8");

describe("V4-DEC-036 DFRE MCP exposure contract", () => {
  test("registers the DFRE execution-readiness adapter as a governed tool", () => {
    expect(indexSource).toContain("GENESIS_V4_DFRE_EXECUTION_ADAPTER_ANCHOR");
    expect(indexSource).toContain("compileDfreExecutionReadiness");
    expect(indexSource).toContain('register("dfre.execution_readiness.compile"');
  });

  test("surfaces the DFRE adapter in the MCP health contract", () => {
    expect(indexSource).toContain("dfreExecutionAdapter:");
    expect(indexSource).toContain("GENESIS_V4_DFRE_EXECUTION_ADAPTER_ANCHOR.assetId");
  });
});
