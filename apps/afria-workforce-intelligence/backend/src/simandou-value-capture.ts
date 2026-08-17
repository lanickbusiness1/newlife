import type { EnterpriseObject, Identity } from "./domain.js";
import { ControlError } from "./living-core.js";

export type TruthClass = "FACT" | "HYPOTHESIS" | "SIMULATION";

export type EconomicValueBucket =
  | "PUBLIC_REVENUE"
  | "STATE_EQUITY"
  | "LOCAL_PAYROLL"
  | "LOCAL_PROCUREMENT"
  | "DOMESTIC_TRANSFORMATION"
  | "FX_RETENTION";

export type EvidenceLink = Readonly<{
  evidenceId: string;
  source: string;
  sha256: string;
  observedAt: string;
  truthClass: TruthClass;
}>;

export interface SimandouEnterpriseObject extends Omit<EnterpriseObject, "evidence"> {
  readonly projectId: string;
  readonly evidence: readonly EvidenceLink[];
}

abstract class BaseSimandouObject implements SimandouEnterpriseObject {
  readonly version: number;
  readonly state: string;
  readonly evidence: readonly EvidenceLink[];

  constructor(
    readonly objectType: string,
    readonly id: string,
    readonly tenantId: string,
    readonly projectId: string,
    evidence: readonly EvidenceLink[],
    state = "RECORDED",
    version = 1,
  ) {
    assertRequired(id, `${objectType} id`);
    assertRequired(tenantId, `${objectType} tenant`);
    assertRequired(projectId, `${objectType} project`);
    if (!Number.isInteger(version) || version < 1) throw new Error(`${objectType} version must be a positive integer`);
    validateEvidenceLinks(evidence);
    this.state = state;
    this.version = version;
    this.evidence = Object.freeze([...evidence]);
  }
}

export class OreLot extends BaseSimandouObject {
  constructor(
    id: string,
    tenantId: string,
    projectId: string,
    readonly tonnage: number,
    readonly gradeFePercent: number,
    readonly extractedAt: string,
    evidence: readonly EvidenceLink[],
    version = 1,
  ) {
    super("OreLot", id, tenantId, projectId, evidence, "RECORDED", version);
    assertNonNegative(tonnage, "Ore lot tonnage");
    assertPercent(gradeFePercent, "Ore lot grade");
    assertIsoDate(extractedAt, "Ore lot extraction date");
  }
}

export class GradeCertificate extends BaseSimandouObject {
  constructor(
    id: string,
    tenantId: string,
    projectId: string,
    readonly oreLotId: string,
    readonly gradeFePercent: number,
    readonly moisturePercent: number,
    readonly certifiedAt: string,
    evidence: readonly EvidenceLink[],
    version = 1,
  ) {
    super("GradeCertificate", id, tenantId, projectId, evidence, "CERTIFIED", version);
    assertRequired(oreLotId, "Grade certificate ore lot id");
    assertPercent(gradeFePercent, "Grade certificate grade");
    assertPercent(moisturePercent, "Grade certificate moisture");
    assertIsoDate(certifiedAt, "Grade certificate date");
  }
}

export class PortShipment extends BaseSimandouObject {
  constructor(
    id: string,
    tenantId: string,
    projectId: string,
    readonly oreLotId: string,
    readonly tonnage: number,
    readonly gradeFePercent: number,
    readonly loadedAt: string,
    evidence: readonly EvidenceLink[],
    version = 1,
  ) {
    super("PortShipment", id, tenantId, projectId, evidence, "LOADED", version);
    assertRequired(oreLotId, "Port shipment ore lot id");
    assertNonNegative(tonnage, "Shipment tonnage");
    assertPercent(gradeFePercent, "Shipment grade");
    assertIsoDate(loadedAt, "Shipment loading date");
  }
}

export class SaleContract extends BaseSimandouObject {
  constructor(
    id: string,
    tenantId: string,
    projectId: string,
    readonly shipmentId: string,
    readonly buyerName: string,
    readonly grossSaleValue: number,
    readonly currency: string,
    readonly contractDate: string,
    readonly truthClass: TruthClass,
    evidence: readonly EvidenceLink[],
    version = 1,
  ) {
    super("SaleContract", id, tenantId, projectId, evidence, "ACTIVE", version);
    assertRequired(shipmentId, "Sale shipment id");
    assertRequired(buyerName, "Sale buyer name");
    assertNonNegative(grossSaleValue, "Gross sale value");
    assertCurrency(currency);
    assertIsoDate(contractDate, "Sale contract date");
  }
}

export class Invoice extends BaseSimandouObject {
  constructor(
    id: string,
    tenantId: string,
    projectId: string,
    readonly saleContractId: string,
    readonly amount: number,
    readonly currency: string,
    readonly issuedAt: string,
    evidence: readonly EvidenceLink[],
    version = 1,
  ) {
    super("Invoice", id, tenantId, projectId, evidence, "ISSUED", version);
    assertRequired(saleContractId, "Invoice sale contract id");
    assertNonNegative(amount, "Invoice amount");
    assertCurrency(currency);
    assertIsoDate(issuedAt, "Invoice issue date");
  }
}

