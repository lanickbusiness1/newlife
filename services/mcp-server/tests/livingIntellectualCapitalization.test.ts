import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  compileCapitalizationPlan,
  compileChatSignal,
  evaluateEditorialSignal,
  GENESIS_V4_LIVING_INTELLECTUAL_CAPITALIZATION_ANCHOR,
  recordCapitalizationEvidence
} from "../src/livingIntellectualCapitalization";
import { compileRemePromotion } from "../src/remePromotion";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");

function readSqlDirectory(relativePath: string): string {
  const directory = join(repoRoot, relativePath);
  return readdirSync(directory)
    .filter(name => name.endsWith(".sql"))
    .map(name => readFileSync(join(directory, name), "utf8"))
    .join("\n");
}

function durableDecision() {
  return compileChatSignal({
    conversationId: "chat-v4-dec-016",
    sourceRef: "chat:2026-08-24:v4-dec-016",
    sourceTimestamp: "2026-08-24T02:15:00Z",
    verificationStatus: "decision_validated",
    confidence: 0.97,
    content: "Chat / signal → vérification → décision → Notion canonique → GENESIS V4 → matière du livre → produits / exécution. Cette boucle transforme les échanges stratégiques durables en mémoire intellectuelle, entrepreneuriale et exécutable de GENESIS, avec preuve, déduplication et retour R.E.M.E.",
    evidenceRefs: ["notion:V4-DEC-016", "notion:V4-DEC-016"],
    canonicalDecisionRef: "V4-DEC-016",
    bookSectionHint: "Living Intellectual Capitalization Loop",
    productRefs: ["GENESIS-V4", "AFRIA-RECRUIT", "GENESIS-V4"],
    tags: ["genesis_v4", "book", "execution", "book"]
  });
}

