import { describe, expect, test } from "vitest";
import {
  compileAssuranceReport,
  compileIndependentAssurance,
  verifyIndependentAssurance
} from "../src/independentAssurance";

const snapshotSha = "48ddf1dea89ab109b591aa3905a803c900f5a3dc";
const cleanFinding = [] as const;

const identityByRole: Record<string, { auditorId: string; executionContextId: string }> = {
  ARCHITECTURE_RUNTIME_AUDITOR: { auditorId: "agent:assurance:architecture", executionContextId: "ctx:architecture:001" },
  SECURITY_SUPPLY_CHAIN_AUDITOR: { auditorId: "agent:assurance:security", executionContextId: "ctx:security:001" },
  SOVEREIGNTY_COMPLIANCE_AUDITOR: { auditorId: "agent:assurance:sovereignty", executionContextId: "ctx:sovereignty:001" },
  ECONOMICS_FINOPS_AUDITOR: { auditorId: "agent:assurance:economics", executionContextId: "ctx:economics:001" },
  ADVERSARIAL_RED_TEAM_AUDITOR: { auditorId: "agent:assurance:red-team", executionContextId: "ctx:red-team:001" },
  ASSURANCE_ARBITER: { auditorId: "agent:assurance:arbiter", executionContextId: "ctx:arbiter:001" }
};

function specialist(role: any, verdict: any = "PASS", findings: any[] = [], identity?: { auditorId: string; executionContextId: string }) {
  const agentIdentity = identity ?? identityByRole[role];
  return compileAssuranceReport({
    auditorRole: role,
    auditorId: agentIdentity?.auditorId,
    executionContextId: agentIdentity?.executionContextId,
    snapshotSha,
    findings,
    verdict,
    evidenceRefs: ["CI#313"],
    generatedAt: "2026-08-24T15:55:00Z"
  } as any);
}

function cleanSpecialists() {
  return [
    specialist("ARCHITECTURE_RUNTIME_AUDITOR"),
    specialist("SECURITY_SUPPLY_CHAIN_AUDITOR"),
    specialist("SOVEREIGNTY_COMPLIANCE_AUDITOR"),
    specialist("ECONOMICS_FINOPS_AUDITOR"),
    specialist("ADVERSARIAL_RED_TEAM_AUDITOR")
  ];
}

function arbiter(verdict: any = "PASS", identity = identityByRole.ASSURANCE_ARBITER) {
  return compileAssuranceReport({
    auditorRole: "ASSURANCE_ARBITER",
    auditorId: identity.auditorId,
    executionContextId: identity.executionContextId,
    snapshotSha,
    findings: cleanFinding,
    verdict,
    evidenceRefs: ["council:sealed-specialists"],
    generatedAt: "2026-08-24T15:56:00Z"
  } as any);
}

function council(overrides: Record<string, unknown> = {}) {
  return {
    snapshotSha,
    specialistReports: cleanSpecialists(),
    arbiterReport: arbiter(),
    builderAgentIds: ["agent:builder:deploybot"],
    externalMandate: false,
    evidenceRef: "REME-IAC-001",
    generatedAt: "2026-08-24T15:57:00Z",
    ...overrides
  } as any;
}

