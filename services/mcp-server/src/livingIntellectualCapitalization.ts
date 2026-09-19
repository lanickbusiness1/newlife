import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const GENESIS_V4_LIVING_INTELLECTUAL_CAPITALIZATION_ANCHOR = Object.freeze({
  decisionId: "V4-DEC-016",
  assetId: "GENESIS-V4-LIVING-INTELLECTUAL-CAPITALIZATION-LOOP",
  version: "1.5.0",
  mode: "extension_not_framework",
  editorialGate: "Editorial Signal Gate™",
  planTrust: "HMAC-SHA256 planning authority attestation",
  receiptTrust: "connector-specific HMAC-SHA256 attestation",
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
  tenantId: string;
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
  tenantId: string;
  signalId: string;
  conversationId: string;
  sourceRef: string;
  sourceTimestamp: string;
  verificationStatus: VerificationStatus;
  confidence: number;
  content: string;
  normalizedContent: string;
  fingerprint: string;
  bindingHash: string;
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
  tenantId: string;
  signalId: string;
  signalFingerprint: string;
  signalBindingHash: string;
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
  | "product_execution"
  | "reme";

export type CapitalizationTarget = {
  tenantId: string;
  targetId: string;
  type: CapitalizationTargetType;
  destinationRef: string;
  action: "append" | "link" | "create_execution_item" | "promote_candidate";
  requiredEvidenceType: "connector_receipt" | "repository_receipt";
  idempotencyKey: string;
  executionNonce: string;
  allowedConnectorIds: string[];
  status: "PLANNED";
};

export type CapitalizationPlan = {
  tenantId: string;
  planId: string;
  signalId: string;
  signalBindingHash: string;
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
  connectorId: string;
  nonce: string;
  attestation: string;
};

export type CapitalizationReceiptVerifier = {
  connectorHmacSecrets: Record<string, string>;
  planHmacSecret: string;
  planAttestation: string;
  allowedConnectorIds?: string[];
};

export type CapitalizationProof = {
  tenantId: string;
  proofId: string;
  planId: string;
  status: "COMPLETE" | "PARTIAL" | "FAILED";
  nextGate: "REME_CANDIDATE" | "EXECUTION_REPAIR";
  receipts: CapitalizationReceipt[];
  successfulTargetIds: string[];
  failedTargetIds: string[];
  missingTargetIds: string[];
};

type UnsignedCapitalizationReceipt = Omit<CapitalizationReceipt, "attestation">;

function required(value: unknown, code: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(code);
  return value.trim();
}

function optional(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map(value => value.trim()))];
}

function canonicalStrings(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("fr");
}

function digest(prefix: string, parts: unknown[], fullWidth = false): string {
  const hex = createHash("sha256").update(JSON.stringify(parts)).digest("hex");
  return `${prefix}-${fullWidth ? hex : hex.slice(0, 32)}`;
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
  if (Number.isNaN(Date.parse(timestamp))) throw new Error("CAPITALIZATION_SIGNAL_INVALID_TIMESTAMP");
  return timestamp;
}

function assertHmacSecret(secret: unknown, code: string): string {
  const value = required(secret, code);
  if (value.length < 32) throw new Error(code);
  return value;
}

function assertConnectorKeyring(keyring: unknown): asserts keyring is Record<string, string> {
  if (!keyring || typeof keyring !== "object" || Array.isArray(keyring)) {
    throw new Error("CAPITALIZATION_RECEIPT_VERIFIER_UNAVAILABLE");
  }
  const entries = Object.entries(keyring as Record<string, unknown>);
  if (entries.length === 0 || !entries.some(([connectorId, secret]) => connectorId.trim().length > 0 && typeof secret === "string" && secret.length >= 32)) {
    throw new Error("CAPITALIZATION_RECEIPT_VERIFIER_UNAVAILABLE");
  }
}