describe("V4-DEC-016 Living Intellectual Capitalization Loop", () => {
  test("routes a verified durable signal to canonical, GENESIS, book and product execution", () => {
    const signal = durableDecision();
    const gate = evaluateEditorialSignal(signal, []);
    const plan = compileCapitalizationPlan(signal, gate);

    expect(signal.evidenceRefs).toEqual(["notion:V4-DEC-016"]);
    expect(signal.productRefs).toEqual(["GENESIS-V4", "AFRIA-RECRUIT"]);
    expect(signal.fingerprint).toMatch(/^sigfp-[0-9a-f]{8}$/);
    expect(gate.status).toBe("APPROVED");
    expect(gate.bookCandidate).toBe(true);
    expect(gate.executionCandidate).toBe(true);
    expect(gate.totalScore).toBeGreaterThanOrEqual(0.72);

    expect(plan.status).toBe("READY");
    expect(plan.targets.map(target => target.type)).toEqual(expect.arrayContaining([
      "notion_canonical",
      "genesis_v4",
      "book_manuscript",
      "product_execution"
    ]));
    expect(plan.targets.filter(target => target.type === "product_execution")).toHaveLength(2);
    expect(new Set(plan.targets.map(target => target.idempotencyKey)).size).toBe(plan.targets.length);
    expect(plan.remeStatus).toBe("PENDING_EXECUTION_EVIDENCE");
  });

  test("fails closed for unverified or low-confidence signals", () => {
    const unverified = compileChatSignal({
      conversationId: "chat-noise",
      sourceRef: "chat:noise",
      sourceTimestamp: "2026-08-24T02:15:00Z",
      verificationStatus: "unverified",
      confidence: 0.91,
      content: "A potentially interesting strategic idea that is long enough to look substantial but has not been verified and therefore cannot become canonical or manuscript material without evidence."
    });
    const lowConfidence = compileChatSignal({
      conversationId: "chat-low-confidence",
      sourceRef: "chat:low-confidence",
      sourceTimestamp: "2026-08-24T02:15:00Z",
      verificationStatus: "verified",
      confidence: 0.51,
      content: "A verified-looking but low-confidence signal that must remain outside canonical and editorial memory until its evidence and confidence are strong enough for promotion."
    });

    expect(evaluateEditorialSignal(unverified).status).toBe("REJECTED");
    expect(evaluateEditorialSignal(unverified).reasons).toContain("verification_required");
    expect(evaluateEditorialSignal(lowConfidence).status).toBe("REJECTED");
    expect(evaluateEditorialSignal(lowConfidence).reasons).toContain("confidence_below_0_65");
  });

  test("rejects an exact normalized fingerprint duplicate", () => {
    const signal = durableDecision();
    const duplicate = evaluateEditorialSignal(signal, [signal.fingerprint]);

    expect(duplicate.status).toBe("DUPLICATE");
    expect(duplicate.reasons).toContain("duplicate_fingerprint");
    expect(duplicate.bookCandidate).toBe(false);
    expect(duplicate.executionCandidate).toBe(false);
  });

  test("allows a short validated decision with canonical decision evidence", () => {
    const signal = compileChatSignal({
      conversationId: "chat-short-decision",
      sourceRef: "chat:short-decision",
      sourceTimestamp: "2026-08-24T02:15:00Z",
      verificationStatus: "decision_validated",
      confidence: 1,
      content: "V4-DEC-016 is validated and active.",
      canonicalDecisionRef: "V4-DEC-016",
      tags: ["genesis_v4", "book"]
    });

    const gate = evaluateEditorialSignal(signal);
    expect(gate.status).toBe("APPROVED");
    expect(gate.reasons).not.toContain("insufficient_signal");
  });

  test("omits book and product targets when editorial or execution requirements are absent", () => {
    const signal = compileChatSignal({
      conversationId: "chat-operational-note",
      sourceRef: "chat:operational-note",
      sourceTimestamp: "2026-08-24T02:15:00Z",
      verificationStatus: "verified",
      confidence: 0.89,
      content: "This is a verified operational observation with durable evidence and sufficient length for canonical traceability, but it carries no book positioning and no product execution reference, so it should not create editorial or product targets.",
      evidenceRefs: ["evidence:operational:1"],
      tags: ["operational"]
    });

    const gate = evaluateEditorialSignal(signal);
    const plan = compileCapitalizationPlan(signal, gate);

    expect(gate.status).toBe("APPROVED");
    expect(gate.bookCandidate).toBe(false);
    expect(gate.executionCandidate).toBe(false);
    expect(plan.targets.some(target => target.type === "book_manuscript")).toBe(false);
    expect(plan.targets.some(target => target.type === "product_execution")).toBe(false);
  });

  test("closes evidence as COMPLETE only when every planned target succeeded", () => {
    const signal = durableDecision();
    const gate = evaluateEditorialSignal(signal);
    const plan = compileCapitalizationPlan(signal, gate);
    const allReceipts = plan.targets.map((target, index) => ({
      targetId: target.targetId,
      receiptRef: `receipt:${index + 1}`,
      executedAt: "2026-08-24T02:30:00Z",
      status: "success" as const,
      artifactHash: `sha256:${index + 1}`
    }));

    const complete = recordCapitalizationEvidence(plan, allReceipts);
    const partial = recordCapitalizationEvidence(plan, allReceipts.slice(0, 1));
    const failed = recordCapitalizationEvidence(plan, []);

    expect(complete.status).toBe("COMPLETE");
    expect(complete.nextGate).toBe("REME_CANDIDATE");
    expect(complete.missingTargetIds).toEqual([]);
    expect(partial.status).toBe("PARTIAL");
    expect(partial.nextGate).toBe("EXECUTION_REPAIR");
    expect(partial.missingTargetIds.length).toBeGreaterThan(0);
    expect(failed.status).toBe("FAILED");
  });

  test("emits a governed R.E.M.E promotion contract only after complete evidence", () => {
    const signal = durableDecision();
    const gate = evaluateEditorialSignal(signal);
    const plan = compileCapitalizationPlan(signal, gate);
    const allReceipts = plan.targets.map((target, index) => ({
      targetId: target.targetId,
      receiptRef: `receipt:${index + 1}`,
      executedAt: "2026-08-24T02:30:00Z",
      status: "success" as const
    }));
    const complete = recordCapitalizationEvidence(plan, allReceipts);
    const partial = recordCapitalizationEvidence(plan, allReceipts.slice(0, 1));

    const reme = compileRemePromotion(plan, complete, "R.E.M.E-VAL-001");
    expect(reme.type).toBe("reme");
    expect(reme.action).toBe("promote_candidate");
    expect(reme.requiredEvidenceType).toBe("connector_receipt");
    expect(reme.destinationRef).toBe("R.E.M.E-VAL-001");
    expect(reme.idempotencyKey).toMatch(/^idem-[0-9a-f]{8}$/);
    expect(() => compileRemePromotion(plan, partial, "R.E.M.E-VAL-001")).toThrow("REME_PROMOTION_REQUIRES_COMPLETE_PROOF");
  });

  test("registers three least-privilege capitalization MCP tools", () => {
    const indexSource = readFileSync(join(repoRoot, "services/mcp-server/src/index.ts"), "utf8");

    expect(indexSource).toContain('register("genesis.capitalization.evaluate_signal"');
    expect(indexSource).toContain('"capitalization:evaluate"');
    expect(indexSource).toContain('register("genesis.capitalization.compile_plan"');
    expect(indexSource).toContain('"capitalization:plan"');
    expect(indexSource).toContain('register("genesis.capitalization.record_evidence"');
    expect(indexSource).toContain('"capitalization:evidence"');
    expect(indexSource).toContain("compileRemePromotion");
    expect(GENESIS_V4_LIVING_INTELLECTUAL_CAPITALIZATION_ANCHOR.decisionId).toBe("V4-DEC-016");
  });

  test("migration and rollback enforce the private ledger boundary", () => {
    const migrations = readSqlDirectory("supabase/migrations").toLowerCase();
    const rollbacks = readSqlDirectory("supabase/rollbacks").toLowerCase();

    expect(migrations).toContain("create schema if not exists genesis_capitalization");
    for (const table of [
      "chat_signals",
      "editorial_gate_evaluations",
      "capitalization_plans",
      "capitalization_targets",
      "execution_receipts",
      "proof_chains"
    ]) {
      expect(migrations).toContain(`create table if not exists genesis_capitalization.${table}`);
    }
    expect(migrations).toContain("enable row level security");
    expect(migrations).toContain("revoke all on schema genesis_capitalization from public, anon, authenticated");
    expect(rollbacks).toContain("drop schema if exists genesis_capitalization cascade");
  });
});
