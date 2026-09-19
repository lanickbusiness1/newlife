import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("production deployment policy", () => {
  it("keeps provider auto-deploy disabled so assurance gates cannot be bypassed", () => {
    const renderConfig = readFileSync(resolve(process.cwd(), "../../render.yaml"), "utf8");
    expect(renderConfig).toMatch(/autoDeploy:\s*false/);
  });

  it("retains the canonical healthcheck endpoint", () => {
    const renderConfig = readFileSync(resolve(process.cwd(), "../../render.yaml"), "utf8");
    expect(renderConfig).toMatch(/healthCheckPath:\s*\/health/);
  });
});
