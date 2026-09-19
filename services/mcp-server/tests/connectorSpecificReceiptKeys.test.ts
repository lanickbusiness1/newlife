import { createHmac } from "node:crypto";
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

const PLAN_SECRET = "test-only-plan-secret-12345678901234567890";
const NOTION_SECRET = "test-only-notion-secret-123456789012345678";
const GITHUB_SECRET = "test-only-github-secret-123456789012345678";

function oneTargetPlan() {
  const signal = compileChatSignal({
    tenantId: "tenant-keys",
    conversationId: "connector-key-test",
    sourceRef: "test:connector-key",
    sourceTimestamp: "2026-08-25T01:00:00Z",
    verificationStatus: "verified",
    confidence: 0.92,
    content: "Verified operational evidence that is intentionally long enough for canonical traceability but does not request book or product execution routing.",
    evidenceRefs: ["evidence:test:1"],
    tags: ["operational"]
  });
  const gate = evaluateEditorialSignal(signal, []);
  const plan = compileCapitalizationPlan(signal, gate);
  expect(plan.targets).toHaveLength(1);
  expect(plan.targets[0]?.allowedConnectorIds).toContain("notion");
  return plan;
}

function receiptSignedWith(secret: string): CapitalizationReceipt {
  const plan = oneTargetPlan();
  const target = plan.targets[0]!;
  const unsigned = {
    targetId: target.targetId,
    receiptRef: "notion:receipt:key-isolation",
    executedAt: "2026-08-25T01:01:00Z",
    status: "success" as const,
    artifactHash: "sha256:key-isolation",
    connectorId: "notion",
    nonce: target.executionNonce
  };
  return {
    ...unsigned,
    attestation: createHmac("sha256", secret)
      .update(receiptAttestationPayload(plan.tenantId, plan.planId, target, unsigned))
      .digest("hex")
  };
}

describe("connector-specific capitalization receipt keys", () => {
  test("resolves the verification key from authoritative connector identity", () => {
    const plan = oneTargetPlan();
    const target = plan.targets[0]!;
    const unsigned = {
      targetId: target.targetId,
      receiptRef: "notion:receipt:key-isolation",
      executedAt: "2026-08-25T01:01:00Z",
      status: "success" as const,
      artifactHash: "sha256:key-isolation",
      connectorId: "notion",
      nonce: target.executionNonce
    };
    const correctReceipt: CapitalizationReceipt = {
      ...unsigned,
      attestation: createHmac("sha256", NOTION_SECRET)
        .update(receiptAttestationPayload(plan.tenantId, plan.planId, target, unsigned))
        .digest("hex")
    };
    const forgedByGithub: CapitalizationReceipt = {
      ...unsigned,
      attestation: createHmac("sha256", GITHUB_SECRET)
        .update(receiptAttestationPayload(plan.tenantId, plan.planId, target, unsigned))
        .digest("hex")
    };
    const verifier = {
      planHmacSecret: PLAN_SECRET,
      planAttestation: attestCapitalizationPlan(plan, PLAN_SECRET),
      connectorHmacSecrets: {
        notion: NOTION_SECRET,
        github: GITHUB_SECRET
      }
    } as any;

    expect(recordCapitalizationEvidence(plan, [correctReceipt], verifier).status).toBe("COMPLETE");
    expect(() => recordCapitalizationEvidence(plan, [forgedByGithub], verifier))
      .toThrow("CAPITALIZATION_RECEIPT_ATTESTATION_INVALID");
  });
});
