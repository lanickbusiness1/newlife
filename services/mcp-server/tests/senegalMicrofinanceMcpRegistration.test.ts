import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("Senegal microfinance MCP registration", () => {
  test("exposes the governed Senegal microfinance pilot evaluator and its health anchor", () => {
    const source = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

    expect(source).toContain("GENESIS_V4_SENEGAL_MICROFINANCE_ANCHOR");
    expect(source).toContain("evaluateSenegalMicrofinancePilot");
    expect(source).toContain("genesis.senegal_microfinance.evaluate");
    expect(source).toContain("senegalMicrofinancePilot");
  });
});
