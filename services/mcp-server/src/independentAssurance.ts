import { createHash } from "node:crypto";

export type AssuranceSpecialistRole =
  | "ARCHITECTURE_RUNTIME_AUDITOR"
  | "SECURITY_SUPPLY_CHAIN_AUDITOR"
  | "SOVEREIGNTY_COMPLIANCE_AUDITOR"
  | "ECONOMICS_FINOPS_AUDITOR"
  | "ADVERSARIAL_RED_TEAM_AUDITOR";

export type AssuranceAuditorRole = AssuranceSpecialistRole | "ASSURANCE_ARBITER";
export type AssuranceSeverity = "P0" | "P1" | "P2";
export type AssuranceFindingStatus = "OPEN" | "RESOLVED";
export type AssuranceReportVerdict = "PASS" | "HOLD" | "BLOCK";
export type IndependentAssuranceVerdict =
  | "INTERNAL_BIG4_PASS"
  | "HOLD"
  | "BLOCK"
  | "EXTERNAL_ASSURANCE_REQUIRED"
  | "EXTERNAL_PASS";
export type IndependentAssuranceMode = "internal-agentic" | "external";

const SPECIALIST_ROLES = [
  "ARCHITECTURE_RUNTIME_AUDITOR",
  "SECURITY_SUPPLY_CHAIN_AUDITOR",
  "SOVEREIGNTY_COMPLIANCE_AUDITOR",
  "ECONOMICS_FINOPS_AUDITOR",
  "ADVERSARIAL_RED_TEAM_AUDITOR"
] as const satisfies readonly AssuranceSpecialistRole[];

const AUDITOR_ROLES = new Set<AssuranceAuditorRole>([
  ...SPECIALIST_ROLES,
  "ASSURANCE_ARBITER"
]);
const SEVERITIES = new Set<AssuranceSeverity>(["P0", "P1", "P2"]);
const FINDING_STATUSES = new Set<AssuranceFindingStatus>(["OPEN", "RESOLVED"]);
const REPORT_VERDICTS = new Set<AssuranceReportVerdict>(["PASS", "HOLD", "BLOCK"]);
const ASSURANCE_MODES = new Set<IndependentAssuranceMode>(["internal-agentic", "external"]);
const ASSURANCE_VERDICTS = new Set<IndependentAssuranceVerdict>([
  "INTERNAL_BIG4_PASS",
  "HOLD",
  "BLOCK",
  "EXTERNAL_ASSURANCE_REQUIRED",
  "EXTERNAL_PASS"
]);

export interface AssuranceFinding {
  id: string;
  severity: AssuranceSeverity;
  title: string;
  status: AssuranceFindingStatus;
  evidenceRefs: string[];
}

export interface AssuranceReport {
  schemaVersion: "1.0.0";
  auditorRole: AssuranceAuditorRole;
  snapshotSha: string;
  findings: AssuranceFinding[];
  verdict: AssuranceReportVerdict;
  evidenceRefs: string[];
  generatedAt: string;
  sha256: string;
}

export type AssuranceReportInput = Omit<AssuranceReport, "schemaVersion" | "sha256">;

export interface IndependentAssuranceEvidence {
  schemaVersion: "1.0.0";
  mode: IndependentAssuranceMode;
  verdict: IndependentAssuranceVerdict;
  snapshotSha: string;
  specialistPassCount: number;
  specialistTotal: 5;
  openP0: number;
  openP1: number;
  auditorReportHashes: string[];
  arbiterReportHash: string;
  externalMandate: boolean;
  evidenceRef: string;
  generatedAt: string;
  sha256: string;
}

export interface IndependentAssuranceInput {
  snapshotSha: string;
  specialistReports: AssuranceReport[];
  arbiterReport: AssuranceReport;
  externalMandate: boolean;
  evidenceRef: string;
  generatedAt: string;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`INDEPENDENT_ASSURANCE_INVALID: ${name} is required`);
  }
  return value.trim();
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

function withoutReportHash(report: AssuranceReport): Omit<AssuranceReport, "sha256"> {
  const { sha256: _sha256, ...rest } = report;
  return rest;
}

function withoutEvidenceHash(
  evidence: IndependentAssuranceEvidence
): Omit<IndependentAssuranceEvidence, "sha256"> {
  const { sha256: _sha256, ...rest } = evidence;
  return rest;
}

