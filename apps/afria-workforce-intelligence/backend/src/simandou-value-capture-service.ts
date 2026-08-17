import type { Identity } from "./domain.js";
import { ControlError } from "./living-core.js";
import {
  type EconomicValueBucket,
  type EvidenceLink,
  ValueCaptureComponent,
} from "./simandou-value-capture.js";

const ALL_BUCKETS: readonly EconomicValueBucket[] = [
  "PUBLIC_REVENUE",
  "STATE_EQUITY",
  "LOCAL_PAYROLL",
  "LOCAL_PROCUREMENT",
  "DOMESTIC_TRANSFORMATION",
  "FX_RETENTION",
];

const ECONOMIC_BUCKETS = new Set<EconomicValueBucket>([
  "PUBLIC_REVENUE",
  "STATE_EQUITY",
  "LOCAL_PAYROLL",
  "LOCAL_PROCUREMENT",
  "DOMESTIC_TRANSFORMATION",
]);

export type ValueCaptureMethodologyState = "DRAFT" | "VALIDATED" | "RETIRED";

export class ValueCaptureMethodology {
  readonly evidence: readonly EvidenceLink[];
  readonly objectVersion: number;

  constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly projectId: string,
    readonly methodologyVersion: string,
    readonly includedBuckets: readonly EconomicValueBucket[],
    readonly state: ValueCaptureMethodologyState,
    evidence: readonly EvidenceLink[],
    objectVersion = 1,
    readonly validatedByIdentityId: string | null = null,
  ) {
    if (!id.trim()) throw new Error("Value capture methodology id is required");
    if (!tenantId.trim()) throw new Error("Value capture methodology tenant is required");
    if (!projectId.trim()) throw new Error("Value capture methodology project is required");
    if (!methodologyVersion.trim()) throw new Error("Value capture methodology version is required");
    if (!Number.isInteger(objectVersion) || objectVersion < 1) throw new Error("Methodology object version must be positive");
    if (includedBuckets.length === 0) throw new Error("At least one value capture bucket is required");
    if (new Set(includedBuckets).size !== includedBuckets.length) throw new Error("Value capture methodology buckets must be unique");
    if (includedBuckets.includes("FX_RETENTION")) {
      throw new Error("FX retention is a sovereign metric but cannot be included in retained economic value aggregation");
    }
    for (const bucket of includedBuckets) {
      if (!ECONOMIC_BUCKETS.has(bucket)) throw new Error(`Unsupported economic value bucket: ${bucket}`);
    }
    validateEvidence(evidence);
    this.evidence = Object.freeze([...evidence]);
    this.objectVersion = objectVersion;
  }

  validate(actor: Identity, approvalEvidence: EvidenceLink): ValueCaptureMethodology {
    if (actor.tenantId !== this.tenantId) throw new ControlError("Tenant isolation violation");
    if (actor.kind !== "HUMAN" || !actor.roles.includes("METHODOLOGY_APPROVER")) {
      throw new ControlError("A human methodology approver is required");
    }
    if (this.state !== "DRAFT") throw new ControlError("Only draft value capture methodologies can be validated");
    validateEvidence([approvalEvidence]);
    return new ValueCaptureMethodology(
      this.id,
      this.tenantId,
      this.projectId,
      this.methodologyVersion,
      this.includedBuckets,
      "VALIDATED",
      [...this.evidence, approvalEvidence],
      this.objectVersion + 1,
      actor.id,
    );
  }
}

export type ValueCaptureSnapshot = Readonly<{
  status: "METHOD_NOT_APPROVED" | "READY";
  tenantId: string;
  projectId: string;
  currency: string;
  grossEconomicValue: number;
  retainedEconomicValue: number | null;
  fxRetentionAmount: number;
  valueCaptureRatioPercent: number | null;
  byBucket: Readonly<Record<EconomicValueBucket, number>>;
  componentIds: readonly string[];
  methodologyId: string | null;
  methodologyVersion: string | null;
}>;

export class ValueCaptureLedger {
  private readonly components: ValueCaptureComponent[] = [];
  private readonly ids = new Set<string>();
  private readonly bucketSourceKeys = new Set<string>();
  private readonly economicSourceIds = new Set<string>();

