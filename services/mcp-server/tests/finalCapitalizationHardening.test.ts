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
  receiptAttestationPayload,
  recordCapitalizationEvidence,
  type CapitalizationReceipt
} from "../src/livingIntellectualCapitalization";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");
const PLAN_SECRET = "test-only-final-plan-secret-123456789012345";
const NOTION_SECRET = "test-only-final-notion-secret-1234567890123";

function migrations(): string {
  const directory = join(repoRoot, "supabase/migrations");
  return readdirSync(directory)
    .filter(name => name.endsWith(".sql"))
    .map(name => readFileSync(join(directory, name), "utf8"))
    .join("\n")
    .toLowerCase();
}

function planWithOneTarget() {
  const signal = compileChatSignal({
    tenantId: "tenant-final-hardening",
    conversationId: "proof-identity",
    sourceRef: "test:proof-identity",
    sourceTimestamp: "2026-08-25T01:10:00Z",
    verificationStatus: "verified",
    confidence: 0.93,
    content: "Verified operational signal retained for canonical traceability while deliberately avoiding book and product routing in this proof identity regression test.",
    evidenceRefs: ["evidence:proof-identity"],
    tags: ["operational"]
  });
  const plan = compileCapitalizationPlan(signal, evaluateEditorialSignal(signal, []));
  expect(plan.targets).toHaveLength(1);
  return plan;
}

function signedReceipt(executedAt: string, artifactHash: string): { plan: ReturnType<typeof planWithOneTarget>; receipt: CapitalizationReceipt } {
  const plan = planWithOneTarget();
  const target = plan.targets[0]!;
  const unsigned = {
    targetId: target.targetId,
    receiptRef: "notion:stable-receipt-ref",
    executedAt,
    status: "success" as const,
    artifactHash,
    connectorId: "notion",
    nonce: target.executionNonce
  };
  return {
    plan,
    receipt: {
      ...unsigned,
      attestation: createHmac("sha256", NOTION_SECRET)
        .update(receiptAttestationPayload(plan.tenantId, plan.planId, target, unsigned))
        .digest("hex")
    }
  };
}

describe("final V4-DEC-016 hardening", () => {
  test("proof identity changes when authenticated receipt evidence changes", () => {
    const first = signedReceipt("2026-08-25T01:11:00Z", "sha256:artifact-a");
    const second = signedReceipt("2026-08-25T01:12:00Z", "sha256:artifact-b");
    expect(second.plan.planId).toBe(first.plan.planId);

    const verifier = {
      connectorHmacSecrets: { notion: NOTION_SECRET },
      planHmacSecret: PLAN_SECRET,
      planAttestation: attestCapitalizationPlan(first.plan, PLAN_SECRET)
    };
    const proofA = recordCapitalizationEvidence(first.plan, [first.receipt], verifier);
    const proofB = recordCapitalizationEvidence(second.plan, [second.receipt], verifier);

    expect(proofA.status).toBe("COMPLETE");
    expect(proofB.status).toBe("COMPLETE");
    expect(proofB.proofId).not.toBe(proofA.proofId);
  });

  test("service_role can update only declared state columns on plans and targets", () => {
    const sql = migrations();
    expect(sql).toContain("grant update (status, reme_status, blockers) on genesis_capitalization.capitalization_plans to service_role");
    expect(sql).toContain("grant update (status, updated_at) on genesis_capitalization.capitalization_targets to service_role");
    expect(sql).not.toContain("grant update on genesis_capitalization.capitalization_plans to service_role");
    expect(sql).not.toContain("grant update on genesis_capitalization.capitalization_targets to service_role");
  });
});