export class Payment extends BaseSimandouObject {
  constructor(
    id: string,
    tenantId: string,
    projectId: string,
    readonly invoiceId: string,
    readonly amount: number,
    readonly currency: string,
    readonly paidAt: string,
    evidence: readonly EvidenceLink[],
    version = 1,
  ) {
    super("Payment", id, tenantId, projectId, evidence, "SETTLED", version);
    assertRequired(invoiceId, "Payment invoice id");
    assertNonNegative(amount, "Payment amount");
    assertCurrency(currency);
    assertIsoDate(paidAt, "Payment date");
  }
}

export type FiscalRuleState = "DRAFT" | "VALIDATED" | "RETIRED";

export type FiscalFormula = Readonly<{
  kind: "AD_VALOREM_PERCENT";
  ratePercent: number;
  base: "GROSS_SALE_VALUE";
}>;

export class FiscalRule extends BaseSimandouObject {
  constructor(
    id: string,
    tenantId: string,
    projectId: string,
    readonly sourceId: string,
    readonly sourceVersion: string,
    readonly jurisdiction: string,
    readonly effectiveFrom: string,
    readonly effectiveTo: string | null,
    readonly formula: FiscalFormula,
    readonly state: FiscalRuleState,
    evidence: readonly EvidenceLink[],
    version = 1,
    readonly validatedByIdentityId: string | null = null,
  ) {
    super("FiscalRule", id, tenantId, projectId, evidence, state, version);
    assertRequired(sourceId, "Fiscal rule source id");
    assertRequired(sourceVersion, "Fiscal rule source version");
    assertRequired(jurisdiction, "Fiscal rule jurisdiction");
    assertIsoDate(effectiveFrom, "Fiscal rule effective date");
    if (effectiveTo !== null) {
      assertIsoDate(effectiveTo, "Fiscal rule expiry date");
      if (effectiveTo < effectiveFrom) throw new Error("Fiscal rule expiry date cannot precede effective date");
    }
    validateFiscalFormula(formula);
  }

  validate(actor: Identity, approvalEvidence: EvidenceLink): FiscalRule {
    if (actor.tenantId !== this.tenantId) throw new ControlError("Tenant isolation violation");
    if (actor.kind !== "HUMAN" || !actor.roles.includes("LEGAL_APPROVER")) {
      throw new ControlError("A human legal approver is required");
    }
    if (this.state !== "DRAFT") throw new ControlError("Only draft fiscal rules can be validated");
    validateEvidenceLinks([approvalEvidence]);
    return new FiscalRule(
      this.id,
      this.tenantId,
      this.projectId,
      this.sourceId,
      this.sourceVersion,
      this.jurisdiction,
      this.effectiveFrom,
      this.effectiveTo,
      this.formula,
      "VALIDATED",
      [...this.evidence, approvalEvidence],
      this.version + 1,
      actor.id,
    );
  }
}

export class FiscalObligation extends BaseSimandouObject {
  constructor(
    id: string,
    tenantId: string,
    projectId: string,
    readonly fiscalRuleId: string,
    readonly saleContractId: string,
    readonly expectedAmount: number,
    readonly currency: string,
    readonly dueDate: string,
    readonly truthClass: TruthClass,
    evidence: readonly EvidenceLink[],
    version = 1,
  ) {
    super("FiscalObligation", id, tenantId, projectId, evidence, "EXPECTED", version);
    assertRequired(fiscalRuleId, "Fiscal obligation rule id");
    assertRequired(saleContractId, "Fiscal obligation sale contract id");
    assertNonNegative(expectedAmount, "Fiscal obligation amount");
    assertCurrency(currency);
    assertIsoDate(dueDate, "Fiscal obligation due date");
  }
}

export function computeFiscalObligation(input: {
  rule: FiscalRule;
  sale: SaleContract;
  asOf: string;
  jurisdiction: string;
  obligationId: string;
  dueDate: string;
}): FiscalObligation {
  assertIsoDate(input.asOf, "Fiscal assessment date");
  assertIsoDate(input.dueDate, "Fiscal obligation due date");
  if (input.rule.state !== "VALIDATED") throw new ControlError("Fiscal computation requires a validated fiscal rule");
  if (input.rule.tenantId !== input.sale.tenantId) throw new ControlError("Tenant isolation violation");
  if (input.rule.projectId !== input.sale.projectId) throw new ControlError("Project isolation violation");
  if (input.rule.jurisdiction !== input.jurisdiction) throw new ControlError("Fiscal rule jurisdiction mismatch");
  if (input.asOf < input.rule.effectiveFrom) throw new ControlError("Fiscal rule is not yet effective");
  if (input.rule.effectiveTo !== null && input.asOf > input.rule.effectiveTo) throw new ControlError("Fiscal rule is expired");

  let expectedAmount: number;
  switch (input.rule.formula.kind) {
    case "AD_VALOREM_PERCENT":
      expectedAmount = roundMoney(input.sale.grossSaleValue * (input.rule.formula.ratePercent / 100));
      break;
  }

  return new FiscalObligation(
    input.obligationId,
    input.sale.tenantId,
    input.sale.projectId,
    input.rule.id,
    input.sale.id,
    expectedAmount,
    input.sale.currency,
    input.dueDate,
    input.sale.truthClass,
    [...input.rule.evidence, ...input.sale.evidence],
  );
}