  constructor(
    readonly tenantId: string,
    readonly projectId: string,
    readonly currency: string,
  ) {
    if (!tenantId.trim()) throw new Error("Value capture ledger tenant is required");
    if (!projectId.trim()) throw new Error("Value capture ledger project is required");
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Value capture ledger currency must be a three-letter code");
  }

  add(component: ValueCaptureComponent): ValueCaptureComponent {
    if (component.tenantId !== this.tenantId) throw new ControlError("Tenant isolation violation");
    if (component.projectId !== this.projectId) throw new ControlError("Project isolation violation");
    if (component.currency !== this.currency) throw new ControlError("Value capture currency mismatch");
    if (this.ids.has(component.id)) throw new ControlError("Duplicate value capture component identity");

    const exactKey = `${component.bucket}:${component.sourceTransactionId}`;
    if (this.bucketSourceKeys.has(exactKey)) {
      throw new ControlError("Duplicate value capture component source within the same bucket");
    }

    if (component.bucket !== "FX_RETENTION" && this.economicSourceIds.has(component.sourceTransactionId)) {
      throw new ControlError("Economic double counting detected for source transaction");
    }

    this.components.push(component);
    this.ids.add(component.id);
    this.bucketSourceKeys.add(exactKey);
    if (component.bucket !== "FX_RETENTION") this.economicSourceIds.add(component.sourceTransactionId);
    return component;
  }

  all(): readonly ValueCaptureComponent[] {
    return Object.freeze([...this.components]);
  }

  snapshot(input: {
    grossEconomicValue: number;
    methodology: ValueCaptureMethodology | null;
  }): ValueCaptureSnapshot {
    if (!Number.isFinite(input.grossEconomicValue) || input.grossEconomicValue <= 0) {
      throw new Error("Gross economic value must be a positive finite number");
    }

    const byBucket = zeroBuckets();
    for (const component of this.components) byBucket[component.bucket] = roundMoney(byBucket[component.bucket] + component.amount);
    const fxRetentionAmount = byBucket.FX_RETENTION;

    if (input.methodology === null || input.methodology.state !== "VALIDATED") {
      return Object.freeze({
        status: "METHOD_NOT_APPROVED",
        tenantId: this.tenantId,
        projectId: this.projectId,
        currency: this.currency,
        grossEconomicValue: input.grossEconomicValue,
        retainedEconomicValue: null,
        fxRetentionAmount,
        valueCaptureRatioPercent: null,
        byBucket: Object.freeze({ ...byBucket }),
        componentIds: Object.freeze(this.components.map((item) => item.id)),
        methodologyId: input.methodology?.id ?? null,
        methodologyVersion: input.methodology?.methodologyVersion ?? null,
      });
    }

    if (input.methodology.tenantId !== this.tenantId) throw new ControlError("Tenant isolation violation");
    if (input.methodology.projectId !== this.projectId) throw new ControlError("Project isolation violation");

    const retainedEconomicValue = roundMoney(
      input.methodology.includedBuckets.reduce((sum, bucket) => sum + byBucket[bucket], 0),
    );
    const valueCaptureRatioPercent = roundPercent((retainedEconomicValue / input.grossEconomicValue) * 100);

    return Object.freeze({
      status: "READY",
      tenantId: this.tenantId,
      projectId: this.projectId,
      currency: this.currency,
      grossEconomicValue: input.grossEconomicValue,
      retainedEconomicValue,
      fxRetentionAmount,
      valueCaptureRatioPercent,
      byBucket: Object.freeze({ ...byBucket }),
      componentIds: Object.freeze(this.components.map((item) => item.id)),
      methodologyId: input.methodology.id,
      methodologyVersion: input.methodology.methodologyVersion,
    });
  }
}

function zeroBuckets(): Record<EconomicValueBucket, number> {
  return Object.fromEntries(ALL_BUCKETS.map((bucket) => [bucket, 0])) as Record<EconomicValueBucket, number>;
}

function validateEvidence(evidence: readonly EvidenceLink[]): void {
  if (evidence.length === 0) throw new Error("Value capture methodology requires evidence");
  for (const item of evidence) {
    if (!item.evidenceId.trim() || !item.source.trim()) throw new Error("Value capture methodology evidence identity and source are required");
    if (!/^[a-f0-9]{64}$/i.test(item.sha256)) throw new Error("Value capture methodology evidence requires SHA-256");
    if (Number.isNaN(Date.parse(item.observedAt))) throw new Error("Value capture methodology evidence timestamp is invalid");
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPercent(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
