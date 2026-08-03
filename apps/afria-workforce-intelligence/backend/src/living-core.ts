import { randomUUID } from "node:crypto";
import { Employee, type EvidenceRef, type Identity, type Tenant } from "./domain.js";

export type DomainEvent = Readonly<{
  id: string;
  tenantId: string;
  type: string;
  aggregateId: string;
  actorId: string;
  occurredAt: string;
  payload: Readonly<Record<string, unknown>>;
}>;

export interface EvidenceVault {
  append(input: Omit<EvidenceRef, "id" | "createdAt">): EvidenceRef;
  all(): readonly EvidenceRef[];
}

export class InMemoryEvidenceVault implements EvidenceVault {
  private readonly records: EvidenceRef[] = [];

  append(input: Omit<EvidenceRef, "id" | "createdAt">): EvidenceRef {
    const record = Object.freeze({ id: randomUUID(), createdAt: new Date().toISOString(), ...input });
    this.records.push(record);
    return record;
  }

  all(): readonly EvidenceRef[] {
    return [...this.records];
  }
}

export class ControlError extends Error {}

export class WorkforceLivingCore {
  private readonly events: DomainEvent[] = [];

  constructor(private readonly evidenceVault: EvidenceVault) {}

  activateEmployee(input: {
    tenant: Tenant;
    actor: Identity;
    employee: Employee;
  }): Employee {
    const { tenant, actor, employee } = input;
    if (tenant.id !== employee.tenantId || actor.tenantId !== employee.tenantId) {
      throw new ControlError("Tenant isolation violation");
    }
    if (!actor.roles.includes("HR_APPROVER")) {
      throw new ControlError("Human approval role required");
    }
    if (actor.kind !== "HUMAN") {
      throw new ControlError("Sensitive HR activation requires a human actor");
    }

    const proof = this.evidenceVault.append({ kind: "EMPLOYEE_ACTIVATION_APPROVAL" });
    const activated = employee.activate(proof);
    this.events.push(Object.freeze({
      id: randomUUID(),
      tenantId: employee.tenantId,
      type: "EmployeeActivated",
      aggregateId: employee.id,
      actorId: actor.id,
      occurredAt: new Date().toISOString(),
      payload: Object.freeze({ version: activated.version, evidenceId: proof.id }),
    }));
    return activated;
  }

  eventStream(): readonly DomainEvent[] {
    return [...this.events];
  }

  missionControlSnapshot(): Readonly<{ events: number; evidence: number; status: "HEALTHY" }> {
    return Object.freeze({
      events: this.events.length,
      evidence: this.evidenceVault.all().length,
      status: "HEALTHY",
    });
  }
}
