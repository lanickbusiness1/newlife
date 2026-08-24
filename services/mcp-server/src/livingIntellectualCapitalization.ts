export const GENESIS_V4_LIVING_INTELLECTUAL_CAPITALIZATION_ANCHOR = Object.freeze({
  decisionId: "V4-DEC-016",
  assetId: "GENESIS-V4-LIVING-INTELLECTUAL-CAPITALIZATION-LOOP",
  version: "1.0.0",
  mode: "extension_not_framework",
  editorialGate: "Editorial Signal Gate™",
  destinations: [
    "notion_canonical",
    "genesis_v4",
    "book_manuscript",
    "product_execution",
    "reme"
  ] as const
});

export type VerificationStatus = "unverified" | "verified" | "decision_validated";

export type ChatSignalInput = {
  signalId?: string;
  conversationId: string;
  sourceRef: string;
  content: string;
  sourceTimestamp: string;
  verificationStatus: VerificationStatus;
  confidence: number;
  evidenceRefs?: string[];
  canonicalDecisionRef?: string;
  bookSectionHint?: string;
  productRefs?: string[];
  tags?: string[];
  existingFingerprints?: string[];
};

export type NormalizedChatSignal = {
  signalId: string;
  conversationId: string;
  sourceRef: string;
  sourceTimestamp: string;
  verificationStatus: VerificationStatus;
  confidence: number;
  content: string;
  normalizedContent: string;
  fingerprint: string;
  evidenceRefs: string[];
  canonicalDecisionRef: string | null;
  bookSectionHint: string | null;
  productRefs: string[];
  tags: string[];
  existingFingerprints: string[];
};

export type EditorialGateStatus = "APPROVED" | "REJECTED" | "DUPLICATE";

export type EditorialScores = {
  verification: number;
  durability: number;
  strategicRelevance: number;
  editorialValue: number;
  executionRelevance: number;
};

export type EditorialGateResult = {
  signalId: string;
  status: EditorialGateStatus;
  scores: EditorialScores;
  totalScore: number;
  bookCandidate: boolean;
  executionCandidate: boolean;
  reasons: string[];
  requiredGates: string[];
};

export type CapitalizationTargetType =
  | "notion_canonical"
  | "genesis_v4"
  | "book_manuscript"
  | "product_execution";

export type CapitalizationTarget = {
  targetId: string;
  type: CapitalizationTargetType;
  destinationRef: string;
  action: "append" | "link" | "create_execution_item";
  requiredEvidenceType: "connector_receipt" | "repository_receipt";
  idempotencyKey: string;
  status: "PLANNED";
};

export type CapitalizationPlan = {
  planId: string;
  signalId: string;
  fingerprint: string;
  status: "READY" | "BLOCKED";
  targets: CapitalizationTarget[];
  remeStatus: "PENDING_EXECUTION_EVIDENCE" | "NOT_ELIGIBLE";
  blockers: string[];
};

export type CapitalizationReceipt = {
  targetId: string;
  receiptRef: string;
  executedAt: string;
  status: "success" | "failed";
  artifactHash?: string;
};

export type CapitalizationProof = {
  proofId: string;
  planId: string;
  status: "COMPLETE" | "PARTIAL" | "FAILED";
  nextGate: "REME_CANDIDATE" | "EXECUTION_REPAIR";
  receipts: CapitalizationReceipt[];
  successfulTargetIds: string[];
  failedTargetIds: string[];
  missingTargetIds: string[];
};

function required(value: unknown, code: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(code);
  }
  return value.trim();
}

function optional(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(
    values
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map(value => value.trim())
  )];
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("fr");
}

function stableId(prefix: string, parts: string[]): string {
  let hash = 2166136261;
  for (const char of parts.join("|")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function assertConfidence(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("CAPITALIZATION_SIGNAL_INVALID_CONFIDENCE");
  }
}

function assertTimestamp(value: string): string {
  const timestamp = required(value, "CAPITALIZATION_SIGNAL_TIMESTAMP_REQUIRED");
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new Error("CAPITALIZATION_SIGNAL_INVALID_TIMESTAMP");
  }
  return timestamp;
}

