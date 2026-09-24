import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeEvidenceRecord, assessTicketRisk } from "../src/vault.mjs";

test("ticket evidence strips unnecessary sensitive data", () => {
  const record = sanitizeEvidenceRecord({
    seller: "Example Seller",
    reference: "ABC-123",
    receiptNote: "Paid by card 4111111111111111",
    email: "fan@example.com",
    phone: "+22300000000"
  });
  assert.equal("email" in record, false);
  assert.equal("phone" in record, false);
  assert.doesNotMatch(record.receiptNote, /4111111111111111/);
});

test("risk engine flags guaranteed resale and credential requests", () => {
  const result = assessTicketRisk("Guaranteed FIFA tickets, send password and card number now");
  assert.equal(result.level, "HIGH");
  assert.ok(result.signals.length >= 2);
});
