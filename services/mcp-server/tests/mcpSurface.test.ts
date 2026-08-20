import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const source = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

describe("Sovereign Delivery MCP surface", () => {
  test("registers the four deterministic DeployBot delivery tools", () => {
    expect(source).toContain('register("deploybot.deployment.compile"');
    expect(source).toContain('register("deploybot.domain.compile"');
    expect(source).toContain('register("deploybot.release.compile"');
    expect(source).toContain('register("deploybot.release.verify"');
  });

  test("publishes MCP package version 0.4.0 and control-plane revision 0.7.0", () => {
    expect(packageJson.version).toBe("0.4.0");
    expect(source).toContain('const PACKAGE_VERSION = "0.4.0"');
    expect(source).toContain('const CONTROL_PLANE_REVISION = "0.7.0"');
  });

  test("surfaces sovereign delivery runtime identity in health output", () => {
    expect(source).toContain("sovereignDeliveryRuntime");
    expect(source).toContain("releaseEvidenceSchema");
  });
});