export function compileChatSignal(input: ChatSignalInput): NormalizedChatSignal {
  if (!input || typeof input !== "object") {
    throw new Error("CAPITALIZATION_SIGNAL_INVALID_INPUT");
  }

  const conversationId = required(input.conversationId, "CAPITALIZATION_SIGNAL_CONVERSATION_REQUIRED");
  const sourceRef = required(input.sourceRef, "CAPITALIZATION_SIGNAL_SOURCE_REQUIRED");
  const sourceTimestamp = assertTimestamp(input.sourceTimestamp);
  const content = required(input.content, "CAPITALIZATION_SIGNAL_CONTENT_REQUIRED");
  assertConfidence(input.confidence);

  if (!["unverified", "verified", "decision_validated"].includes(input.verificationStatus)) {
    throw new Error("CAPITALIZATION_SIGNAL_INVALID_VERIFICATION_STATUS");
  }

  const normalizedContent = normalizeText(content);
  const fingerprint = stableId("sigfp", [normalizedContent]);
  const signalId = optional(input.signalId) ?? stableId("signal", [
    conversationId,
    sourceRef,
    sourceTimestamp,
    fingerprint
  ]);

  return {
    signalId,
    conversationId,
    sourceRef,
    sourceTimestamp,
    verificationStatus: input.verificationStatus,
    confidence: input.confidence,
    content: content.replace(/\s+/g, " ").trim(),
    normalizedContent,
    fingerprint,
    evidenceRefs: uniqueStrings(input.evidenceRefs),
    canonicalDecisionRef: optional(input.canonicalDecisionRef),
    bookSectionHint: optional(input.bookSectionHint),
    productRefs: uniqueStrings(input.productRefs),
    tags: uniqueStrings(input.tags).map(tag => tag.toLocaleLowerCase("en")),
    existingFingerprints: uniqueStrings(input.existingFingerprints)
  };
}

function scoreSignal(signal: NormalizedChatSignal): EditorialScores {
  const tagSet = new Set(signal.tags);
  const verification = signal.verificationStatus === "decision_validated"
    ? 1
    : signal.verificationStatus === "verified"
      ? 0.85
      : 0;

  const durability = signal.canonicalDecisionRef
    ? 1
    : ["doctrine", "architecture", "policy", "genesis_v4"].some(tag => tagSet.has(tag))
      ? 0.9
      : signal.normalizedContent.length >= 180
        ? 0.75
        : signal.normalizedContent.length >= 80
          ? 0.65
          : 0.3;

  const strategicRelevance = signal.canonicalDecisionRef || tagSet.has("genesis_v4")
    ? 1
    : signal.productRefs.length > 0
      ? 0.8
      : tagSet.has("operational")
        ? 0.65
        : 0.5;

  const editorialValue = signal.bookSectionHint || tagSet.has("book")
    ? 1
    : tagSet.has("operational")
      ? 0.35
      : signal.normalizedContent.length >= 220
        ? 0.75
        : signal.normalizedContent.length >= 120
          ? 0.65
          : 0.45;

  const executionRelevance = signal.productRefs.length > 0
    ? 1
    : tagSet.has("execution")
      ? 0.75
      : 0.35;

  return {
    verification,
    durability,
    strategicRelevance,
    editorialValue,
    executionRelevance
  };
}

export function evaluateEditorialSignal(
  signal: NormalizedChatSignal,
  existingFingerprints: string[] = signal.existingFingerprints
): EditorialGateResult {
  if (!signal || typeof signal !== "object") {
    throw new Error("EDITORIAL_GATE_INVALID_SIGNAL");
  }

  const fingerprints = new Set(uniqueStrings(existingFingerprints));
  const scores = scoreSignal(signal);
  const totalScore = round3(
    (scores.verification
      + scores.durability
      + scores.strategicRelevance
      + scores.editorialValue
      + scores.executionRelevance) / 5
  );

  if (fingerprints.has(signal.fingerprint)) {
    return {
      signalId: signal.signalId,
      status: "DUPLICATE",
      scores,
      totalScore,
      bookCandidate: false,
      executionCandidate: false,
      reasons: ["duplicate_fingerprint"],
      requiredGates: ["DEDUPLICATION"]
    };
  }

  const reasons: string[] = [];
  if (signal.verificationStatus === "unverified") reasons.push("verification_required");
  if (signal.confidence < 0.65) reasons.push("confidence_below_0_65");

  const validatedDecisionException = signal.verificationStatus === "decision_validated"
    && Boolean(signal.canonicalDecisionRef);

  if (signal.evidenceRefs.length === 0 && !validatedDecisionException) {
    reasons.push("evidence_required");
  }
  if (signal.normalizedContent.length < 80 && !validatedDecisionException) {
    reasons.push("insufficient_signal");
  }

  const status: EditorialGateStatus = reasons.length === 0 ? "APPROVED" : "REJECTED";
  const bookCandidate = status === "APPROVED"
    && totalScore >= 0.72
    && scores.editorialValue >= 0.65;
  const executionCandidate = status === "APPROVED"
    && scores.executionRelevance >= 0.6
    && signal.productRefs.length > 0;

  return {
    signalId: signal.signalId,
    status,
    scores,
    totalScore,
    bookCandidate,
    executionCandidate,
    reasons,
    requiredGates: status === "APPROVED"
      ? ["CANONICAL_WRITE_RECEIPT", "EVIDENCE_CLOSURE"]
      : ["EDITORIAL_SIGNAL_REPAIR"]
  };
}

function target(
  signal: NormalizedChatSignal,
  type: CapitalizationTargetType,
  destinationRef: string,
  action: CapitalizationTarget["action"],
  requiredEvidenceType: CapitalizationTarget["requiredEvidenceType"]
): CapitalizationTarget {
  const targetId = stableId("target", [signal.signalId, type, destinationRef]);
  return {
    targetId,
    type,
    destinationRef,
    action,
    requiredEvidenceType,
    idempotencyKey: stableId("idem", [signal.fingerprint, type, destinationRef]),
    status: "PLANNED"
  };
}