function validateFinding(finding: AssuranceFinding, index: number): AssuranceFinding {
  requiredString(finding?.id, `findings[${index}].id`);
  requiredString(finding?.title, `findings[${index}].title`);
  if (!SEVERITIES.has(finding?.severity)) {
    throw new Error(`INDEPENDENT_ASSURANCE_INVALID: findings[${index}].severity must be P0, P1 or P2`);
  }
  if (!FINDING_STATUSES.has(finding?.status)) {
    throw new Error(`INDEPENDENT_ASSURANCE_INVALID: findings[${index}].status must be OPEN or RESOLVED`);
  }
  if (!Array.isArray(finding?.evidenceRefs) || finding.evidenceRefs.length === 0) {
    throw new Error(`INDEPENDENT_ASSURANCE_INVALID: findings[${index}].evidenceRefs must not be empty`);
  }
  finding.evidenceRefs.forEach((ref, refIndex) => requiredString(ref, `findings[${index}].evidenceRefs[${refIndex}]`));
  return finding;
}

export function compileAssuranceReport(input: AssuranceReportInput): AssuranceReport {
  if (!AUDITOR_ROLES.has(input?.auditorRole)) {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: auditorRole is unknown");
  }
  if (!REPORT_VERDICTS.has(input?.verdict)) {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: verdict must be PASS, HOLD or BLOCK");
  }
  requiredString(input.snapshotSha, "snapshotSha");
  requiredString(input.generatedAt, "generatedAt");
  if (!Array.isArray(input.findings)) {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: findings must be an array");
  }
  input.findings.forEach(validateFinding);
  if (!Array.isArray(input.evidenceRefs) || input.evidenceRefs.length === 0) {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: evidenceRefs must not be empty");
  }
  input.evidenceRefs.forEach((ref, index) => requiredString(ref, `evidenceRefs[${index}]`));

  const withoutHash: Omit<AssuranceReport, "sha256"> = {
    schemaVersion: "1.0.0",
    ...input,
    snapshotSha: input.snapshotSha.trim(),
    evidenceRefs: input.evidenceRefs.map(ref => ref.trim())
  };
  return { ...withoutHash, sha256: sha256(withoutHash) };
}

export function verifyAssuranceReport(report: AssuranceReport): { valid: true; sha256: string } {
  if (report?.schemaVersion !== "1.0.0") {
    throw new Error("INDEPENDENT_ASSURANCE_REPORT_SCHEMA_UNSUPPORTED");
  }
  if (!AUDITOR_ROLES.has(report.auditorRole)) {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: auditorRole is unknown");
  }
  if (!REPORT_VERDICTS.has(report.verdict)) {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: report verdict is unknown");
  }
  requiredString(report.snapshotSha, "report.snapshotSha");
  requiredString(report.generatedAt, "report.generatedAt");
  report.findings.forEach(validateFinding);
  if (!Array.isArray(report.evidenceRefs) || report.evidenceRefs.length === 0) {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: report evidenceRefs must not be empty");
  }

  const expected = sha256(withoutReportHash(report));
  if (!/^[a-f0-9]{64}$/.test(report.sha256) || report.sha256 !== expected) {
    throw new Error("INDEPENDENT_ASSURANCE_REPORT_SHA_MISMATCH: report is tampered or malformed");
  }
  return { valid: true, sha256: report.sha256 };
}

function countOpen(reports: AssuranceReport[], severity: AssuranceSeverity): number {
  return reports.reduce(
    (count, report) => count + report.findings.filter(finding => finding.status === "OPEN" && finding.severity === severity).length,
    0
  );
}

export function compileIndependentAssurance(input: IndependentAssuranceInput): IndependentAssuranceEvidence {
  const snapshotSha = requiredString(input?.snapshotSha, "snapshotSha");
  requiredString(input?.evidenceRef, "evidenceRef");
  requiredString(input?.generatedAt, "generatedAt");
  if (typeof input?.externalMandate !== "boolean") {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: externalMandate must be boolean");
  }
  if (!Array.isArray(input?.specialistReports) || input.specialistReports.length !== 5) {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: exactly five specialist reports are required");
  }

  const seenRoles = new Set<string>();
  for (const report of input.specialistReports) {
    verifyAssuranceReport(report);
    if (!SPECIALIST_ROLES.includes(report.auditorRole as AssuranceSpecialistRole)) {
      throw new Error("INDEPENDENT_ASSURANCE_INVALID: specialist report has an invalid role");
    }
    if (seenRoles.has(report.auditorRole)) {
      throw new Error(`INDEPENDENT_ASSURANCE_INVALID: duplicate specialist role ${report.auditorRole}`);
    }
    seenRoles.add(report.auditorRole);
    if (report.snapshotSha !== snapshotSha) {
      throw new Error("INDEPENDENT_ASSURANCE_SNAPSHOT_MISMATCH: specialist report differs from council snapshot");
    }
  }

  for (const requiredRole of SPECIALIST_ROLES) {
    if (!seenRoles.has(requiredRole)) {
      throw new Error(`INDEPENDENT_ASSURANCE_INVALID: required specialist role ${requiredRole} is missing`);
    }
  }

  verifyAssuranceReport(input.arbiterReport);
  if (input.arbiterReport.auditorRole !== "ASSURANCE_ARBITER") {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: arbiterReport must use ASSURANCE_ARBITER role");
  }
  if (input.arbiterReport.snapshotSha !== snapshotSha) {
    throw new Error("INDEPENDENT_ASSURANCE_SNAPSHOT_MISMATCH: arbiter report differs from council snapshot");
  }

  const reports = [...input.specialistReports, input.arbiterReport];
  const openP0 = countOpen(reports, "P0");
  const openP1 = countOpen(reports, "P1");
  const specialistPassCount = input.specialistReports.filter(report => report.verdict === "PASS").length;

  let verdict: IndependentAssuranceVerdict;
  if (openP0 > 0) verdict = "BLOCK";
  else if (openP1 > 0) verdict = "HOLD";
  else if (specialistPassCount < 4) verdict = "HOLD";
  else if (input.arbiterReport.verdict === "BLOCK") verdict = "BLOCK";
  else if (input.arbiterReport.verdict !== "PASS") verdict = "HOLD";
  else if (input.externalMandate) verdict = "EXTERNAL_ASSURANCE_REQUIRED";
  else verdict = "INTERNAL_BIG4_PASS";

  const withoutHash: Omit<IndependentAssuranceEvidence, "sha256"> = {
    schemaVersion: "1.0.0",
    mode: "internal-agentic",
    verdict,
    snapshotSha,
    specialistPassCount,
    specialistTotal: 5,
    openP0,
    openP1,
    auditorReportHashes: input.specialistReports.map(report => report.sha256),
    arbiterReportHash: input.arbiterReport.sha256,
    externalMandate: input.externalMandate,
    evidenceRef: input.evidenceRef.trim(),
    generatedAt: input.generatedAt.trim()
  };

  return { ...withoutHash, sha256: sha256(withoutHash) };
}

