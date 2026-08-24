import { describe, expect, test } from "vitest";
import {
  compileAssuranceReport,
  compileIndependentAssurance,
  verifyIndependentAssurance
} from "../src/independentAssurance";

const snapshotSha = "879647d85d25a2069860ca29fa6c32d886fc1760";

const cleanFinding = [] as const;

function specialist(role: any, verdict: any = "PASS", findings: any[] = []) {
  return compileAssuranceReport({
    auditorRole: role,
    snapshotSha,
    findings,
    verdict,
    evidenceRefs: ["CI#289"],
    generatedAt: "2026-08-24T15:40:00Z"
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

function arbiter(verdict: any = "PASS") {
  return compileAssuranceReport({
    auditorRole: "ASSURANCE_ARBITER",
    snapshotSha,
    findings: cleanFinding,
    verdict,
    evidenceRefs: ["council:sealed-specialists"],
    generatedAt: "2026-08-24T15:41:00Z"
  } as any);
}

describe("Independent Assurance Council", () => {
  test("produces INTERNAL_BIG4_PASS for a clean 5/5 council", () => {
    const evidence = compileIndependentAssurance({
      snapshotSha,
      specialistReports: cleanSpecialists(),
      arbiterReport: arbiter(),
      externalMandate: false,
      evidenceRef: "REME-IAC-001",
      generatedAt: "2026-08-24T15:42:00Z"
    });
    expect(evidence.verdict).toBe("INTERNAL_BIG4_PASS");
    expect(evidence.specialistPassCount).toBe(5);
    expect(verifyIndependentAssurance(evidence).valid).toBe(true);
  });

  test("blocks when any open P0 exists and arbiter cannot override it", () => {
    const reports = cleanSpecialists();
    reports[0] = specialist("ARCHITECTURE_RUNTIME_AUDITOR", "PASS", [{
      id: "P0-1",
      severity: "P0",
      title: "terminal bypass",
      status: "OPEN",
      evidenceRefs: ["src/releaseCenter.ts"]
    }]);
    const evidence = compileIndependentAssurance({
      snapshotSha,
      specialistReports: reports,
      arbiterReport: arbiter("PASS"),
      externalMandate: false,
      evidenceRef: "REME-IAC-002",
      generatedAt: "2026-08-24T15:42:00Z"
    });
    expect(evidence.verdict).toBe("BLOCK");
  });

  test("holds when any open P1 exists", () => {
    const reports = cleanSpecialists();
    reports[1] = specialist("SECURITY_SUPPLY_CHAIN_AUDITOR", "HOLD", [{
      id: "P1-1",
      severity: "P1",
      title: "unsigned issuer",
      status: "OPEN",
      evidenceRefs: ["AI Economics Certificate"]
    }]);
    const evidence = compileIndependentAssurance({
      snapshotSha,
      specialistReports: reports,
      arbiterReport: arbiter("PASS"),
      externalMandate: false,
      evidenceRef: "REME-IAC-003",
      generatedAt: "2026-08-24T15:42:00Z"
    });
    expect(evidence.verdict).toBe("HOLD");
  });

  test("holds when fewer than four specialist auditors pass", () => {
    const reports = cleanSpecialists();
    reports[0] = specialist("ARCHITECTURE_RUNTIME_AUDITOR", "HOLD");
    reports[1] = specialist("SECURITY_SUPPLY_CHAIN_AUDITOR", "HOLD");
    const evidence = compileIndependentAssurance({
      snapshotSha,
      specialistReports: reports,
      arbiterReport: arbiter("PASS"),
      externalMandate: false,
      evidenceRef: "REME-IAC-004",
      generatedAt: "2026-08-24T15:42:00Z"
    });
    expect(evidence.verdict).toBe("HOLD");
  });

  test("requires unique specialist roles", () => {
    const reports = cleanSpecialists();
    reports[4] = specialist("ARCHITECTURE_RUNTIME_AUDITOR");
    expect(() => compileIndependentAssurance({
      snapshotSha,
      specialistReports: reports,
      arbiterReport: arbiter(),
      externalMandate: false,
      evidenceRef: "REME-IAC-005",
      generatedAt: "2026-08-24T15:42:00Z"
    })).toThrow(/duplicate|role/i);
  });

  test("requires all reports to bind to the same snapshot", () => {
    const reports = cleanSpecialists();
    const foreign = compileAssuranceReport({
      auditorRole: "ARCHITECTURE_RUNTIME_AUDITOR",
      snapshotSha: "different-head",
      findings: [],
      verdict: "PASS",
      evidenceRefs: ["CI#289"],
      generatedAt: "2026-08-24T15:40:00Z"
    } as any);
    reports[0] = foreign;
    expect(() => compileIndependentAssurance({
      snapshotSha,
      specialistReports: reports,
      arbiterReport: arbiter(),
      externalMandate: false,
      evidenceRef: "REME-IAC-006",
      generatedAt: "2026-08-24T15:42:00Z"
    })).toThrow(/snapshot/i);
  });

  test("external mandate yields EXTERNAL_ASSURANCE_REQUIRED after internal pass", () => {
    const evidence = compileIndependentAssurance({
      snapshotSha,
      specialistReports: cleanSpecialists(),
      arbiterReport: arbiter(),
      externalMandate: true,
      evidenceRef: "REME-IAC-007",
      generatedAt: "2026-08-24T15:42:00Z"
    });
    expect(evidence.verdict).toBe("EXTERNAL_ASSURANCE_REQUIRED");
  });

  test("rejects unknown runtime enum values", () => {
    expect(() => specialist("UNKNOWN_AUDITOR")).toThrow(/role|auditor/i);
    expect(() => specialist("ARCHITECTURE_RUNTIME_AUDITOR", "MAYBE")).toThrow(/verdict/i);
    expect(() => specialist("ARCHITECTURE_RUNTIME_AUDITOR", "PASS", [{
      id: "X",
      severity: "P9",
      title: "bad severity",
      status: "OPEN",
      evidenceRefs: ["x"]
    }])).toThrow(/severity/i);
  });

  test("detects tampering of a sealed council evidence object", () => {
    const evidence = compileIndependentAssurance({
      snapshotSha,
      specialistReports: cleanSpecialists(),
      arbiterReport: arbiter(),
      externalMandate: false,
      evidenceRef: "REME-IAC-008",
      generatedAt: "2026-08-24T15:42:00Z"
    });
    expect(() => verifyIndependentAssurance({
      ...evidence,
      specialistPassCount: 4
    } as any)).toThrow(/sha|tamper|hash/i);
  });
});