export function compileCapitalizationPlan(
  signal: NormalizedChatSignal,
  gate: EditorialGateResult
): CapitalizationPlan {
  if (!signal || !gate || signal.signalId !== gate.signalId) {
    throw new Error("CAPITALIZATION_PLAN_SIGNAL_GATE_MISMATCH");
  }

  if (gate.status !== "APPROVED") {
    return {
      planId: stableId("capplan", [signal.signalId, gate.status]),
      signalId: signal.signalId,
      fingerprint: signal.fingerprint,
      status: "BLOCKED",
      targets: [],
      remeStatus: "NOT_ELIGIBLE",
      blockers: gate.reasons.length > 0 ? [...gate.reasons] : ["editorial_gate_not_approved"]
    };
  }

  const targets: CapitalizationTarget[] = [];
  targets.push(target(
    signal,
    "notion_canonical",
    signal.canonicalDecisionRef ?? "notion:capitalization-inbox",
    "append",
    "connector_receipt"
  ));

  if (signal.canonicalDecisionRef || signal.tags.includes("genesis_v4")) {
    targets.push(target(
      signal,
      "genesis_v4",
      signal.canonicalDecisionRef ?? "GENESIS-V4",
      "link",
      "connector_receipt"
    ));
  }

  if (gate.bookCandidate) {
    targets.push(target(
      signal,
      "book_manuscript",
      `book:${signal.bookSectionHint ?? "editorial-memory"}`,
      "append",
      "connector_receipt"
    ));
  }

  if (gate.executionCandidate) {
    for (const productRef of signal.productRefs) {
      targets.push(target(
        signal,
        "product_execution",
        `product:${productRef}`,
        "create_execution_item",
        "repository_receipt"
      ));
    }
  }

  return {
    planId: stableId("capplan", [signal.signalId, ...targets.map(item => item.targetId)]),
    signalId: signal.signalId,
    fingerprint: signal.fingerprint,
    status: targets.length > 0 ? "READY" : "BLOCKED",
    targets,
    remeStatus: targets.length > 0 ? "PENDING_EXECUTION_EVIDENCE" : "NOT_ELIGIBLE",
    blockers: targets.length > 0 ? [] : ["no_capitalization_targets"]
  };
}

export function recordCapitalizationEvidence(
  plan: CapitalizationPlan,
  receipts: CapitalizationReceipt[]
): CapitalizationProof {
  if (!plan || typeof plan !== "object") {
    throw new Error("CAPITALIZATION_PROOF_INVALID_PLAN");
  }
  if (!Array.isArray(receipts)) {
    throw new Error("CAPITALIZATION_PROOF_INVALID_RECEIPTS");
  }

  const planned = new Map(plan.targets.map(item => [item.targetId, item]));
  const normalizedReceipts: CapitalizationReceipt[] = [];
  const seenTargetIds = new Set<string>();

  for (const receipt of receipts) {
    if (!receipt || !planned.has(receipt.targetId) || seenTargetIds.has(receipt.targetId)) continue;
    required(receipt.receiptRef, "CAPITALIZATION_RECEIPT_REF_REQUIRED");
    assertTimestamp(receipt.executedAt);
    if (receipt.status !== "success" && receipt.status !== "failed") {
      throw new Error("CAPITALIZATION_RECEIPT_INVALID_STATUS");
    }
    normalizedReceipts.push({ ...receipt });
    seenTargetIds.add(receipt.targetId);
  }

  const successfulTargetIds = normalizedReceipts
    .filter(receipt => receipt.status === "success")
    .map(receipt => receipt.targetId);
  const failedTargetIds = normalizedReceipts
    .filter(receipt => receipt.status === "failed")
    .map(receipt => receipt.targetId);
  const completed = new Set(successfulTargetIds);
  const missingTargetIds = plan.targets
    .map(item => item.targetId)
    .filter(targetId => !completed.has(targetId) && !failedTargetIds.includes(targetId));

  let status: CapitalizationProof["status"];
  if (plan.targets.length > 0 && successfulTargetIds.length === plan.targets.length) {
    status = "COMPLETE";
  } else if (successfulTargetIds.length > 0) {
    status = "PARTIAL";
  } else {
    status = "FAILED";
  }

  return {
    proofId: stableId("capproof", [
      plan.planId,
      ...normalizedReceipts.map(receipt => `${receipt.targetId}:${receipt.status}:${receipt.receiptRef}`)
    ]),
    planId: plan.planId,
    status,
    nextGate: status === "COMPLETE" ? "REME_CANDIDATE" : "EXECUTION_REPAIR",
    receipts: normalizedReceipts,
    successfulTargetIds,
    failedTargetIds,
    missingTargetIds
  };
}
