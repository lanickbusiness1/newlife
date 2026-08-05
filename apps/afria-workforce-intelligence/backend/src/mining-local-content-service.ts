import type { Identity, Tenant } from "./domain.js";
import { ControlError } from "./living-core.js";
import {
  LocalContentComplianceEngine,
  LocalContentRule,
  MiningWorkforceRecord,
  SuccessionPlan,
  type ApprovalEvidenceRef,
  type ComplianceAssessment,
} from "./mining-local-content.js";

export type AuditAction =
  | "REGISTER_RULE_DRAFT"
  | "VALIDATE_RULE"
  | "INGEST_WORKFORCE_RECORDS"
  | "RUN_COMPLIANCE_ASSESSMENT"
  | "CREATE_SUCCESSION_PLAN"
  | "APPROVE_SUCCESSION_PLAN";

export type LocalContentAuditEvent = Readonly<{
  id: string;
  tenantId: string;
  projectId: string;
  actorId: string;
  actorKind: Identity["kind"];
  action: AuditAction;
  aggregateId: string;
  occurredAt: string;
  payload: Readonly<Record<string, unknown>>;
}>;

export type MissionControlSnapshot = Readonly<{
  tenantId: string;
  rules: number;
  workforceRecords: number;
  assessments: number;
  successionPlans: number;
  auditEvents: number;
  status: "HEALTHY";
}>;

export interface LocalContentRepository {
  createRule(rule: LocalContentRule): void;
  updateRule(rule: LocalContentRule): void;
  getRule(tenantId: string, ruleId: string): LocalContentRule | undefined;
  addWorkforceRecords(records: readonly MiningWorkforceRecord[]): void;
  listWorkforceRecords(tenantId: string, projectId: string): readonly MiningWorkforceRecord[];
  getWorkforceRecord(tenantId: string, recordId: string): MiningWorkforceRecord | undefined;
  findWorkforceRecordByEmployee(
    tenantId: string,
    projectId: string,
    employeeId: string,
  ): MiningWorkforceRecord | undefined;
  addAssessment(assessment: ComplianceAssessment): void;
  createSuccessionPlan(plan: SuccessionPlan): void;
  updateSuccessionPlan(plan: SuccessionPlan): void;
  getSuccessionPlan(tenantId: string, planId: string): SuccessionPlan | undefined;
  appendAuditEvent(event: LocalContentAuditEvent): void;
  auditTrail(tenantId: string): readonly LocalContentAuditEvent[];
  snapshot(tenantId: string): MissionControlSnapshot;
}

export class InMemoryLocalContentRepository implements LocalContentRepository {
  private readonly rules = new Map<string, LocalContentRule>();
  private readonly workforceRecords = new Map<string, MiningWorkforceRecord>();
  private readonly assessments: ComplianceAssessment[] = [];
  private readonly successionPlans = new Map<string, SuccessionPlan>();
  private readonly auditEvents: LocalContentAuditEvent[] = [];

  createRule(rule: LocalContentRule): void {
    const key = objectKey(rule.tenantId, rule.id);
    if (this.rules.has(key)) throw new ControlError("Duplicate rule identity");
    this.rules.set(key, rule);
  }

  updateRule(rule: LocalContentRule): void {
    const key = objectKey(rule.tenantId, rule.id);
    if (!this.rules.has(key)) throw new ControlError("Rule not found");
    this.rules.set(key, rule);
  }

  getRule(tenantId: string, ruleId: string): LocalContentRule | undefined {
    return this.rules.get(objectKey(tenantId, ruleId));
  }

  addWorkforceRecords(records: readonly MiningWorkforceRecord[]): void {
    for (const record of records) {
      const key = objectKey(record.tenantId, record.id);
      if (this.workforceRecords.has(key)) throw new ControlError("Duplicate workforce record identity");
    }
    for (const record of records) this.workforceRecords.set(objectKey(record.tenantId, record.id), record);
  }

  listWorkforceRecords(tenantId: string, projectId: string): readonly MiningWorkforceRecord[] {
    return [...this.workforceRecords.values()].filter(
      (record) => record.tenantId === tenantId && record.projectId === projectId,
    );
  }

  getWorkforceRecord(tenantId: string, recordId: string): MiningWorkforceRecord | undefined {
    return this.workforceRecords.get(objectKey(tenantId, recordId));
  }

  findWorkforceRecordByEmployee(
    tenantId: string,
    projectId: string,
    employeeId: string,
  ): MiningWorkforceRecord | undefined {
    return [...this.workforceRecords.values()].find(
      (record) =>
        record.tenantId === tenantId &&
        record.projectId === projectId &&
        record.employeeId === employeeId,
    );
  }

  addAssessment(assessment: ComplianceAssessment): void {
    this.assessments.push(assessment);
  }

