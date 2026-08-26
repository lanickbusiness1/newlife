import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const source = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

describe("Sovereign Delivery MCP surface", () => {
  test("registers deterministic DeployBot delivery, economics and assurance tools", () => {
    expect(source).toContain('register("deploybot.deployment.compile"');
    expect(source).toContain('register("deploybot.domain.compile"');
    expect(source).toContain('register("deploybot.release.compile"');
    expect(source).toContain('register("deploybot.release.verify"');
    expect(source).toContain('register("deploybot.compute.compile"');
    expect(source).toContain('register("deploybot.compute.verify_certificate"');
    expect(source).toContain('register("deploybot.assurance.compile_report"');
    expect(source).toContain('register("deploybot.assurance.compile_council"');
    expect(source).toContain('register("deploybot.assurance.verify"');
  });

  test("registers the four governed Distributed Market Capture Layer tools with explicit scopes", () => {
    expect(source).toContain('register("genesis.market_capture.compile_cell"');
    expect(source).toContain('MARKET_CAPTURE_TOOL_SCOPES["genesis.market_capture.compile_cell"]');
    expect(source).toContain('register("genesis.market_capture.qualify_lead"');
    expect(source).toContain('MARKET_CAPTURE_TOOL_SCOPES["genesis.market_capture.qualify_lead"]');
    expect(source).toContain('register("genesis.market_capture.evaluate_economics"');
    expect(source).toContain('MARKET_CAPTURE_TOOL_SCOPES["genesis.market_capture.evaluate_economics"]');
    expect(source).toContain('register("genesis.market_capture.decide_scale"');
    expect(source).toContain('MARKET_CAPTURE_TOOL_SCOPES["genesis.market_capture.decide_scale"]');
  });

  test("publishes MCP package version 0.6.0 and control-plane revision 0.9.0", () => {
    expect(packageJson.version).toBe("0.6.0");
    expect(source).toContain('const PACKAGE_VERSION = "0.6.0"');
    expect(source).toContain('const CONTROL_PLANE_REVISION = "0.9.0"');
  });

  test("surfaces assurance, compute economics and release evidence identities in health output", () => {
    expect(source).toContain("sovereignDeliveryRuntime");
    expect(source).toContain("computeInferenceEconomicsLayer");
    expect(source).toContain("releaseEvidenceSchema");
    expect(source).toContain("independentAssuranceCouncil");
    expect(source).toContain('const RELEASE_EVIDENCE_SCHEMA = "1.2.0"');
    expect(source).toContain('const INDEPENDENT_ASSURANCE_COUNCIL = "INDEPENDENT_ASSURANCE_COUNCIL_1.0.0"');
  });
});