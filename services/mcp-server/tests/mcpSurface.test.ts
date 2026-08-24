import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const source = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

describe("Sovereign Delivery MCP surface", () => {
  test("registers deterministic DeployBot delivery and compute economics tools", () => {
    expect(source).toContain('register("deploybot.deployment.compile"');
    expect(source).toContain('register("deploybot.domain.compile"');
    expect(source).toContain('register("deploybot.release.compile"');
    expect(source).toContain('register("deploybot.release.verify"');
    expect(source).toContain('register("deploybot.compute.compile"');
    expect(source).toContain('register("deploybot.compute.verify_certificate"');
  });

  test("publishes MCP package version 0.5.0 and control-plane revision 0.8.0", () => {
    expect(packageJson.version).toBe("0.5.0");
    expect(source).toContain('const PACKAGE_VERSION = "0.5.0"');
    expect(source).toContain('const CONTROL_PLANE_REVISION = "0.8.0"');
  });

  test("surfaces compute economics and release evidence identities in health output", () => {
    expect(source).toContain("sovereignDeliveryRuntime");
    expect(source).toContain("computeInferenceEconomicsLayer");
    expect(source).toContain("releaseEvidenceSchema");
    expect(source).toContain('const RELEASE_EVIDENCE_SCHEMA = "1.1.0"');
  });
});