  createSuccessionPlan(plan: SuccessionPlan): void {
    const key = objectKey(plan.tenantId, plan.id);
    if (this.successionPlans.has(key)) throw new ControlError("Duplicate succession plan identity");
    this.successionPlans.set(key, plan);
  }

  updateSuccessionPlan(plan: SuccessionPlan): void {
    const key = objectKey(plan.tenantId, plan.id);
    if (!this.successionPlans.has(key)) throw new ControlError("Succession plan not found");
    this.successionPlans.set(key, plan);
  }

  getSuccessionPlan(tenantId: string, planId: string): SuccessionPlan | undefined {
    return this.successionPlans.get(objectKey(tenantId, planId));
  }

  appendAuditEvent(event: LocalContentAuditEvent): void {
    this.auditEvents.push(event);
  }

  auditTrail(tenantId: string): readonly LocalContentAuditEvent[] {
    return this.auditEvents.filter((event) => event.tenantId === tenantId);
  }

  snapshot(tenantId: string): MissionControlSnapshot {
    return Object.freeze({
      tenantId,
      rules: countTenantValues(this.rules, tenantId),
      workforceRecords: countTenantValues(this.workforceRecords, tenantId),
      assessments: this.assessments.filter((assessment) => assessment.tenantId === tenantId).length,
      successionPlans: countTenantValues(this.successionPlans, tenantId),
      auditEvents: this.auditEvents.filter((event) => event.tenantId === tenantId).length,
      status: "HEALTHY",
    });
  }
}

export type LocalContentServiceRuntime = Readonly<{
  now: () => string;
  nextId: () => string;
}>;

const defaultRuntime: LocalContentServiceRuntime = Object.freeze({
  now: () => new Date().toISOString(),
  nextId: () => crypto.randomUUID(),
});

export class MiningLocalContentService {
  private readonly complianceEngine = new LocalContentComplianceEngine();

  constructor(
    private readonly repository: LocalContentRepository,
    private readonly runtime: LocalContentServiceRuntime = defaultRuntime,
  ) {}

  registerRuleDraft(input: {
    tenant: Tenant;
    actor: Identity;
    rule: LocalContentRule;
  }): LocalContentRule {
    const { tenant, actor, rule } = input;
    authorize(tenant, actor, "LEGAL_EDITOR");
    assertSameTenant(tenant.id, rule.tenantId);
    if (rule.state !== "DRAFT") throw new ControlError("Only draft rules can be registered");
    if (rule.source.jurisdiction !== tenant.jurisdiction) {
      throw new ControlError("Legal source jurisdiction does not match tenant jurisdiction");
    }
    this.repository.createRule(rule);
    this.audit(actor, rule.projectId, "REGISTER_RULE_DRAFT", rule.id, {
      sourceId: rule.source.id,
      sourceSha256: rule.source.sha256,
      thresholdPercent: rule.thresholdPercent,
    });
    return rule;
  }

  validateRule(input: {
    tenant: Tenant;
    actor: Identity;
    ruleId: string;
    proof: ApprovalEvidenceRef;
  }): LocalContentRule {
    const { tenant, actor, ruleId, proof } = input;
    authorize(tenant, actor, "LEGAL_APPROVER");
    const rule = this.requireRule(tenant.id, ruleId);
    const validated = rule.validate(actor, proof);
    this.repository.updateRule(validated);
    this.audit(actor, validated.projectId, "VALIDATE_RULE", validated.id, {
      evidenceId: proof.id,
      evidenceSha256: proof.sha256,
      version: validated.version,
    });
    return validated;
  }

  ingestWorkforceRecords(input: {
    tenant: Tenant;
    actor: Identity;
    records: readonly MiningWorkforceRecord[];
  }): readonly MiningWorkforceRecord[] {
    const { tenant, actor, records } = input;
    authorize(tenant, actor, "DATA_STEWARD");
    if (records.length === 0) throw new ControlError("At least one workforce record is required");
    for (const record of records) assertSameTenant(tenant.id, record.tenantId);
    this.repository.addWorkforceRecords(records);
    const projectIds = [...new Set(records.map((record) => record.projectId))];
    for (const projectId of projectIds) {
      this.audit(actor, projectId, "INGEST_WORKFORCE_RECORDS", projectId, {
        recordCount: records.filter((record) => record.projectId === projectId).length,
      });
    }
    return [...records];
  }

  runAssessment(input: {
    tenant: Tenant;
    actor: Identity;
    ruleId: string;
    asOf: string;
  }): ComplianceAssessment {
    const { tenant, actor, ruleId, asOf } = input;
    authorize(tenant, actor, "COMPLIANCE_ANALYST");
    const rule = this.requireRule(tenant.id, ruleId);
    const records = this.repository.listWorkforceRecords(tenant.id, rule.projectId);
    const assessment = this.complianceEngine.evaluate({ tenant, rule, records, asOf });
    this.repository.addAssessment(assessment);
    this.audit(actor, rule.projectId, "RUN_COMPLIANCE_ASSESSMENT", rule.id, {
      status: assessment.status,
      ratioPercent: assessment.ratioPercent,
      gapPercent: assessment.gapPercent,
      evidenceCoveragePercent: assessment.evidenceCoveragePercent,
      assessedAsOf: assessment.assessedAsOf,
    });
    return assessment;
  }

