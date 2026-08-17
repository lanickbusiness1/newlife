import { ControlError } from "./living-core.js";
import type {
  FiscalObligation,
  GovernmentReceipt,
  Invoice,
  Payment,
  PortShipment,
  SaleContract,
} from "./simandou-value-capture.js";

export type ReconciliationExceptionCode =
  | "MISSING_SALE_LINK"
  | "SALE_LINK_MISMATCH"
  | "MISSING_INVOICE_LINK"
  | "INVOICE_LINK_MISMATCH"
  | "PAYMENT_LINK_MISMATCH"
  | "PAYMENT_MISMATCH"
  | "RECEIPT_LINK_MISMATCH"
  | "RECEIPT_MISMATCH";

export class ReconciliationException {
  constructor(
    readonly code: ReconciliationExceptionCode,
    readonly message: string,
    readonly sourceObjectIds: readonly string[],
    readonly evidenceIds: readonly string[],
  ) {}
}

export type ReconciliationResult = Readonly<{
  tenantId: string;
  projectId: string;
  shipmentId: string;
  status: "MATCHED" | "EXCEPTIONS";
  invoiceAmount: number;
  paymentAmount: number;
  expectedPublicRevenue: number;
  receivedPublicRevenue: number;
  exceptions: readonly ReconciliationException[];
}>;

export function reconcileShipmentCashFlow(input: {
  shipment: PortShipment;
  sale: SaleContract | null;
  invoice: Invoice | null;
  payments: readonly Payment[];
  obligations: readonly FiscalObligation[];
  receipts: readonly GovernmentReceipt[];
  paymentTolerance?: number;
  receiptTolerance?: number;
}): ReconciliationResult {
  const paymentTolerance = input.paymentTolerance ?? 0;
  const receiptTolerance = input.receiptTolerance ?? 0;
  assertTolerance(paymentTolerance, "Payment tolerance");
  assertTolerance(receiptTolerance, "Receipt tolerance");

  const scopedObjects = [
    input.sale,
    input.invoice,
    ...input.payments,
    ...input.obligations,
    ...input.receipts,
  ].filter((value): value is NonNullable<typeof value> => value !== null);

  for (const object of scopedObjects) {
    if (object.tenantId !== input.shipment.tenantId) throw new ControlError("Tenant isolation violation");
    if (object.projectId !== input.shipment.projectId) throw new ControlError("Project isolation violation");
  }

  const exceptions: ReconciliationException[] = [];
  const evidenceIds = (object: { evidence: readonly { evidenceId: string }[] }) => object.evidence.map((item) => item.evidenceId);

  if (input.sale === null) {
    exceptions.push(new ReconciliationException(
      "MISSING_SALE_LINK",
      "Shipment has no linked sale contract",
      [input.shipment.id],
      evidenceIds(input.shipment),
    ));
  } else if (input.sale.shipmentId !== input.shipment.id) {
    exceptions.push(new ReconciliationException(
      "SALE_LINK_MISMATCH",
      "Sale contract does not reference the reconciled shipment",
      [input.shipment.id, input.sale.id],
      [...evidenceIds(input.shipment), ...evidenceIds(input.sale)],
    ));
  }

  if (input.sale !== null) {
    if (input.invoice === null) {
      exceptions.push(new ReconciliationException(
        "MISSING_INVOICE_LINK",
        "Sale contract has no linked invoice",
        [input.sale.id],
        evidenceIds(input.sale),
      ));
    } else if (input.invoice.saleContractId !== input.sale.id) {
      exceptions.push(new ReconciliationException(
        "INVOICE_LINK_MISMATCH",
        "Invoice does not reference the reconciled sale contract",
        [input.sale.id, input.invoice.id],
        [...evidenceIds(input.sale), ...evidenceIds(input.invoice)],
      ));
    }
  }

  const invoiceAmount = input.invoice?.amount ?? 0;
  let paymentAmount = 0;
  if (input.invoice !== null) {
    for (const payment of input.payments) {
      if (payment.invoiceId !== input.invoice.id) {
        exceptions.push(new ReconciliationException(
          "PAYMENT_LINK_MISMATCH",
          "Payment does not reference the reconciled invoice",
          [input.invoice.id, payment.id],
          [...evidenceIds(input.invoice), ...evidenceIds(payment)],
        ));
        continue;
      }
      if (payment.currency !== input.invoice.currency) {
        exceptions.push(new ReconciliationException(
          "PAYMENT_MISMATCH",
          "Payment currency differs from invoice currency",
          [input.invoice.id, payment.id],
          [...evidenceIds(input.invoice), ...evidenceIds(payment)],
        ));
      }
      paymentAmount += payment.amount;
    }
    if (Math.abs(paymentAmount - invoiceAmount) > paymentTolerance) {
      exceptions.push(new ReconciliationException(
        "PAYMENT_MISMATCH",
        "Total linked payments differ from invoice amount beyond configured tolerance",
        [input.invoice.id, ...input.payments.map((payment) => payment.id)],
        [...evidenceIds(input.invoice), ...input.payments.flatMap(evidenceIds)],
      ));
    }
  }

  const expectedPublicRevenue = input.obligations.reduce((sum, obligation) => sum + obligation.expectedAmount, 0);
  let receivedPublicRevenue = 0;
  const obligationById = new Map(input.obligations.map((obligation) => [obligation.id, obligation] as const));
  for (const receipt of input.receipts) {
    const obligation = obligationById.get(receipt.obligationId);
    if (!obligation) {
      exceptions.push(new ReconciliationException(
        "RECEIPT_LINK_MISMATCH",
        "Government receipt does not reference a reconciled fiscal obligation",
        [receipt.id],
        evidenceIds(receipt),
      ));
      continue;
    }
    if (receipt.currency !== obligation.currency) {
      exceptions.push(new ReconciliationException(
        "RECEIPT_MISMATCH",
        "Government receipt currency differs from fiscal obligation currency",
        [obligation.id, receipt.id],
        [...evidenceIds(obligation), ...evidenceIds(receipt)],
      ));
    }
    receivedPublicRevenue += receipt.amount;
  }

  if (Math.abs(receivedPublicRevenue - expectedPublicRevenue) > receiptTolerance) {
    exceptions.push(new ReconciliationException(
      "RECEIPT_MISMATCH",
      "Government receipts differ from expected public revenue beyond configured tolerance",
      [...input.obligations.map((item) => item.id), ...input.receipts.map((item) => item.id)],
      [...input.obligations.flatMap(evidenceIds), ...input.receipts.flatMap(evidenceIds)],
    ));
  }

  return Object.freeze({
    tenantId: input.shipment.tenantId,
    projectId: input.shipment.projectId,
    shipmentId: input.shipment.id,
    status: exceptions.length === 0 ? "MATCHED" : "EXCEPTIONS",
    invoiceAmount,
    paymentAmount,
    expectedPublicRevenue,
    receivedPublicRevenue,
    exceptions: Object.freeze(exceptions),
  });
}