function connectorHmacSecret(verifier: CapitalizationReceiptVerifier, connectorId: string): string {
  assertConnectorKeyring(verifier?.connectorHmacSecrets);
  return assertHmacSecret(
    verifier.connectorHmacSecrets[connectorId],
    "CAPITALIZATION_RECEIPT_CONNECTOR_KEY_UNAVAILABLE"
  );
}

function buildSignalBinding(fields: {
  tenantId: string;
  signalId: string;
  fingerprint: string;
  verificationStatus: VerificationStatus;
  confidence: number;
  evidenceRefs: string[];
  canonicalDecisionRef: string | null;
  bookSectionHint: string | null;
  productRefs: string[];
  tags: string[];
}): string {
  return digest("sigbind", [
    fields.tenantId,
    fields.signalId,
    fields.fingerprint,
    fields.verificationStatus,
    fields.confidence.toFixed(6),
    canonicalStrings(fields.evidenceRefs),
    fields.canonicalDecisionRef,
    fields.bookSectionHint,
    canonicalStrings(fields.productRefs),
    canonicalStrings(fields.tags)
  ], true);
}

export function compileChatSignal(input: ChatSignalInput): NormalizedChatSignal {
  if (!input || typeof input !== "object") throw new Error("CAPITALIZATION_SIGNAL_INVALID_INPUT");

  const tenantId = required(input.tenantId, "CAPITALIZATION_SIGNAL_TENANT_REQUIRED");
  const conversationId = required(input.conversationId, "CAPITALIZATION_SIGNAL_CONVERSATION_REQUIRED");
  const sourceRef = required(input.sourceRef, "CAPITALIZATION_SIGNAL_SOURCE_REQUIRED");
  const sourceTimestamp = assertTimestamp(input.sourceTimestamp);
  const content = required(input.content, "CAPITALIZATION_SIGNAL_CONTENT_REQUIRED");
  assertConfidence(input.confidence);

  if (!["unverified", "verified", "decision_validated"].includes(input.verificationStatus)) {
    throw new Error("CAPITALIZATION_SIGNAL_INVALID_VERIFICATION_STATUS");
  }

  const normalizedContent = normalizeText(content);
  const fingerprint = digest("sigfp", [tenantId, normalizedContent], true);
  const callerSignalRef = optional(input.signalId);
  const signalId = digest("signal", [tenantId, callerSignalRef, conversationId, sourceRef, sourceTimestamp, fingerprint]);
  const evidenceRefs = uniqueStrings(input.evidenceRefs);
  const canonicalDecisionRef = optional(input.canonicalDecisionRef);
  const bookSectionHint = optional(input.bookSectionHint);
  const productRefs = canonicalStrings(uniqueStrings(input.productRefs));
  const tags = canonicalStrings(uniqueStrings(input.tags).map(tag => tag.toLocaleLowerCase("en")));
  const bindingHash = buildSignalBinding({
    tenantId,
    signalId,
    fingerprint,
    verificationStatus: input.verificationStatus,
    confidence: input.confidence,
    evidenceRefs,
    canonicalDecisionRef,
    bookSectionHint,
    productRefs,
    tags
  });

  return {
    tenantId,
    signalId,
    conversationId,
    sourceRef,
    sourceTimestamp,
    verificationStatus: input.verificationStatus,
    confidence: input.confidence,
    content: content.replace(/\s+/g, " ").trim(),
    normalizedContent,
    fingerprint,
    bindingHash,
    evidenceRefs,
    canonicalDecisionRef,
    bookSectionHint,
    productRefs,
    tags,
    existingFingerprints: uniqueStrings(input.existingFingerprints)
  };
}

