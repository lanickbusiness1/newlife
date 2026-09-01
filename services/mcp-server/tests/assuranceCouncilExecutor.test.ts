import { describe, expect, test } from "vitest";
import {
  runIndependentAssuranceCouncil,
  type CouncilInferenceRequest,
  type CouncilModelClient
} from "../src/assuranceCouncilExecutor";
import { verifyIndependentAssurance } from "../src/independentAssurance";

const snapshotSha = "adf8eaca1a5117e84f392a23d58da0fd4ab22011";

class RecordingClient implements CouncilModelClient {
  calls: CouncilInferenceRequest[] = [];

  async complete(request: CouncilInferenceRequest): Promise<string> {
    this.calls.push(structuredClone(request));
    return JSON.stringify({
      verdict: "PASS",
      findings: [],
      evidenceRefs: [`snapshot:${request.snapshotSha}`, `role:${request.role}`]
    });
  }
}

const evidenceByRole = {
  ARCHITECTURE_RUNTIME_AUDITOR: ["src/independentAssurance.ts", "src/releaseCenter.ts"],
  SECURITY_SUPPLY_CHAIN_AUDITOR: ["package-lock.json", ".github/workflows/mcp-ci.yml"],
  SOVEREIGNTY_COMPLIANCE_AUDITOR: ["src/computeEconomics.ts", "src/deploymentOrchestrator.ts"],
  ECONOMICS_FINOPS_AUDITOR: ["src/computeEconomics.ts", "V4-DEC-021"],
  ADVERSARIAL_RED_TEAM_AUDITOR: ["PR#64", "CI#322"]
} as const;

describe("Independent Assurance Council executor", () => {
  test("runs six real inference contexts with staged information barriers", async () => {
    const client = new RecordingClient();
    const result = await runIndependentAssuranceCouncil({
      snapshotSha,
      builderAgentIds: ["agent:builder:deploybot"],
      externalMandate: false,
      evidenceByRole,
      generatedAt: "2026-08-25T00:55:00Z",
      evidenceRef: "REME-IAC-PR64-RUN1"
    }, client);

    expect(client.calls).toHaveLength(6);
    const firstFour = client.calls.slice(0, 4);
    expect(firstFour.every(call => call.sealedPriorReports.length === 0)).toBe(true);

    const redTeam = client.calls[4];
    expect(redTeam.role).toBe("ADVERSARIAL_RED_TEAM_AUDITOR");
    expect(redTeam.sealedPriorReports).toHaveLength(4);

    const arbiter = client.calls[5];
    expect(arbiter.role).toBe("ASSURANCE_ARBITER");
    expect(arbiter.sealedPriorReports).toHaveLength(5);

    const auditorIds = client.calls.map(call => call.auditorId);
    const contextIds = client.calls.map(call => call.executionContextId);
    expect(new Set(auditorIds).size).toBe(6);
    expect(new Set(contextIds).size).toBe(6);
    expect(auditorIds).not.toContain("agent:builder:deploybot");

    expect(result.evidence.verdict).toBe("INTERNAL_BIG4_PASS");
    expect(verifyIndependentAssurance(result.evidence).valid).toBe(true);
    expect(result.reports).toHaveLength(6);
  });

  test("fails closed when a model returns malformed JSON", async () => {
    const client: CouncilModelClient = {
      async complete() { return "not-json"; }
    };

    await expect(runIndependentAssuranceCouncil({
      snapshotSha,
      builderAgentIds: ["agent:builder:deploybot"],
      externalMandate: false,
      evidenceByRole,
      generatedAt: "2026-08-25T00:55:00Z",
      evidenceRef: "REME-IAC-PR64-BAD"
    }, client)).rejects.toThrow(/model|json|assurance/i);
  });

  test("preserves HOLD/BLOCK findings instead of coercing a pass", async () => {
    const client: CouncilModelClient = {
      async complete(request) {
        if (request.role === "SECURITY_SUPPLY_CHAIN_AUDITOR") {
          return JSON.stringify({
            verdict: "HOLD",
            findings: [{
              id: "P1-EXECUTOR-001",
              severity: "P1",
              title: "unresolved security evidence",
              status: "OPEN",
              evidenceRefs: ["security:evidence"]
            }],
            evidenceRefs: ["security:evidence"]
          });
        }
        return JSON.stringify({ verdict: "PASS", findings: [], evidenceRefs: [`role:${request.role}`] });
      }
    };

    const result = await runIndependentAssuranceCouncil({
      snapshotSha,
      builderAgentIds: ["agent:builder:deploybot"],
      externalMandate: false,
      evidenceByRole,
      generatedAt: "2026-08-25T00:55:00Z",
      evidenceRef: "REME-IAC-PR64-HOLD"
    }, client);

    expect(result.evidence.verdict).toBe("HOLD");
    expect(result.evidence.openP1).toBe(1);
  });
});