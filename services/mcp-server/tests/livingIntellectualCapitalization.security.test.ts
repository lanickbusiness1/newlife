import { createHmac } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  compileCapitalizationPlan,
  compileChatSignal,
  evaluateEditorialSignal,
  recordCapitalizationEvidence,
  receiptAttestationPayload,
  type CapitalizationReceipt,
  type CapitalizationTarget
} from "../src/livingIntellectualCapitalization";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");
const TEST_SECRET = "test-only-capitalization-receipt-secret";

function readSqlDirectory(relativePath: string): string {
  const directory = join(repoRoot, relativePath);
  return readdirSync(directory)
    .filter(name => name.endsWith(".sql"))
    .map(name => readFileSync(join(directory, name), "utf8"))
    .join("\n")
    .toLowerCase();
}

function baseInput(tenantId: string) {
  return {
    tenantId,
    conversationId: "chat-shared",
    sourceRef: "chat:shared-source",
    sourceTimestamp: "2026-08-24T02:15:00Z",
    verificationStatus: "decision_validated" as const,
    confidence: 0.98,
    content: "A durable validated GENESIS signal whose normalized content is intentionally identical across two tenants so tenant isolation can be tested in deterministic identifiers and deduplication keys.",
    evidenceRefs: ["notion:decision"],
    canonicalDecisionRef: "V4-DEC-016",
    bookSectionHint: "Security regression",
    productRefs: ["GENESIS-V4"],
    tags: ["genesis_v4", "book", "execution"]
  };
}

function connectorFor(target: CapitalizationTarget): string {
  if (target.allowedConnectorIds.includes("notion")) return "notion";
  if (target.allowedConnectorIds.includes("github")) return "github";
  return target.allowedConnectorIds[0];
}

function signedReceipt(planId: string, tenantId: string, target: CapitalizationTarget, index: number): CapitalizationReceipt {
  const unsigned = {
    targetId: target.targetId,
    receiptRef: `receipt:${target.targetId}:${index}`,
    executedAt: "2026-08-24T02:40:00Z",
    status: "success" as const,
    artifactHash: `sha256:${String(index).padStart(2, "0")}`,
    connectorId: connectorFor(target),
    nonce: target.executionNonce
  };
  const attestation = createHmac("sha256", TEST_SECRET)
    .update(receiptAttestationPayload(tenantId, planId, target, unsigned))
    .digest("hex");
  return { ...unsigned, attestation };
}

