export type EvidenceRef = Readonly<{ id: string; kind: string; createdAt: string }>;

export interface EnterpriseObject {
  readonly id: string;
  readonly tenantId: string;
  readonly objectType: string;
  readonly version: number;
  readonly state: string;
  readonly evidence: readonly EvidenceRef[];
}

export class Tenant implements EnterpriseObject {
  readonly objectType = "Tenant";
  readonly state = "ACTIVE";
  readonly version = 1;
  readonly evidence: readonly EvidenceRef[] = [];

  constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly name: string,
    readonly jurisdiction: string,
  ) {
    if (id !== tenantId) throw new Error("Tenant root id must equal tenantId");
    if (!name.trim()) throw new Error("Tenant name is required");
  }
}

export type IdentityKind = "HUMAN" | "AGENT" | "SERVICE";

export class Identity implements EnterpriseObject {
  readonly objectType = "Identity";
  readonly state = "ACTIVE";
  readonly version = 1;
  readonly evidence: readonly EvidenceRef[] = [];

  constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly kind: IdentityKind,
    readonly displayName: string,
    readonly roles: readonly string[],
  ) {
    if (!displayName.trim()) throw new Error("Identity display name is required");
  }
}

export type EmployeeState = "DRAFT" | "ACTIVE" | "SUSPENDED" | "EXITED";

export class Employee implements EnterpriseObject {
  readonly objectType = "Employee";
  readonly version: number;
  readonly evidence: readonly EvidenceRef[];

  constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly identityId: string,
    readonly employeeNumber: string,
    readonly state: EmployeeState = "DRAFT",
    evidence: readonly EvidenceRef[] = [],
    version = 1,
  ) {
    if (!employeeNumber.trim()) throw new Error("Employee number is required");
    this.evidence = evidence;
    this.version = version;
  }

  activate(proof: EvidenceRef): Employee {
    if (this.state !== "DRAFT") throw new Error("Only draft employees can be activated");
    return new Employee(
      this.id,
      this.tenantId,
      this.identityId,
      this.employeeNumber,
      "ACTIVE",
      [...this.evidence, proof],
      this.version + 1,
    );
  }
}
