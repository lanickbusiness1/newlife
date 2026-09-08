import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const packageJsonUrl = new URL("../package.json", import.meta.url);
const packageLockUrl = new URL("../package-lock.json", import.meta.url);
const workflowUrl = new URL("../../../.github/workflows/mcp-ci.yml", import.meta.url);

describe("GENESIS V4 MCP supply-chain policy", () => {
  test("pins the MCP SDK to the exact lockfile version instead of a floating tag", () => {
    const pkg = JSON.parse(readFileSync(packageJsonUrl, "utf8"));
    const lock = JSON.parse(readFileSync(packageLockUrl, "utf8"));

    expect(pkg.dependencies["@modelcontextprotocol/sdk"]).toBe("1.30.0");
    expect(lock.packages[""].dependencies["@modelcontextprotocol/sdk"]).toBe("1.30.0");
    expect(lock.packages["node_modules/@modelcontextprotocol/sdk"].version).toBe("1.30.0");
  });

  test("fails CI on moderate-or-higher dependency advisories", () => {
    const workflow = readFileSync(workflowUrl, "utf8");

    expect(workflow).toContain("npm audit --audit-level=moderate --json");
    expect(workflow).not.toContain("npm audit --audit-level=high --json");
  });
});
