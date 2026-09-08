import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const packageJsonUrl = new URL("../package.json", import.meta.url);
const packageLockUrl = new URL("../package-lock.json", import.meta.url);
const workflowUrl = new URL("../../../.github/workflows/mcp-ci.yml", import.meta.url);

describe("GENESIS V4 MCP supply-chain policy", () => {
  test("pins the MCP SDK in the manifest and immutable lock resolution", () => {
    const pkg = JSON.parse(readFileSync(packageJsonUrl, "utf8"));
    const lock = JSON.parse(readFileSync(packageLockUrl, "utf8"));
    const lockedSdk = lock.packages["node_modules/@modelcontextprotocol/sdk"];

    expect(pkg.dependencies["@modelcontextprotocol/sdk"]).toBe("1.30.0");
    expect(lockedSdk.version).toBe("1.30.0");
    expect(lockedSdk.resolved).toContain("/@modelcontextprotocol/sdk/-/sdk-1.30.0.tgz");
    expect(lockedSdk.integrity).toMatch(/^sha512-/);
  });

  test("fails CI on moderate-or-higher dependency advisories", () => {
    const workflow = readFileSync(workflowUrl, "utf8");

    expect(workflow).toContain("npm audit --audit-level=moderate --json");
    expect(workflow).not.toContain("npm audit --audit-level=high --json");
  });
});
