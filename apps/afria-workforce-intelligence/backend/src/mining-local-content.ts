import type { EmployeeState, EnterpriseObject, EvidenceRef, Identity, Tenant } from "./domain.js";
import { ControlError } from "./living-core.js";

export type WorkforceCategory =
  | "UNSKILLED"
  | "SKILLED"
  | "MIDDLE_MANAGEMENT"
  | "SENIOR_MANAGEMENT";

export type NationalityStatus = "NATIONAL" | "EXPATRIATE";

export class MiningWorkforceRecord implements EnterpriseObject {
  readonly objectType = "MiningWorkforceRecord";
  readonly version = 1;

  constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly projectId: string,
    readonly employeeId: string,
    readonly roleId: string,
    readonly category: WorkforceCategory,
    readonly nationalityStatus: NationalityStatus,
    readonly monthlyCostUsd: number,
    readonly state: EmployeeState = "ACTIVE",
    readonly evidence: readonly EvidenceRef[] = [],
  ) {
    if (!id.trim()) throw new Error("Workforce record id is required");
    if (!projectId.trim()) throw new Error("Mining project id is required");
    if (!employeeId.trim()) throw new Error("Employee id is required");
    if (!roleId.trim()) throw new Error("Role id is required");
    if (!Number.isFinite(monthlyCostUsd) || monthlyCostUsd < 0) {
      throw new Error("Monthly cost must be a non-negative finite number");
    }
  }
}

export type LegalSourceRef = Readonly<{
  id: string;
  title: string;
  url: string;
  jurisdiction: string;
  version: string;
  effectiveFrom: string;
  effectiveTo?: string;
}>;

export type LocalContentRuleState = "DRAFT" | "VALIDATED" | "RETIRED";

export class LocalContentRule implements EnterpriseObject {
  readonly objectType = "LocalContentRule";
  readonly evidence: readonly EvidenceRef[];
  readonly version: number;

  constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly projectId: string,
    readonly category: WorkforceCategory | "ALL",
    readonly thresholdPercent: number,
    readonly source: LegalSourceRef,
    readonly state: LocalContentRuleState = "DRAFT",
    evidence: readonly EvidenceRef[] = [],
    version = 1,
    readonly validatedByIdentityId: string | null = null,
  ) {
    if (!id.trim()) throw new Error("Rule id is required");
    if (!projectId.trim()) throw new Error("Mining project id is required");
    if (!Number.isFinite(thresholdPercent) || thresholdPercent < 0 || thresholdPercent > 100) {
      throw new Error("Threshold percent must be between 0 and 100");
    }
    assertLegalSource(source);
    this.evidence = evidence;
    this.version = version;
  }

  validate(actor: Identity, proof: EvidenceRef): LocalContentRule {
    if (actor.tenantId !== this.tenantId) throw new ControlError("Tenant isolation violation");
    if (actor.kind !== "HUMAN" || !actor.roles.includes("LEGAL_APPROVER")) {
      throw new ControlError("A human legal approver is required");
    }
    if (this.state !== "DRAFT") throw new ControlError("Only draft legal rules can be validated");
    if (proof.kind !== "LEGAL_RULE_APPROVAL") {
      throw new ControlError("Legal rule approval evidence is required");
    }

    return new LocalContentRule(
      this.id,
      this.tenantId,
      this.projectId,
      this.category,
      this.thresholdPercent,
      this.source,
      "VALIDATED",
      [...this.evidence, proof],
      this.version + 1,
      actor.id,
    );
  }
}

function assertLegalSource(source: LegalSourceRef): void {
  if (!source.id.trim() || !source.title.trim() || !source.version.trim()) {
    throw new Error("Legal source identity, title and version are required");
  }
  if (!source.jurisdiction.trim() || !source.effectiveFrom.trim()) {
    throw new Error("Legal source jurisdiction and effective date are required");
  }
  let url: URL;
  try {
    url = new URL(source.url);
  } catch {
    throw new Error("Legal source URL must be valid");
  }
  if (url.protocol !== "https:") throw new Error("Legal source URL must use HTTPS");
}

export type ComplianceAssessmentStatus = "COMPLIANT" | "NON_COMPLIANT" | "NO_DATA";

export type ComplianceAssessment = Readonly<{
  tenantId: string;
  projectId: string;
  ruleId: string;
  category: WorkforceCategory | "ALL";
  status: ComplianceAssessmentStatus;
  assessmentType: "ADVISORY";
  nationalCount: number;
  expatriateCount: number;
  totalCount: number;
  ratioPercent: number | null;
  thresholdPercent: number;
  gapPercent: number | null;
  evidenceCoveragePercent: number;
}>;