export type FiscalReceiptStatus = "PENDING" | "UNDER" | "MATCHED" | "OVER" | "CONTESTED";

export type FiscalReceiptClassification = Readonly<{
  status: FiscalReceiptStatus;
  expectedAmount: number;
  receivedAmount: number;
  varianceAmount: number;
  currency: string;
  receiptIds: readonly string[];
}>;

export function classifyFiscalReceipt(input: {
  obligation: FiscalObligation;
  receipts: readonly GovernmentReceipt[];
  tolerance: number;
  contested?: boolean;
}): FiscalReceiptClassification {
  assertTolerance(input.tolerance, "Fiscal receipt tolerance");
  let receivedAmount = 0;
  for (const receipt of input.receipts) {
    if (receipt.tenantId !== input.obligation.tenantId) throw new ControlError("Tenant isolation violation");
    if (receipt.projectId !== input.obligation.projectId) throw new ControlError("Project isolation violation");
    if (receipt.obligationId !== input.obligation.id) throw new ControlError("Government receipt obligation linkage mismatch");
    if (receipt.currency !== input.obligation.currency) throw new ControlError("Government receipt currency mismatch");
    receivedAmount += receipt.amount;
  }

  const varianceAmount = roundMoney(receivedAmount - input.obligation.expectedAmount);
  let status: FiscalReceiptStatus;
  if (input.contested === true) status = "CONTESTED";
  else if (input.receipts.length === 0) status = "PENDING";
  else if (Math.abs(varianceAmount) <= input.tolerance) status = "MATCHED";
  else if (varianceAmount < 0) status = "UNDER";
  else status = "OVER";

  return Object.freeze({
    status,
    expectedAmount: input.obligation.expectedAmount,
    receivedAmount: roundMoney(receivedAmount),
    varianceAmount,
    currency: input.obligation.currency,
    receiptIds: Object.freeze(input.receipts.map((receipt) => receipt.id)),
  });
}

function assertTolerance(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a non-negative finite number`);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