function scoreSignal(signal: NormalizedChatSignal): EditorialScores {
  const tagSet = new Set(signal.tags);
  const verification = signal.verificationStatus === "decision_validated" ? 1
    : signal.verificationStatus === "verified" ? 0.85 : 0;
  const durability = signal.canonicalDecisionRef ? 1
    : ["doctrine", "architecture", "policy", "genesis_v4"].some(tag => tagSet.has(tag)) ? 0.9
    : signal.normalizedContent.length >= 180 ? 0.75
    : signal.normalizedContent.length >= 80 ? 0.65 : 0.3;
  const strategicRelevance = signal.canonicalDecisionRef || tagSet.has("genesis_v4") ? 1
    : signal.productRefs.length > 0 ? 0.8
    : tagSet.has("operational") ? 0.65 : 0.5;
  const editorialValue = signal.bookSectionHint || tagSet.has("book") ? 1
    : tagSet.has("operational") ? 0.35
    : signal.normalizedContent.length >= 220 ? 0.75
    : signal.normalizedContent.length >= 120 ? 0.65 : 0.45;
  const executionRelevance = signal.productRefs.length > 0 ? 1 : tagSet.has("execution") ? 0.75 : 0.35;
  return { verification, durability, strategicRelevance, editorialValue, executionRelevance };
}

export function evaluateEditorialSignal(
  signal: NormalizedChatSignal,
  existingFingerprints: string[] = signal.existingFingerprints
): EditorialGateResult {
  if (!signal || typeof signal !== "object") throw new Error("EDITORIAL_GATE_INVALID_SIGNAL");

  const fingerprints = new Set(uniqueStrings(existingFingerprints));
  const scores = scoreSignal(signal);
  const totalScore = round3((scores.verification + scores.durability + scores.strategicRelevance + scores.editorialValue + scores.executionRelevance) / 5);
  const base = {
    tenantId: signal.tenantId,
    signalId: signal.signalId,
    signalFingerprint: signal.fingerprint,
    signalBindingHash: signal.bindingHash,
    scores,
    totalScore
  };

  if (fingerprints.has(signal.fingerprint)) {
    return {
      ...base,
      status: "DUPLICATE",
      bookCandidate: false,
      executionCandidate: false,
      reasons: ["duplicate_fingerprint"],
      requiredGates: ["DEDUPLICATION"]
    };
  }

  const reasons: string[] = [];
  if (signal.verificationStatus === "unverified") reasons.push("verification_required");
  if (signal.confidence < 0.65) reasons.push("confidence_below_0_65");
  const validatedDecisionException = signal.verificationStatus === "decision_validated" && Boolean(signal.canonicalDecisionRef);
  if (signal.evidenceRefs.length === 0 && !validatedDecisionException) reasons.push("evidence_required");
  if (signal.normalizedContent.length < 80 && !validatedDecisionException) reasons.push("insufficient_signal");

  const status: EditorialGateStatus = reasons.length === 0 ? "APPROVED" : "REJECTED";
  const bookCandidate = status === "APPROVED" && totalScore >= 0.72 && scores.editorialValue >= 0.65;
  const executionCandidate = status === "APPROVED" && scores.executionRelevance >= 0.6 && signal.productRefs.length > 0;

  return {
    ...base,
    status,
    bookCandidate,
    executionCandidate,
    reasons,
    requiredGates: status === "APPROVED"
      ? ["CANONICAL_WRITE_RECEIPT", "PLAN_AUTHORITY_ATTESTATION", "CONNECTOR_ATTESTATION", "EVIDENCE_CLOSURE"]
      : ["EDITORIAL_SIGNAL_REPAIR"]
  };
}

function sameGateResult(a: EditorialGateResult, b: EditorialGateResult): boolean {
  return a.tenantId === b.tenantId
    && a.signalId === b.signalId
    && a.signalFingerprint === b.signalFingerprint
    && a.signalBindingHash === b.signalBindingHash
    && a.status === b.status
    && a.totalScore === b.totalScore
    && a.bookCandidate === b.bookCandidate
    && a.executionCandidate === b.executionCandidate
    && JSON.stringify(a.scores) === JSON.stringify(b.scores)
    && JSON.stringify(a.reasons) === JSON.stringify(b.reasons);
}

