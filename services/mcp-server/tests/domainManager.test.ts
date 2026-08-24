import { describe, expect, test } from "vitest";
import { compileDomainIntent, verifyDomainEvidence } from "../src/domainManager";

const base = {
  service: "mcp",
  environment: "production" as const,
  recordType: "CNAME" as const,
  target: "provider.example.com",
  providerDeploymentId: "dep-1"
};

describe("DeployBot domain manager", () => {
  test("compiles the canonical production hostname", () => {
    expect(compileDomainIntent(base).hostname).toBe("mcp.afriagenesis.com");
  });

  test("compiles the canonical staging hostname", () => {
    expect(compileDomainIntent({ ...base, environment: "staging" }).hostname)
      .toBe("mcp-staging.afriagenesis.com");
  });

  test("rejects an unknown environment received from runtime JSON", () => {
    expect(() => compileDomainIntent({ ...base, environment: "qa" as any } as any))
      .toThrow(/environment/i);
  });

  test("rejects an unsupported DNS record type received from runtime JSON", () => {
    expect(() => compileDomainIntent({ ...base, recordType: "TXT" as any } as any))
      .toThrow(/record/i);
  });

  test("does not verify HTTPS before DNS", () => {
    const intent = compileDomainIntent(base);
    const result = verifyDomainEvidence({
      intent,
      evidence: {
        hostname: intent.hostname,
        resolvedTargets: [],
        dnsVerified: false,
        tlsVerified: true,
        httpsStatus: 200
      }
    });
    expect(result.state).toBe("DNS_PENDING");
  });

  test("rejects evidence for a non-canonical hostname", () => {
    const intent = compileDomainIntent(base);
    expect(() => verifyDomainEvidence({
      intent,
      evidence: {
        hostname: "provider.example.com",
        resolvedTargets: ["provider.example.com"],
        dnsVerified: true,
        tlsVerified: true,
        httpsStatus: 200
      }
    })).toThrow(/hostname/i);
  });

  test("requires DNS and TLS before HTTPS_VERIFIED", () => {
    const intent = compileDomainIntent(base);
    const result = verifyDomainEvidence({
      intent,
      evidence: {
        hostname: intent.hostname,
        resolvedTargets: ["provider.example.com"],
        dnsVerified: true,
        tlsVerified: true,
        certificateIssuer: "Example CA",
        certificateExpiresAt: "2027-08-20T00:00:00Z",
        httpsStatus: 200,
        verifiedAt: "2026-08-20T02:00:00Z"
      }
    });
    expect(result.state).toBe("HTTPS_VERIFIED");
  });
});
