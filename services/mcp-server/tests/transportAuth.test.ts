import { describe, expect, test } from "vitest";
import {
  bindVerifiedPrincipalToContext,
  issueMcpTransportToken,
  verifyMcpTransportBearer
} from "../src/transportAuth";

const SECRET = "test-only-mcp-transport-auth-secret-123456789";

function claims() {
  return {
    tenantId: "tenant-a",
    actorId: "actor-a",
    agentId: "agent-a",
    permissionScope: ["capitalization:plan", "capitalization:evaluate"],
    expiresAt: 1893456000
  };
}

describe("MCP authenticated HTTP transport", () => {
  test("derives tenant identity and scopes from a verified bearer token, never from caller context", () => {
    const token = issueMcpTransportToken(claims(), SECRET);
    const principal = verifyMcpTransportBearer(`Bearer ${token}`, SECRET, 1800000000);
    const bound = bindVerifiedPrincipalToContext(principal, {
      tenantId: "tenant-a",
      actorId: "actor-a",
      agentId: "agent-a",
      correlationId: "08f3f622-851f-4843-8f03-e0a845a1c145",
      purpose: "compile governed plan",
      permissionScope: ["capitalization:evidence", "admin:*"],
      dataClassification: "internal"
    });

    expect(bound.tenantId).toBe("tenant-a");
    expect(bound.actorId).toBe("actor-a");
    expect(bound.agentId).toBe("agent-a");
    expect(bound.permissionScope).toEqual(["capitalization:evaluate", "capitalization:plan"]);
    expect(bound.permissionScope).not.toContain("capitalization:evidence");
    expect(bound.permissionScope).not.toContain("admin:*");
  });

  test("rejects tenant impersonation, token tampering, expiry and missing transport secret", () => {
    const token = issueMcpTransportToken(claims(), SECRET);
    const principal = verifyMcpTransportBearer(`Bearer ${token}`, SECRET, 1800000000);

    expect(() => bindVerifiedPrincipalToContext(principal, {
      tenantId: "tenant-b",
      actorId: "actor-a",
      agentId: "agent-a",
      correlationId: "08f3f622-851f-4843-8f03-e0a845a1c145",
      purpose: "impersonate tenant",
      permissionScope: ["capitalization:plan"],
      dataClassification: "internal"
    })).toThrow("MCP_CONTEXT_IDENTITY_MISMATCH");

    const [payload, signature] = token.split(".");
    const tampered = `${payload.slice(0, -1)}A.${signature}`;
    expect(() => verifyMcpTransportBearer(`Bearer ${tampered}`, SECRET, 1800000000))
      .toThrow("MCP_TRANSPORT_AUTH_INVALID");
    expect(() => verifyMcpTransportBearer(`Bearer ${token}`, SECRET, 1999999999))
      .toThrow("MCP_TRANSPORT_AUTH_EXPIRED");
    expect(() => verifyMcpTransportBearer(`Bearer ${token}`, "", 1800000000))
      .toThrow("MCP_TRANSPORT_AUTH_UNAVAILABLE");
  });

  test("HTTP MCP route verifies bearer authentication before building the server", async () => {
    const source = await import("node:fs").then(fs => fs.readFileSync(new URL("../src/index.ts", import.meta.url), "utf8"));
    expect(source).toContain("verifyMcpTransportBearer");
    expect(source).toContain("GENESIS_MCP_AUTH_HMAC_SECRET");
    expect(source).toContain("buildServer(principal)");
  });
});
