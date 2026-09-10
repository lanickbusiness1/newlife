import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(resolve(here, "../src/index.ts"), "utf8");

describe("V4-DEC-036 MCP exposure contract", () => {
  test("registers the Delivery-to-Bankability evaluator as a governed DeployBot tool", () => {
    expect(indexSource).toContain("GENESIS_V4_DELIVERY_TO_BANKABILITY_ANCHOR");
    expect(indexSource).toContain("evaluateDeliveryToBankability");
    expect(indexSource).toContain('register("deploybot.delivery_to_bankability_gate.evaluate"');
  });

  test("surfaces the delivery gate in the MCP health contract", () => {
    expect(indexSource).toContain("deliveryToBankabilityGate:");
    expect(indexSource).toContain("GENESIS_V4_DELIVERY_TO_BANKABILITY_ANCHOR.assetId");
  });
});