  createSuccessionPlan(input: {
    tenant: Tenant;
    actor: Identity;
    plan: SuccessionPlan;
  }): SuccessionPlan {
    const { tenant, actor, plan } = input;
    authorize(tenant, actor, "HR_PLANNER");
    assertSameTenant(tenant.id, plan.tenantId);
    if (plan.state !== "DRAFT") throw new ControlError("Only draft succession plans can be created");

    const expatriateRecord = this.repository.getWorkforceRecord(tenant.id, plan.expatriateWorkforceRecordId);
    if (!expatriateRecord || expatriateRecord.projectId !== plan.projectId) {
      throw new ControlError("Expatriate workforce record not found in the succession project");
    }
    if (expatriateRecord.nationalityStatus !== "EXPATRIATE") {
      throw new ControlError("Succession source role must belong to an expatriate workforce record");
    }
    const nationalCandidate = this.repository.findWorkforceRecordByEmployee(
      tenant.id,
      plan.projectId,
      plan.nationalCandidateEmployeeId,
    );
    if (!nationalCandidate || nationalCandidate.nationalityStatus !== "NATIONAL") {
      throw new ControlError("Succession candidate must be a national employee in the same project");
    }

    this.repository.createSuccessionPlan(plan);
    this.audit(actor, plan.projectId, "CREATE_SUCCESSION_PLAN", plan.id, {
      expatriateWorkforceRecordId: plan.expatriateWorkforceRecordId,
      nationalCandidateEmployeeId: plan.nationalCandidateEmployeeId,
      readinessPercent: plan.readinessPercent(),
    });
    return plan;
  }

  approveSuccessionPlan(input: {
    tenant: Tenant;
    actor: Identity;
    planId: string;
    proof: ApprovalEvidenceRef;
  }): SuccessionPlan {
    const { tenant, actor, planId, proof } = input;
    authorize(tenant, actor, "HR_APPROVER");
    const plan = this.repository.getSuccessionPlan(tenant.id, planId);
    if (!plan) throw new ControlError("Succession plan not found");
    const approved = plan.approve(actor, proof);
    this.repository.updateSuccessionPlan(approved);
    this.audit(actor, approved.projectId, "APPROVE_SUCCESSION_PLAN", approved.id, {
      evidenceId: proof.id,
      evidenceSha256: proof.sha256,
      readinessPercent: approved.readinessPercent(),
      version: approved.version,
    });
    return approved;
  }

  missionControlSnapshot(input: { tenant: Tenant; actor: Identity }): MissionControlSnapshot {
    authorize(input.tenant, input.actor, "AUDITOR");
    return this.repository.snapshot(input.tenant.id);
  }

  auditTrail(input: { tenant: Tenant; actor: Identity }): readonly LocalContentAuditEvent[] {
    authorize(input.tenant, input.actor, "AUDITOR");
    return this.repository.auditTrail(input.tenant.id);
  }

  private requireRule(tenantId: string, ruleId: string): LocalContentRule {
    const rule = this.repository.getRule(tenantId, ruleId);
    if (!rule) throw new ControlError("Rule not found");
    return rule;
  }

  private audit(
    actor: Identity,
    projectId: string,
    action: AuditAction,
    aggregateId: string,
    payload: Readonly<Record<string, unknown>>,
  ): void {
    this.repository.appendAuditEvent(Object.freeze({
      id: this.runtime.nextId(),
      tenantId: actor.tenantId,
      projectId,
      actorId: actor.id,
      actorKind: actor.kind,
      action,
      aggregateId,
      occurredAt: this.runtime.now(),
      payload: Object.freeze({ ...payload }),
    }));
  }
}

function authorize(tenant: Tenant, actor: Identity, requiredRole: string): void {
  assertSameTenant(tenant.id, actor.tenantId);
  if (!actor.roles.includes(requiredRole)) throw new ControlError(`Required role missing: ${requiredRole}`);
}

function assertSameTenant(expectedTenantId: string, actualTenantId: string): void {
  if (actualTenantId !== expectedTenantId) throw new ControlError("Tenant isolation violation");
}

function objectKey(tenantId: string, objectId: string): string {
  return `${tenantId}:${objectId}`;
}

function countTenantValues<T extends { readonly tenantId: string }>(
  values: ReadonlyMap<string, T>,
  tenantId: string,
): number {
  return [...values.values()].filter((value) => value.tenantId === tenantId).length;
}
