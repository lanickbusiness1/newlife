import { createHmac } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  attestCapitalizationPlan,
  compileCapitalizationPlan,
  compileChatSignal,
  evaluateEditorialSignal,
  recordCapitalizationEvidence,
  receiptAttestationPayload,
  type CapitalizationPlan,
  type CapitalizationReceipt,
  type CapitalizationTarget
} from "../src/livingIntellectualCapitalization";
import { loadAuthoritativeCapitalizationFingerprints } from "../src/capitalizationState";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");
const TEST_SECRET = "test-only-capitalization-receipt-secret";
const TEST_PLAN_SECRET = "test-only-capitalization-planning-secret";
const CONNECTOR_SECRETS = {
  notion: TEST_SECRET,
  github: TEST_SECRET,
  deploybot: TEST_SECRET
};

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

function verifierFor(plan: CapitalizationPlan) {
  return {
    connectorHmacSecrets: CONNECTOR_SECRETS,
    planHmacSecret: TEST_PLAN_SECRET,
    planAttestation: attestCapitalizationPlan(plan, TEST_PLAN_SECRET)
  };
}

function signedReceipt(planId: string, tenantId: string, target: CapitalizationTarget, index: number): CapitalizationReceipt {
  const connectorId = connectorFor(target);
  const unsigned = {
    targetId: target.targetId,
    receiptRef: `receipt:${target.targetId}:${index}`,
    executedAt: "2026-08-24T02:40:00Z",
    status: "success" as const,
    artifactHash: `sha256:${String(index).padStart(2, "0")}`,
    connectorId,
    nonce: target.executionNonce
  };
  return {
    ...unsigned,
    attestation: createHmac("sha256", CONNECTOR_SECRETS[connectorId as keyof typeof CONNECTOR_SECRETS])
      .update(receiptAttestationPayload(tenantId, planId, target, unsigned))
      .digest("hex")
  };
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
    const verifier = verifierFor(plan);
    expect(recordCapitalizationEvidence(plan, receipts, verifier).status).toBe("COMPLETE");

    const tampered = receipts.map(receipt => ({ ...receipt }));
    tampered[0] = { ...tampered[0], receiptRef: "receipt:tampered" };
    expect(() => recordCapitalizationEvidence(plan, tampered, verifier))
      .toThrow("CAPITALIZATION_RECEIPT_ATTESTATION_INVALID");

    const wrongConnectorTarget = plan.targets.find(target => !target.allowedConnectorIds.includes("github"))!;
    const unsigned = {
      targetId: wrongConnectorTarget.targetId,
      receiptRef: "receipt:wrong-connector",
      executedAt: "2026-08-24T02:40:00Z",
      status: "success" as const,
      connectorId: "github",
      nonce: wrongConnectorTarget.executionNonce
    };
    const wrongConnectorReceipt: CapitalizationReceipt = {
      ...unsigned,
      attestation: createHmac("sha256", CONNECTOR_SECRETS.github)
        .update(receiptAttestationPayload(plan.tenantId, plan.planId, wrongConnectorTarget, unsigned))
        .digest("hex")
    };
    expect(() => recordCapitalizationEvidence(plan, [wrongConnectorReceipt], verifier))
      .toThrow("CAPITALIZATION_RECEIPT_CONNECTOR_NOT_ALLOWED");

    expect(() => recordCapitalizationEvidence(plan, receipts, { ...verifier, connectorHmacSecrets: {} }))
      .toThrow("CAPITALIZATION_RECEIPT_VERIFIER_UNAVAILABLE");
  });

  test("requires explicit RLS, table revokes and tenant-aware composite lineage constraints", () => {
    const migrations = readSqlDirectory("supabase/migrations");
    const tables = ["chat_signals", "editorial_gate_evaluations", "capitalization_plans", "capitalization_targets", "execution_receipts", "proof_chains"];
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
      connectorHmacSecrets: CONNECTOR_SECRETS,
      planHmacSecret: "",
      planAttestation: ""
    })).toThrow("CAPITALIZATION_PLAN_ATTESTATION_REQUIRED");

    const signed = verifierFor(plan);
    const tamperedPlan = { ...plan, remeStatus: "NOT_ELIGIBLE" as const };
    expect(() => recordCapitalizationEvidence(tamperedPlan, receipts, signed))
      .toThrow("CAPITALIZATION_PLAN_ATTESTATION_INVALID");

    const indexSource = readFileSync(join(repoRoot, "services/mcp-server/src/index.ts"), "utf8");
    expect(indexSource).toContain("GENESIS_CAPITALIZATION_PLAN_HMAC_SECRET");
    expect(indexSource).toContain("planAttestation");
  });

  test("derives the same proof identity regardless of authenticated receipt arrival order", () => {
    const signal = compileChatSignal(baseInput("tenant-a"));
    const plan = compileCapitalizationPlan(signal, evaluateEditorialSignal(signal));
    const receipts = plan.targets.map((target, index) => signedReceipt(plan.planId, plan.tenantId, target, index));
    const verifier = verifierFor(plan);
    const forward = recordCapitalizationEvidence(plan, receipts, verifier);
    const reverse = recordCapitalizationEvidence(plan, [...receipts].reverse(), verifier);
    expect(reverse.proofId).toBe(forward.proofId);
    expect(reverse.receipts.map(receipt => receipt.targetId)).toEqual(forward.receipts.map(receipt => receipt.targetId));
  });

  test("keeps signal gate receipt and closed proof tables append-only for service_role", () => {
    const migrations = readSqlDirectory("supabase/migrations");
    for (const table of ["chat_signals", "editorial_gate_evaluations", "execution_receipts", "proof_chains"]) {
      expect(migrations).toContain(`revoke update on genesis_capitalization.${table} from service_role`);
    }
    expect(migrations).toContain("grant update (status, reme_status, blockers) on genesis_capitalization.capitalization_plans to service_role");
    expect(migrations).toContain("grant update (status, updated_at) on genesis_capitalization.capitalization_targets to service_role");
  });

  test("derives an identical canonical plan when product references arrive in a different order", () => {
    const forwardSignal = compileChatSignal({
      ...baseInput("tenant-a"),
      productRefs: ["GENESIS-V4", "AFRIA-RECRUIT", "AFRIA-MARKETING-TEAM"]
    });
    const reverseSignal = compileChatSignal({
      ...baseInput("tenant-a"),
      productRefs: ["AFRIA-MARKETING-TEAM", "AFRIA-RECRUIT", "GENESIS-V4"]
    });
    const forwardPlan = compileCapitalizationPlan(forwardSignal, evaluateEditorialSignal(forwardSignal));
    const reversePlan = compileCapitalizationPlan(reverseSignal, evaluateEditorialSignal(reverseSignal));

    expect(reverseSignal.bindingHash).toBe(forwardSignal.bindingHash);
    expect(reversePlan.planId).toBe(forwardPlan.planId);
    expect(reversePlan.targets.map(target => target.targetId)).toEqual(forwardPlan.targets.map(target => target.targetId));
    expect(reversePlan.targets.map(target => target.idempotencyKey)).toEqual(forwardPlan.targets.map(target => target.idempotencyKey));
  });

  test("loads duplicate fingerprints from authoritative tenant state and ignores caller-supplied dedup snapshots", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify(["sigfp-b", "sigfp-a", "sigfp-a"]), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    };

    const fingerprints = await loadAuthoritativeCapitalizationFingerprints(
      "tenant-a",
      {
        supabaseUrl: "https://example.supabase.co",
        serviceRoleKey: "service-role-test-key"
      },
      fakeFetch
    );

    expect(fingerprints).toEqual(["sigfp-a", "sigfp-b"]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://example.supabase.co/rest/v1/rpc/genesis_capitalization_known_fingerprints");
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ p_tenant_id: "tenant-a" });

    const indexSource = readFileSync(join(repoRoot, "services/mcp-server/src/index.ts"), "utf8");
    expect(indexSource).toContain("loadAuthoritativeCapitalizationFingerprints");
    expect(indexSource).not.toContain("(payload as any)?.existingFingerprints");

    const migrations = readSqlDirectory("supabase/migrations");
    expect(migrations).toContain("create or replace function public.genesis_capitalization_known_fingerprints");
    expect(migrations).toContain("security invoker");
    expect(migrations).toContain("grant execute on function public.genesis_capitalization_known_fingerprints(text) to service_role");
    expect(migrations).toContain("revoke execute on function public.genesis_capitalization_known_fingerprints(text) from public, anon, authenticated");
  });
});