export class LocalContentComplianceEngine {
  evaluate(input: {
    tenant: Tenant;
    rule: LocalContentRule;
    records: readonly MiningWorkforceRecord[];
  }): ComplianceAssessment {
    const { tenant, rule, records } = input;
    if (rule.state !== "VALIDATED") {
      throw new ControlError("Compliance evaluation requires a validated legal rule");
    }
    if (rule.tenantId !== tenant.id) throw new ControlError("Tenant isolation violation");
    if (rule.source.jurisdiction !== tenant.jurisdiction) {
      throw new ControlError("Legal source jurisdiction does not match tenant jurisdiction");
    }

    for (const record of records) {
      if (record.tenantId !== tenant.id) throw new ControlError("Tenant isolation violation");
      if (record.projectId !== rule.projectId) throw new ControlError("Project isolation violation");
    }

    const scoped = records.filter(
      (record) => record.state === "ACTIVE" && (rule.category === "ALL" || record.category === rule.category),
    );
    const nationalCount = scoped.filter((record) => record.nationalityStatus === "NATIONAL").length;
    const expatriateCount = scoped.filter((record) => record.nationalityStatus === "EXPATRIATE").length;
    const totalCount = scoped.length;
    const evidenceCount = scoped.filter((record) => record.evidence.length > 0).length;
    const evidenceCoveragePercent = totalCount === 0 ? 0 : roundPercent((evidenceCount / totalCount) * 100);

    if (totalCount === 0) {
      return Object.freeze({
        tenantId: tenant.id,
        projectId: rule.projectId,
        ruleId: rule.id,
        category: rule.category,
        status: "NO_DATA",
        assessmentType: "ADVISORY",
        nationalCount,
        expatriateCount,
        totalCount,
        ratioPercent: null,
        thresholdPercent: rule.thresholdPercent,
        gapPercent: null,
        evidenceCoveragePercent,
      });
    }

    const ratioPercent = roundPercent((nationalCount / totalCount) * 100);
    const gapPercent = Math.max(0, roundPercent(rule.thresholdPercent - ratioPercent));
    return Object.freeze({
      tenantId: tenant.id,
      projectId: rule.projectId,
      ruleId: rule.id,
      category: rule.category,
      status: ratioPercent >= rule.thresholdPercent ? "COMPLIANT" : "NON_COMPLIANT",
      assessmentType: "ADVISORY",
      nationalCount,
      expatriateCount,
      totalCount,
      ratioPercent,
      thresholdPercent: rule.thresholdPercent,
      gapPercent,
      evidenceCoveragePercent,
    });
  }
}

export type SuccessionPlanState = "DRAFT" | "APPROVED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export class SuccessionPlan implements EnterpriseObject {
  readonly objectType = "SuccessionPlan";
  readonly evidence: readonly EvidenceRef[];
  readonly version: number;

  constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly projectId: string,
    readonly expatriateWorkforceRecordId: string,
    readonly nationalCandidateEmployeeId: string,
    readonly requiredSkills: readonly string[],
    readonly candidateSkills: readonly string[],
    readonly targetDate: string,
    readonly state: SuccessionPlanState = "DRAFT",
    evidence: readonly EvidenceRef[] = [],
    version = 1,
    readonly approvedByIdentityId: string | null = null,
  ) {
    if (!id.trim()) throw new Error("Succession plan id is required");
    if (!projectId.trim()) throw new Error("Mining project id is required");
    if (!expatriateWorkforceRecordId.trim()) throw new Error("Expatriate workforce record id is required");
    if (!nationalCandidateEmployeeId.trim()) throw new Error("National candidate employee id is required");
    if (requiredSkills.length === 0) throw new Error("At least one required skill is required");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) throw new Error("Target date must use YYYY-MM-DD");
    this.evidence = evidence;
    this.version = version;
  }

  readinessPercent(): number {
    const candidateSkills = new Set(this.candidateSkills);
    const requiredSkills = new Set(this.requiredSkills);
    const matched = [...requiredSkills].filter((skill) => candidateSkills.has(skill)).length;
    return Math.round((matched / requiredSkills.size) * 100);
  }

  approve(actor: Identity, proof: EvidenceRef): SuccessionPlan {
    if (actor.tenantId !== this.tenantId) throw new ControlError("Tenant isolation violation");
    if (actor.kind !== "HUMAN" || !actor.roles.includes("HR_APPROVER")) {
      throw new ControlError("A human HR approver is required");
    }
    if (this.state !== "DRAFT") throw new ControlError("Only draft succession plans can be approved");
    if (proof.kind !== "SUCCESSION_PLAN_APPROVAL") {
      throw new ControlError("Succession plan approval evidence is required");
    }

    return new SuccessionPlan(
      this.id,
      this.tenantId,
      this.projectId,
      this.expatriateWorkforceRecordId,
      this.nationalCandidateEmployeeId,
      this.requiredSkills,
      this.candidateSkills,
      this.targetDate,
      "APPROVED",
      [...this.evidence, proof],
      this.version + 1,
      actor.id,
    );
  }
}

function roundPercent(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