function allowedConnectors(type: CapitalizationTargetType): string[] {
  if (type === "product_execution") return ["github", "deploybot"];
  return ["notion"];
}

function target(
  signal: NormalizedChatSignal,
  type: Exclude<CapitalizationTargetType, "reme">,
  destinationRef: string,
  action: CapitalizationTarget["action"],
  requiredEvidenceType: CapitalizationTarget["requiredEvidenceType"]
): CapitalizationTarget {
  const targetId = digest("target", [signal.tenantId, signal.signalId, type, destinationRef]);
  return {
    tenantId: signal.tenantId,
    targetId,
    type,
    destinationRef,
    action,
    requiredEvidenceType,
    idempotencyKey: digest("idem", [signal.tenantId, signal.fingerprint, type, destinationRef]),
    executionNonce: digest("nonce", [signal.tenantId, signal.bindingHash, type, destinationRef]),
    allowedConnectorIds: allowedConnectors(type),
    status: "PLANNED"
  };
}

export function compileCapitalizationPlan(signal: NormalizedChatSignal, gate: EditorialGateResult): CapitalizationPlan {
  if (!signal || !gate) throw new Error("CAPITALIZATION_PLAN_INVALID_INPUT");

  const recomputedGate = evaluateEditorialSignal(signal, signal.existingFingerprints);
  if (gate.tenantId !== signal.tenantId
    || gate.signalId !== signal.signalId
    || gate.signalFingerprint !== signal.fingerprint
    || gate.signalBindingHash !== signal.bindingHash
    || !sameGateResult(gate, recomputedGate)) {
    throw new Error("CAPITALIZATION_PLAN_GATE_BINDING_MISMATCH");
  }

  if (gate.status !== "APPROVED") {
    return {
      tenantId: signal.tenantId,
      planId: digest("capplan", [signal.tenantId, signal.signalId, gate.status, signal.bindingHash]),
      signalId: signal.signalId,
      signalBindingHash: signal.bindingHash,
      fingerprint: signal.fingerprint,
      status: "BLOCKED",
      targets: [],
      remeStatus: "NOT_ELIGIBLE",
      blockers: gate.reasons.length > 0 ? [...gate.reasons] : ["editorial_gate_not_approved"]
    };
  }

  const targets: CapitalizationTarget[] = [target(
    signal,
    "notion_canonical",
    signal.canonicalDecisionRef ?? "notion:capitalization-inbox",
    "append",
    "connector_receipt"
  )];

  if (signal.canonicalDecisionRef || signal.tags.includes("genesis_v4")) {
    targets.push(target(signal, "genesis_v4", signal.canonicalDecisionRef ?? "GENESIS-V4", "link", "connector_receipt"));
  }
  if (gate.bookCandidate) {
    targets.push(target(signal, "book_manuscript", `book:${signal.bookSectionHint ?? "editorial-memory"}`, "append", "connector_receipt"));
  }
  if (gate.executionCandidate) {
    for (const productRef of signal.productRefs) {
      targets.push(target(signal, "product_execution", `product:${productRef}`, "create_execution_item", "repository_receipt"));
    }
  }

  targets.sort((a, b) => a.targetId.localeCompare(b.targetId));

  return {
    tenantId: signal.tenantId,
    planId: digest("capplan", [signal.tenantId, signal.signalId, signal.bindingHash, ...targets.map(item => item.targetId)]),
    signalId: signal.signalId,
    signalBindingHash: signal.bindingHash,
    fingerprint: signal.fingerprint,
    status: targets.length > 0 ? "READY" : "BLOCKED",
    targets,
    remeStatus: targets.length > 0 ? "PENDING_EXECUTION_EVIDENCE" : "NOT_ELIGIBLE",
    blockers: targets.length > 0 ? [] : ["no_capitalization_targets"]
  };
}