describe("Independent Assurance Council", () => {
  test("produces INTERNAL_BIG4_PASS for a clean isolated 5/5 council", () => {
    const evidence = compileIndependentAssurance(council());
    expect(evidence.verdict).toBe("INTERNAL_BIG4_PASS");
    expect(evidence.specialistPassCount).toBe(5);
    expect((evidence as any).specialistAuditorIds).toHaveLength(5);
    expect((evidence as any).specialistExecutionContextIds).toHaveLength(5);
    expect((evidence as any).arbiterAuditorId).toBe("agent:assurance:arbiter");
    expect(verifyIndependentAssurance(evidence).valid).toBe(true);
  });

  test("blocks when any open P0 exists and arbiter cannot override it", () => {
    const reports = cleanSpecialists();
    reports[0] = specialist("ARCHITECTURE_RUNTIME_AUDITOR", "PASS", [{
      id: "P0-1", severity: "P0", title: "terminal bypass", status: "OPEN", evidenceRefs: ["src/releaseCenter.ts"]
    }]);
    const evidence = compileIndependentAssurance(council({ specialistReports: reports }));
    expect(evidence.verdict).toBe("BLOCK");
  });

  test("holds when any open P1 exists", () => {
    const reports = cleanSpecialists();
    reports[1] = specialist("SECURITY_SUPPLY_CHAIN_AUDITOR", "HOLD", [{
      id: "P1-1", severity: "P1", title: "unsigned issuer", status: "OPEN", evidenceRefs: ["AI Economics Certificate"]
    }]);
    const evidence = compileIndependentAssurance(council({ specialistReports: reports }));
    expect(evidence.verdict).toBe("HOLD");
  });

  test("holds when fewer than four specialist auditors pass", () => {
    const reports = cleanSpecialists();
    reports[0] = specialist("ARCHITECTURE_RUNTIME_AUDITOR", "HOLD");
    reports[1] = specialist("SECURITY_SUPPLY_CHAIN_AUDITOR", "HOLD");
    const evidence = compileIndependentAssurance(council({ specialistReports: reports }));
    expect(evidence.verdict).toBe("HOLD");
  });

  test("requires unique specialist roles", () => {
    const reports = cleanSpecialists();
    reports[4] = specialist("ARCHITECTURE_RUNTIME_AUDITOR", "PASS", [], {
      auditorId: "agent:assurance:architecture-2",
      executionContextId: "ctx:architecture:002"
    });
    expect(() => compileIndependentAssurance(council({ specialistReports: reports }))).toThrow(/duplicate|role/i);
  });

  test("requires unique specialist auditor identities", () => {
    const reports = cleanSpecialists();
    reports[4] = specialist("ADVERSARIAL_RED_TEAM_AUDITOR", "PASS", [], {
      auditorId: "agent:assurance:architecture",
      executionContextId: "ctx:red-team:unique"
    });
    expect(() => compileIndependentAssurance(council({ specialistReports: reports })))
      .toThrow(/auditor|identity|duplicate/i);
  });

  test("requires unique specialist execution contexts", () => {
    const reports = cleanSpecialists();
    reports[4] = specialist("ADVERSARIAL_RED_TEAM_AUDITOR", "PASS", [], {
      auditorId: "agent:assurance:red-team-unique",
      executionContextId: "ctx:architecture:001"
    });
    expect(() => compileIndependentAssurance(council({ specialistReports: reports })))
      .toThrow(/context|duplicate|isolation/i);
  });

  test("requires arbiter identity and context to be distinct from specialists", () => {
    const collidingArbiter = arbiter("PASS", {
      auditorId: "agent:assurance:architecture",
      executionContextId: "ctx:architecture:001"
    });
    expect(() => compileIndependentAssurance(council({ arbiterReport: collidingArbiter })))
      .toThrow(/arbiter|auditor|context|distinct/i);
  });

  test("forbids a builder identity from acting as arbiter", () => {
    const builderArbiter = arbiter("PASS", {
      auditorId: "agent:builder:deploybot",
      executionContextId: "ctx:builder-arbiter:001"
    });
    expect(() => compileIndependentAssurance(council({ arbiterReport: builderArbiter })))
      .toThrow(/builder|arbiter|separation/i);
  });

  test("rejects a council made entirely of builder identities", () => {
    const reports = cleanSpecialists().map((report, index) => compileAssuranceReport({
      ...report,
      auditorId: `agent:builder:${index}`,
      executionContextId: `ctx:builder:${index}`,
      sha256: undefined
    } as any));
    expect(() => compileIndependentAssurance(council({
      specialistReports: reports,
      builderAgentIds: reports.map(report => (report as any).auditorId)
    }))).toThrow(/builder|independent|separation/i);
  });

  test("requires all reports to bind to the same snapshot", () => {
    const reports = cleanSpecialists();
    reports[0] = compileAssuranceReport({
      auditorRole: "ARCHITECTURE_RUNTIME_AUDITOR",
      auditorId: "agent:assurance:architecture",
      executionContextId: "ctx:architecture:001",
      snapshotSha: "different-head",
      findings: [], verdict: "PASS", evidenceRefs: ["CI#313"], generatedAt: "2026-08-24T15:55:00Z"
    } as any);
    expect(() => compileIndependentAssurance(council({ specialistReports: reports }))).toThrow(/snapshot/i);
  });

  test("external mandate yields EXTERNAL_ASSURANCE_REQUIRED after internal pass", () => {
    const evidence = compileIndependentAssurance(council({ externalMandate: true }));
    expect(evidence.verdict).toBe("EXTERNAL_ASSURANCE_REQUIRED");
  });

  test("rejects unknown runtime enum values", () => {
    expect(() => specialist("UNKNOWN_AUDITOR")).toThrow(/role|auditor/i);
    expect(() => specialist("ARCHITECTURE_RUNTIME_AUDITOR", "MAYBE")).toThrow(/verdict/i);
    expect(() => specialist("ARCHITECTURE_RUNTIME_AUDITOR", "PASS", [{
      id: "X", severity: "P9", title: "bad severity", status: "OPEN", evidenceRefs: ["x"]
    }])).toThrow(/severity/i);
  });

  test("detects tampering of sealed identity/isolation evidence", () => {
    const evidence = compileIndependentAssurance(council());
    expect(() => verifyIndependentAssurance({
      ...evidence,
      specialistPassCount: 4
    } as any)).toThrow(/sha|tamper|hash/i);
    expect(() => verifyIndependentAssurance({
      ...evidence,
      specialistAuditorIds: ["agent:fake"]
    } as any)).toThrow(/sha|tamper|hash|auditor/i);
  });
});