describe("V4-DEC-016 review security regressions", () => {
  test("binds fingerprints, signal ids, targets and idempotency keys to tenant with SHA-256 width", () => {
    const a = compileChatSignal(baseInput("tenant-a"));
    const b = compileChatSignal(baseInput("tenant-b"));
    const planA = compileCapitalizationPlan(a, evaluateEditorialSignal(a));
    const planB = compileCapitalizationPlan(b, evaluateEditorialSignal(b));

    expect(a.fingerprint).toMatch(/^sigfp-[0-9a-f]{64}$/);
    expect(b.fingerprint).toMatch(/^sigfp-[0-9a-f]{64}$/);
    expect(a.fingerprint).not.toBe(b.fingerprint);
    expect(a.signalId).not.toBe(b.signalId);
    expect(planA.planId).not.toBe(planB.planId);
    expect(planA.targets.map(target => target.targetId)).not.toEqual(planB.targets.map(target => target.targetId));
    expect(planA.targets.map(target => target.idempotencyKey)).not.toEqual(planB.targets.map(target => target.idempotencyKey));
  });

  test("refuses a gate evaluated for different immutable signal content even when signalId is reused", () => {
    const approved = compileChatSignal({ ...baseInput("tenant-a"), signalId: "caller-controlled-id" });
    const gate = evaluateEditorialSignal(approved);
    const substituted = compileChatSignal({
      ...baseInput("tenant-a"),
      signalId: "caller-controlled-id",
      verificationStatus: "unverified",
      confidence: 0.2,
      content: "Different unverified content reusing the same caller-controlled signal id must never inherit the approved gate result from another signal."
    });

    expect(() => compileCapitalizationPlan(substituted, gate)).toThrow("CAPITALIZATION_PLAN_GATE_BINDING_MISMATCH");
  });

  test("requires connector-authenticated receipts and rejects tampering or the wrong connector", () => {
    const signal = compileChatSignal(baseInput("tenant-a"));
    const plan = compileCapitalizationPlan(signal, evaluateEditorialSignal(signal));
    const receipts = plan.targets.map((target, index) => signedReceipt(plan.planId, plan.tenantId, target, index));

    const complete = recordCapitalizationEvidence(plan, receipts, { hmacSecret: TEST_SECRET });
    expect(complete.status).toBe("COMPLETE");

    const tampered = receipts.map(receipt => ({ ...receipt }));
    tampered[0] = { ...tampered[0], receiptRef: "receipt:tampered" };
    expect(() => recordCapitalizationEvidence(plan, tampered, { hmacSecret: TEST_SECRET }))
      .toThrow("CAPITALIZATION_RECEIPT_ATTESTATION_INVALID");

    const wrongConnectorTarget = plan.targets.find(target => !target.allowedConnectorIds.includes("github"))!;
    const wrongConnectorUnsigned = {
      targetId: wrongConnectorTarget.targetId,
      receiptRef: "receipt:wrong-connector",
      executedAt: "2026-08-24T02:40:00Z",
      status: "success" as const,
      connectorId: "github",
      nonce: wrongConnectorTarget.executionNonce
    };
    const wrongConnectorReceipt: CapitalizationReceipt = {
      ...wrongConnectorUnsigned,
      attestation: createHmac("sha256", TEST_SECRET)
        .update(receiptAttestationPayload(plan.tenantId, plan.planId, wrongConnectorTarget, wrongConnectorUnsigned))
        .digest("hex")
    };
    expect(() => recordCapitalizationEvidence(plan, [wrongConnectorReceipt], { hmacSecret: TEST_SECRET }))
      .toThrow("CAPITALIZATION_RECEIPT_CONNECTOR_NOT_ALLOWED");

    expect(() => recordCapitalizationEvidence(plan, receipts, { hmacSecret: "" }))
      .toThrow("CAPITALIZATION_RECEIPT_VERIFIER_UNAVAILABLE");
  });

  test("requires explicit RLS, table revokes and tenant-aware composite lineage constraints", () => {
    const migrations = readSqlDirectory("supabase/migrations");
    const tables = [
      "chat_signals",
      "editorial_gate_evaluations",
      "capitalization_plans",
      "capitalization_targets",
      "execution_receipts",
      "proof_chains"
    ];

    for (const table of tables) {
      expect(migrations).toContain(`alter table genesis_capitalization.${table} enable row level security`);
    }
    expect(migrations).toContain("revoke all on all tables in schema genesis_capitalization from public, anon, authenticated");
    expect(migrations).toContain("foreign key (tenant_id, chat_signal_id)");
    expect(migrations).toContain("foreign key (tenant_id, editorial_gate_evaluation_id, chat_signal_id)");
    expect(migrations).toContain("foreign key (tenant_id, capitalization_plan_id)");
    expect(migrations).toContain("foreign key (tenant_id, capitalization_target_id)");
  });

  test("fails closed when an evidence-only caller supplies a plan without authoritative plan attestation", () => {
    const signal = compileChatSignal(baseInput("tenant-a"));
    const plan = compileCapitalizationPlan(signal, evaluateEditorialSignal(signal));
    const receipts = plan.targets.map((target, index) => signedReceipt(plan.planId, plan.tenantId, target, index));

    expect(() => recordCapitalizationEvidence(plan, receipts, {
      hmacSecret: TEST_SECRET,
      planHmacSecret: "",
      planAttestation: ""
    } as any)).toThrow("CAPITALIZATION_PLAN_ATTESTATION_REQUIRED");

    const indexSource = readFileSync(join(repoRoot, "services/mcp-server/src/index.ts"), "utf8");
    expect(indexSource).toContain("GENESIS_CAPITALIZATION_PLAN_HMAC_SECRET");
    expect(indexSource).toContain("planAttestation");
  });

  test("derives the same proof identity regardless of authenticated receipt arrival order", () => {
    const signal = compileChatSignal(baseInput("tenant-a"));
    const plan = compileCapitalizationPlan(signal, evaluateEditorialSignal(signal));
    const receipts = plan.targets.map((target, index) => signedReceipt(plan.planId, plan.tenantId, target, index));

    const forward = recordCapitalizationEvidence(plan, receipts, { hmacSecret: TEST_SECRET });
    const reverse = recordCapitalizationEvidence(plan, [...receipts].reverse(), { hmacSecret: TEST_SECRET });

    expect(reverse.proofId).toBe(forward.proofId);
    expect(reverse.receipts.map(receipt => receipt.targetId)).toEqual(forward.receipts.map(receipt => receipt.targetId));
  });

  test("keeps signal gate receipt and closed proof tables append-only for service_role", () => {
    const migrations = readSqlDirectory("supabase/migrations");
    for (const table of ["chat_signals", "editorial_gate_evaluations", "execution_receipts", "proof_chains"]) {
      expect(migrations).toContain(`revoke update on genesis_capitalization.${table} from service_role`);
    }
    expect(migrations).toContain("grant update on genesis_capitalization.capitalization_plans to service_role");
    expect(migrations).toContain("grant update on genesis_capitalization.capitalization_targets to service_role");
  });
});