export function planAttestationPayload(plan: CapitalizationPlan): string {
  if (!plan || typeof plan !== "object") throw new Error("CAPITALIZATION_PLAN_INVALID_INPUT");
  const targets = [...plan.targets]
    .sort((a, b) => a.targetId.localeCompare(b.targetId))
    .map(item => ({
      tenantId: item.tenantId,
      targetId: item.targetId,
      type: item.type,
      destinationRef: item.destinationRef,
      action: item.action,
      requiredEvidenceType: item.requiredEvidenceType,
      idempotencyKey: item.idempotencyKey,
      executionNonce: item.executionNonce,
      allowedConnectorIds: canonicalStrings(item.allowedConnectorIds),
      status: item.status
    }));
  return JSON.stringify({
    version: 1,
    tenantId: plan.tenantId,
    planId: plan.planId,
    signalId: plan.signalId,
    signalBindingHash: plan.signalBindingHash,
    fingerprint: plan.fingerprint,
    status: plan.status,
    remeStatus: plan.remeStatus,
    blockers: canonicalStrings(plan.blockers),
    targets
  });
}

export function attestCapitalizationPlan(plan: CapitalizationPlan, secret: string): string {
  const signingSecret = assertHmacSecret(secret, "CAPITALIZATION_PLAN_SIGNER_UNAVAILABLE");
  return createHmac("sha256", signingSecret).update(planAttestationPayload(plan)).digest("hex");
}

function verifyPlanAttestation(plan: CapitalizationPlan, verifier: CapitalizationReceiptVerifier): void {
  const secret = assertHmacSecret(verifier?.planHmacSecret, "CAPITALIZATION_PLAN_ATTESTATION_REQUIRED");
  const attestation = required(verifier?.planAttestation, "CAPITALIZATION_PLAN_ATTESTATION_REQUIRED");
  if (!/^[0-9a-f]{64}$/i.test(attestation)) throw new Error("CAPITALIZATION_PLAN_ATTESTATION_INVALID");
  const expected = createHmac("sha256", secret).update(planAttestationPayload(plan)).digest();
  const actual = Buffer.from(attestation, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("CAPITALIZATION_PLAN_ATTESTATION_INVALID");
  }
}

export function receiptAttestationPayload(
  tenantId: string,
  planId: string,
  target: CapitalizationTarget,
  receipt: UnsignedCapitalizationReceipt
): string {
  return JSON.stringify({
    version: 1,
    tenantId,
    planId,
    targetId: target.targetId,
    targetType: target.type,
    destinationRef: target.destinationRef,
    action: target.action,
    idempotencyKey: target.idempotencyKey,
    executionNonce: target.executionNonce,
    connectorId: receipt.connectorId,
    receiptRef: receipt.receiptRef,
    executedAt: receipt.executedAt,
    status: receipt.status,
    artifactHash: receipt.artifactHash ?? null,
    nonce: receipt.nonce
  });
}

function verifyReceiptAttestation(
  plan: CapitalizationPlan,
  target: CapitalizationTarget,
  receipt: CapitalizationReceipt,
  verifier: CapitalizationReceiptVerifier
): void {
  const connectorId = required(receipt.connectorId, "CAPITALIZATION_RECEIPT_CONNECTOR_REQUIRED");
  if (!target.allowedConnectorIds.includes(connectorId)
    || (verifier.allowedConnectorIds && !verifier.allowedConnectorIds.includes(connectorId))) {
    throw new Error("CAPITALIZATION_RECEIPT_CONNECTOR_NOT_ALLOWED");
  }
  const secret = connectorHmacSecret(verifier, connectorId);
  if (receipt.nonce !== target.executionNonce) throw new Error("CAPITALIZATION_RECEIPT_NONCE_MISMATCH");
  if (!/^[0-9a-f]{64}$/i.test(receipt.attestation)) throw new Error("CAPITALIZATION_RECEIPT_ATTESTATION_INVALID");

  const unsigned: UnsignedCapitalizationReceipt = {
    targetId: receipt.targetId,
    receiptRef: receipt.receiptRef,
    executedAt: receipt.executedAt,
    status: receipt.status,
    artifactHash: receipt.artifactHash,
    connectorId: receipt.connectorId,
    nonce: receipt.nonce
  };
  const expected = createHmac("sha256", secret)
    .update(receiptAttestationPayload(plan.tenantId, plan.planId, target, unsigned))
    .digest();
  const actual = Buffer.from(receipt.attestation, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("CAPITALIZATION_RECEIPT_ATTESTATION_INVALID");
  }
}

