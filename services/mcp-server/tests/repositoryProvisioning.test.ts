import { describe, expect, it } from "vitest";
import {
  compileRepositoryProvisioning,
  provisionRepository
} from "../src/repositoryProvisioning.js";

const base = {
  validationRef: "CEO-VAL-PAYSWITCH-2026-09-19-001",
  owner: "lanickbusiness1",
  name: "afria-payswitch-os",
  description: "Canonical repository for AfrIA PaySwitch™ Financial Intelligence OS"
} as const;

describe("DeployBot repository provisioning", () => {
  it("plans safely by default", () => {
    const output = compileRepositoryProvisioning(base);
    expect(output.status).toBe("PLANNED");
    expect(output.private).toBe(true);
    expect(output.defaultBranch).toBe("main");
    expect(output.created).toBe(false);
  });

  it("fails closed when execution credentials are missing", async () => {
    const output = await provisionRepository({ ...base, mode: "execute" });
    expect(output.status).toBe("BLOCKED_CREDENTIAL");
    expect(output.verified).toBe(false);
  });

  it("is idempotent when the private repository already exists", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fakeFetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString();
      calls.push({ url, method: init?.method ?? "GET" });
      return new Response(JSON.stringify({
        name: base.name,
        private: true,
        default_branch: "main",
        owner: { login: base.owner }
      }), { status: 200, headers: { "content-type": "application/json" } });
    };

    const output = await provisionRepository(
      { ...base, mode: "execute" },
      { token: "test-token", fetchImpl: fakeFetch as typeof fetch }
    );

    expect(output.status).toBe("EXISTS_VERIFIED");
    expect(output.created).toBe(false);
    expect(output.verified).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("GET");
  });

  it("creates a missing private repository and verifies it", async () => {
    let getCount = 0;
    const calls: Array<{ url: string; method: string }> = [];
    const repo = {
      name: base.name,
      private: true,
      default_branch: "main",
      owner: { login: base.owner }
    };

    const fakeFetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString();
      const method = init?.method ?? "GET";
      calls.push({ url, method });

      if (method === "GET") {
        getCount += 1;
        if (getCount === 1) return new Response("", { status: 404 });
        return new Response(JSON.stringify(repo), { status: 200 });
      }

      if (url.endsWith("/user/repos") && method === "POST") {
        return new Response(JSON.stringify(repo), { status: 201 });
      }

      return new Response("", { status: 500 });
    };

    const output = await provisionRepository(
      { ...base, mode: "execute" },
      { token: "test-token", fetchImpl: fakeFetch as typeof fetch }
    );

    expect(output.status).toBe("CREATED_VERIFIED");
    expect(output.created).toBe(true);
    expect(output.verified).toBe(true);
    expect(calls.some(call => call.url.endsWith("/user/repos") && call.method === "POST")).toBe(true);
  });

  it("blocks non-allowlisted owners", async () => {
    const output = await provisionRepository(
      { ...base, owner: "someone-else", mode: "execute" },
      { token: "test-token" }
    );
    expect(output.status).toBe("BLOCKED_POLICY");
  });
});