export class GovernmentReceipt extends BaseSimandouObject {
  constructor(
    id: string,
    tenantId: string,
    projectId: string,
    readonly obligationId: string,
    readonly amount: number,
    readonly currency: string,
    readonly receivedAt: string,
    evidence: readonly EvidenceLink[],
    version = 1,
  ) {
    super("GovernmentReceipt", id, tenantId, projectId, evidence, "RECEIVED", version);
    assertRequired(obligationId, "Government receipt obligation id");
    assertNonNegative(amount, "Government receipt amount");
    assertCurrency(currency);
    assertIsoDate(receivedAt, "Government receipt date");
  }
}

export class StateEquityInterest extends BaseSimandouObject {
  constructor(
    id: string,
    tenantId: string,
    projectId: string,
    readonly stakePercent: number,
    readonly effectiveFrom: string,
    readonly truthClass: TruthClass,
    evidence: readonly EvidenceLink[],
    version = 1,
  ) {
    super("StateEquityInterest", id, tenantId, projectId, evidence, "ACTIVE", version);
    assertPercent(stakePercent, "State equity interest");
    assertIsoDate(effectiveFrom, "State equity effective date");
  }
}

export class DividendEvent extends BaseSimandouObject {
  constructor(
    id: string,
    tenantId: string,
    projectId: string,
    readonly stateEquityInterestId: string,
    readonly amount: number,
    readonly currency: string,
    readonly declaredAt: string,
    readonly truthClass: TruthClass,
    evidence: readonly EvidenceLink[],
    version = 1,
  ) {
    super("DividendEvent", id, tenantId, projectId, evidence, "DECLARED", version);
    assertRequired(stateEquityInterestId, "Dividend state equity interest id");
    assertNonNegative(amount, "Dividend amount");
    assertCurrency(currency);
    assertIsoDate(declaredAt, "Dividend declaration date");
  }
}

export class FXRepatriationEvent extends BaseSimandouObject {
  constructor(
    id: string,
    tenantId: string,
    projectId: string,
    readonly paymentId: string,
    readonly generatedAmount: number,
    readonly repatriatedAmount: number,
    readonly currency: string,
    readonly observedAt: string,
    readonly truthClass: TruthClass,
    evidence: readonly EvidenceLink[],
    version = 1,
  ) {
    super("FXRepatriationEvent", id, tenantId, projectId, evidence, "OBSERVED", version);
    assertRequired(paymentId, "FX repatriation payment id");
    assertNonNegative(generatedAmount, "Generated FX amount");
    assertNonNegative(repatriatedAmount, "Repatriated FX amount");
    if (repatriatedAmount > generatedAmount) throw new Error("Repatriated FX amount cannot exceed generated amount");
    assertCurrency(currency);
    assertIsoDate(observedAt, "FX repatriation observation date");
  }
}

export class ValueCaptureComponent extends BaseSimandouObject {
  constructor(
    id: string,
    tenantId: string,
    projectId: string,
    readonly bucket: EconomicValueBucket,
    readonly amount: number,
    readonly currency: string,
    readonly sourceTransactionId: string,
    evidence: readonly EvidenceLink[],
    readonly truthClass: TruthClass = "FACT",
    version = 1,
  ) {
    super("ValueCaptureComponent", id, tenantId, projectId, evidence, "RECORDED", version);
    assertNonNegative(amount, "Value capture amount");
    assertCurrency(currency);
    assertRequired(sourceTransactionId, "Value capture source transaction id");
    if (evidence.length === 0) throw new Error("Value capture component requires evidence");
  }
}

function validateEvidenceLinks(evidence: readonly EvidenceLink[]): void {
  for (const link of evidence) {
    assertRequired(link.evidenceId, "Evidence id");
    assertRequired(link.source, "Evidence source");
    if (!/^[a-f0-9]{64}$/i.test(link.sha256)) throw new Error("Evidence requires a valid SHA-256 fingerprint");
    if (Number.isNaN(Date.parse(link.observedAt))) throw new Error("Evidence observedAt timestamp is invalid");
  }
}

function validateFiscalFormula(formula: FiscalFormula): void {
  if (formula.kind !== "AD_VALOREM_PERCENT" || formula.base !== "GROSS_SALE_VALUE") {
    throw new Error("Unsupported fiscal formula");
  }
  if (!Number.isFinite(formula.ratePercent) || formula.ratePercent < 0 || formula.ratePercent > 100) {
    throw new Error("Fiscal formula rate must be between 0 and 100");
  }
}

function assertRequired(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} is required`);
}

function assertNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a non-negative finite number`);
}

function assertPercent(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`${label} must be between 0 and 100`);
}

function assertCurrency(value: string): void {
  if (!/^[A-Z]{3}$/.test(value)) throw new Error("Currency must be an uppercase ISO-4217-like code");
}

function assertIsoDate(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must use YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must be a valid calendar date`);
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