export function recordCapitalizationEvidence(
  plan: CapitalizationPlan,
  receipts: CapitalizationReceipt[],
  verifier: CapitalizationReceiptVerifier
): CapitalizationProof {
  if (!plan || typeof plan !== "object") throw new Error("CAPITALIZATION_PROOF_INVALID_PLAN");
  if (!Array.isArray(receipts)) throw new Error("CAPITALIZATION_PROOF_INVALID_RECEIPTS");
  verifyPlanAttestation(plan, verifier);
  assertConnectorKeyring(verifier?.connectorHmacSecrets);

  const planned = new Map(plan.targets.map(item => [item.targetId, item]));
  const normalizedReceipts: CapitalizationReceipt[] = [];
  const seenTargetIds = new Set<string>();

  for (const receipt of receipts) {
    if (!receipt || !planned.has(receipt.targetId)) throw new Error("CAPITALIZATION_RECEIPT_UNKNOWN_TARGET");
    if (seenTargetIds.has(receipt.targetId)) throw new Error("CAPITALIZATION_RECEIPT_DUPLICATE_TARGET");
    const plannedTarget = planned.get(receipt.targetId)!;
    if (plannedTarget.tenantId !== plan.tenantId) throw new Error("CAPITALIZATION_RECEIPT_TENANT_MISMATCH");
    required(receipt.receiptRef, "CAPITALIZATION_RECEIPT_REF_REQUIRED");
    assertTimestamp(receipt.executedAt);
    if (receipt.status !== "success" && receipt.status !== "failed") throw new Error("CAPITALIZATION_RECEIPT_INVALID_STATUS");
    verifyReceiptAttestation(plan, plannedTarget, receipt, verifier);
    normalizedReceipts.push({ ...receipt });
    seenTargetIds.add(receipt.targetId);
  }

  normalizedReceipts.sort((a, b) => a.targetId.localeCompare(b.targetId) || a.receiptRef.localeCompare(b.receiptRef));

  const successfulTargetIds = normalizedReceipts.filter(receipt => receipt.status === "success").map(receipt => receipt.targetId);
  const failedTargetIds = normalizedReceipts.filter(receipt => receipt.status === "failed").map(receipt => receipt.targetId);
  const successful = new Set(successfulTargetIds);
  const failed = new Set(failedTargetIds);
  const missingTargetIds = plan.targets
    .map(item => item.targetId)
    .filter(targetId => !successful.has(targetId) && !failed.has(targetId))
    .sort((a, b) => a.localeCompare(b));

  let status: CapitalizationProof["status"];
  if (plan.targets.length > 0 && successfulTargetIds.length === plan.targets.length) status = "COMPLETE";
  else if (successfulTargetIds.length > 0) status = "PARTIAL";
  else status = "FAILED";

  return {
    tenantId: plan.tenantId,
    proofId: digest("capproof", [
      plan.tenantId,
      plan.planId,
      ...normalizedReceipts.map(receipt => JSON.stringify({
        targetId: receipt.targetId,
        receiptRef: receipt.receiptRef,
        executedAt: receipt.executedAt,
        status: receipt.status,
        artifactHash: receipt.artifactHash ?? null,
        connectorId: receipt.connectorId,
        nonce: receipt.nonce,
        attestation: receipt.attestation
      }))
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