export function verifyIndependentAssurance(
  evidence: IndependentAssuranceEvidence
): { valid: true; sha256: string; verdict: IndependentAssuranceVerdict } {
  if (evidence?.schemaVersion !== "1.0.0") {
    throw new Error("INDEPENDENT_ASSURANCE_SCHEMA_UNSUPPORTED");
  }
  if (!ASSURANCE_MODES.has(evidence.mode)) {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: assurance mode is unknown");
  }
  if (!ASSURANCE_VERDICTS.has(evidence.verdict)) {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: assurance verdict is unknown");
  }
  requiredString(evidence.snapshotSha, "evidence.snapshotSha");
  requiredString(evidence.evidenceRef, "evidence.evidenceRef");
  requiredString(evidence.generatedAt, "evidence.generatedAt");
  if (!Number.isInteger(evidence.specialistPassCount) || evidence.specialistPassCount < 0 || evidence.specialistPassCount > 5) {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: specialistPassCount must be an integer between 0 and 5");
  }
  if (evidence.specialistTotal !== 5) {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: specialistTotal must be 5");
  }
  if (!Number.isInteger(evidence.openP0) || evidence.openP0 < 0 || !Number.isInteger(evidence.openP1) || evidence.openP1 < 0) {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: openP0/openP1 must be non-negative integers");
  }
  if (!Array.isArray(evidence.auditorReportHashes) || evidence.auditorReportHashes.length !== 5
    || evidence.auditorReportHashes.some(hash => !/^[a-f0-9]{64}$/.test(hash))) {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: five valid specialist report hashes are required");
  }
  if (!/^[a-f0-9]{64}$/.test(evidence.arbiterReportHash)) {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: arbiterReportHash is invalid");
  }
  if (typeof evidence.externalMandate !== "boolean") {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: externalMandate must be boolean");
  }
  if (evidence.mode === "internal-agentic" && evidence.verdict === "EXTERNAL_PASS") {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: internal-agentic evidence cannot assert EXTERNAL_PASS");
  }
  if (evidence.externalMandate && evidence.verdict === "INTERNAL_BIG4_PASS") {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: external mandate cannot be downgraded to internal pass");
  }
  if (evidence.openP0 > 0 && evidence.verdict !== "BLOCK") {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: open P0 requires BLOCK");
  }
  if (evidence.openP0 === 0 && evidence.openP1 > 0 && evidence.verdict === "INTERNAL_BIG4_PASS") {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: open P1 prevents internal pass");
  }
  if (evidence.specialistPassCount < 4 && evidence.verdict === "INTERNAL_BIG4_PASS") {
    throw new Error("INDEPENDENT_ASSURANCE_INVALID: specialist quorum is insufficient");
  }

  const expected = sha256(withoutEvidenceHash(evidence));
  if (!/^[a-f0-9]{64}$/.test(evidence.sha256) || evidence.sha256 !== expected) {
    throw new Error("INDEPENDENT_ASSURANCE_SHA_MISMATCH: council evidence is tampered or malformed");
  }

  return { valid: true, sha256: evidence.sha256, verdict: evidence.verdict };
}
