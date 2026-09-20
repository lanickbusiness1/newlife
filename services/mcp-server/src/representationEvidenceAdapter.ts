import {
  compileRepresentationArtifact,
  type BoundedInteractiveModel,
  type CompiledRepresentationArtifact,
  type RepresentationContentModel
} from "./representationArtifactCompiler.js";
import type {
  RepresentationConstraints,
  RepresentationDomain,
  RepresentationSignals
} from "./representationResolver.js";

export const GENESIS_EVIDENCE_TO_CONTENT_ADAPTER = {
  adapterId: "GEN-REP-EVIDENCE-ADAPTER-001",
  version: "0.1.0",
  compilerProfileId: "GEN-COMPILER-PROFILE-REPRESENTATION-001",
  decisionId: "V4-DEC-042",
  truthState: "COMPILED_FROM_SUPPLIED_EVIDENCE"
} as const;

export type EvidenceItemKind =
  | "fact"
  | "step"
  | "metric"
  | "comparison"
  | "question"
  | "variable";

export interface EvidenceItem {
  evidenceRef: string;
  kind: EvidenceItemKind;
  label: string;
  claim: string;
  contradictionKey?: string;
  sequence?: number;
  value?: number;
  unit?: string;
  values?: Record<string, string | number>;
  options?: string[];
  correctIndex?: number;
  explanation?: string;
  id?: string;
  min?: number;
  max?: number;
  step?: number;
  initial?: number;
}

export interface EvidencePacketInteractiveModel {
  operation: BoundedInteractiveModel["operation"];
  outputLabel: string;
  outputUnit?: string;
}

export interface EvidencePacket {
  summary?: string;
  items: EvidenceItem[];
  interactiveModel?: EvidencePacketInteractiveModel;
}

export interface RepresentationEvidenceCompileRequest {
  topic: string;
  domain: RepresentationDomain;
  objective: string;
  learnerLevel?: string;
  constraints: RepresentationConstraints;
  evidencePacket: EvidencePacket;
}

export interface EvidenceDiagnostic {
  code: "EVIDENCE_CONTRADICTION";
  key: string;
  evidenceRefs: string[];
  message: string;
}

export interface RepresentationEvidenceCompileResult {
  adapterId: typeof GENESIS_EVIDENCE_TO_CONTENT_ADAPTER.adapterId;
  inferredSignals: RepresentationSignals;
  content: RepresentationContentModel;
  diagnostics: EvidenceDiagnostic[];
  compilation: CompiledRepresentationArtifact;
  truthState: typeof GENESIS_EVIDENCE_TO_CONTENT_ADAPTER.truthState;
}

const MAX_EVIDENCE_ITEMS = 100;
const SUPPORTED_OPERATIONS = new Set<BoundedInteractiveModel["operation"]>([
  "min",
  "max",
  "sum",
  "average",
  "multiply"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, code: string, max = 6000): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(code);
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function validateItem(item: EvidenceItem) {
  requiredText(item.evidenceRef, "EVIDENCE_ITEM_REFERENCE_REQUIRED", 500);
  requiredText(item.kind, "EVIDENCE_ITEM_KIND_REQUIRED", 40);
  requiredText(item.label, "EVIDENCE_ITEM_LABEL_REQUIRED", 400);
  requiredText(item.claim, "EVIDENCE_ITEM_CLAIM_REQUIRED");

  if (!["fact", "step", "metric", "comparison", "question", "variable"].includes(item.kind)) {
    throw new Error("EVIDENCE_ITEM_KIND_UNSUPPORTED");
  }

  if (item.contradictionKey !== undefined) {
    requiredText(item.contradictionKey, "EVIDENCE_ITEM_INVALID_CONTRADICTION_KEY", 300);
  }

  if (item.kind === "step" && item.sequence !== undefined &&
      (!Number.isInteger(item.sequence) || item.sequence < 0 || item.sequence > 10000)) {
    throw new Error("EVIDENCE_ITEM_INVALID_SEQUENCE");
  }

  if (item.kind === "metric") {
    if (typeof item.value !== "number" || !Number.isFinite(item.value)) {
      throw new Error("EVIDENCE_METRIC_VALUE_REQUIRED");
    }
  }

  if (item.kind === "comparison") {
    if (!isRecord(item.values) || Object.keys(item.values).length === 0) {
      throw new Error("EVIDENCE_COMPARISON_VALUES_REQUIRED");
    }
    for (const value of Object.values(item.values)) {
      if ((typeof value !== "string" && typeof value !== "number") ||
          (typeof value === "number" && !Number.isFinite(value))) {
        throw new Error("EVIDENCE_COMPARISON_VALUE_INVALID");
      }
    }
  }

  if (item.kind === "question") {
    if (!Array.isArray(item.options) || item.options.length < 2 ||
        item.options.some(option => typeof option !== "string" || !option.trim())) {
      throw new Error("EVIDENCE_QUESTION_OPTIONS_REQUIRED");
    }
    if (item.correctIndex !== undefined &&
        (!Number.isInteger(item.correctIndex) ||
         item.correctIndex < 0 ||
         item.correctIndex >= item.options.length)) {
      throw new Error("EVIDENCE_QUESTION_CORRECT_INDEX_INVALID");
    }
  }

  if (item.kind === "variable") {
    requiredText(item.id, "EVIDENCE_VARIABLE_ID_REQUIRED", 80);
    if (!/^[a-z][a-z0-9_-]*$/i.test(item.id)) {
      throw new Error("EVIDENCE_VARIABLE_ID_INVALID");
    }
    for (const key of ["min", "max", "step", "initial"] as const) {
      if (typeof item[key] !== "number" || !Number.isFinite(item[key])) {
        throw new Error("EVIDENCE_VARIABLE_BOUNDS_REQUIRED");
      }
    }
    if (item.min! >= item.max! || item.step! <= 0 ||
        item.initial! < item.min! || item.initial! > item.max!) {
      throw new Error("EVIDENCE_VARIABLE_BOUNDS_INVALID");
    }
  }
}

function validateRequest(input: unknown): asserts input is RepresentationEvidenceCompileRequest {
  if (!isRecord(input) || !isRecord(input.evidencePacket)) {
    throw new Error("EVIDENCE_COMPILE_INVALID_REQUEST");
  }
  requiredText(input.topic, "EVIDENCE_TOPIC_REQUIRED", 500);
  requiredText(input.domain, "EVIDENCE_DOMAIN_REQUIRED", 80);
  requiredText(input.objective, "EVIDENCE_OBJECTIVE_REQUIRED", 300);

  if (!isRecord(input.constraints)) {
    throw new Error("EVIDENCE_CONSTRAINTS_REQUIRED");
  }
  requiredText(input.constraints.language, "EVIDENCE_LANGUAGE_REQUIRED", 40);

  if (!Array.isArray(input.evidencePacket.items) ||
      input.evidencePacket.items.length === 0 ||
      input.evidencePacket.items.length > MAX_EVIDENCE_ITEMS) {
    throw new Error("EVIDENCE_ITEMS_REQUIRED");
  }

  for (const raw of input.evidencePacket.items) {
    if (!isRecord(raw)) throw new Error("EVIDENCE_ITEM_INVALID");
    validateItem(raw as unknown as EvidenceItem);
  }

  if (input.evidencePacket.summary !== undefined) {
    requiredText(input.evidencePacket.summary, "EVIDENCE_SUMMARY_INVALID");
  }

  if (input.evidencePacket.interactiveModel !== undefined) {
    const model = input.evidencePacket.interactiveModel;
    if (!isRecord(model)) throw new Error("EVIDENCE_MODEL_INVALID");
    if (!SUPPORTED_OPERATIONS.has(model.operation as BoundedInteractiveModel["operation"])) {
      throw new Error("EVIDENCE_MODEL_UNSUPPORTED_OPERATION");
    }
    requiredText(model.outputLabel, "EVIDENCE_MODEL_OUTPUT_LABEL_REQUIRED", 300);
    if (model.outputUnit !== undefined &&
        (typeof model.outputUnit !== "string" || model.outputUnit.length > 40)) {
      throw new Error("EVIDENCE_MODEL_OUTPUT_UNIT_INVALID");
    }
  }
}

function findContradictions(items: EvidenceItem[]): {
  diagnostics: EvidenceDiagnostic[];
  conflictingKeys: Set<string>;
} {
  const groups = new Map<string, EvidenceItem[]>();

  for (const item of items) {
    if (!item.contradictionKey) continue;
    const current = groups.get(item.contradictionKey) ?? [];
    current.push(item);
    groups.set(item.contradictionKey, current);
  }

  const diagnostics: EvidenceDiagnostic[] = [];
  const conflictingKeys = new Set<string>();

  for (const [key, group] of groups) {
    const claims = unique(group.map(item => item.claim.trim()));
    if (claims.length <= 1) continue;

    conflictingKeys.add(key);
    diagnostics.push({
      code: "EVIDENCE_CONTRADICTION",
      key,
      evidenceRefs: unique(group.map(item => item.evidenceRef)),
      message: `Contradictory evidence for '${key}' was excluded from rendered claims pending resolution.`
    });
  }

  return { diagnostics, conflictingKeys };
}

function inferSignals(
  safeItems: EvidenceItem[],
  packet: EvidencePacket
): RepresentationSignals {
  const steps = safeItems.filter(item => item.kind === "step");
  const metrics = safeItems.filter(item => item.kind === "metric");
  const comparisons = safeItems.filter(item => item.kind === "comparison");
  const questions = safeItems.filter(item => item.kind === "question");
  const variables = safeItems.filter(item => item.kind === "variable");

  return {
    ...(steps.length > 0 ? { sequential: true } : {}),
    ...(metrics.length > 0 || comparisons.length > 0 ? { quantitative: true } : {}),
    ...(comparisons.length > 0 || metrics.length > 1 ? { comparisonNeeded: true } : {}),
    ...(questions.length > 0 ? { assessmentNeeded: true } : {}),
    ...(packet.interactiveModel && variables.length > 0
      ? { dynamicProcess: true, manipulationNeeded: true }
      : {})
  };
}

function buildContent(
  topic: string,
  packet: EvidencePacket,
  safeItems: EvidenceItem[],
  diagnostics: EvidenceDiagnostic[]
): RepresentationContentModel {
  const facts = safeItems.filter(item => item.kind === "fact");
  const steps = safeItems
    .filter(item => item.kind === "step")
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const left = a.item.sequence;
      const right = b.item.sequence;
      if (left === undefined && right === undefined) return a.index - b.index;
      if (left === undefined) return 1;
      if (right === undefined) return -1;
      return left - right || a.index - b.index;
    })
    .map(({ item }) => ({
      label: item.label,
      detail: item.claim,
      evidenceRefs: [item.evidenceRef]
    }));

  const metrics = safeItems
    .filter(item => item.kind === "metric")
    .map(item => ({
      label: item.label,
      value: item.value!,
      ...(item.unit ? { unit: item.unit } : {}),
      evidenceRefs: [item.evidenceRef]
    }));

  const comparisons = safeItems
    .filter(item => item.kind === "comparison")
    .map(item => ({
      label: item.label,
      values: item.values!,
      evidenceRefs: [item.evidenceRef]
    }));

  const questions = safeItems
    .filter(item => item.kind === "question")
    .map(item => ({
      prompt: item.claim,
      options: item.options!,
      ...(item.correctIndex !== undefined ? { correctIndex: item.correctIndex } : {}),
      ...(item.explanation ? { explanation: item.explanation } : {}),
      evidenceRefs: [item.evidenceRef]
    }));

  const variables = safeItems.filter(item => item.kind === "variable");
  let interactiveModel: BoundedInteractiveModel | undefined;

  if (packet.interactiveModel) {
    if (variables.length === 0) {
      throw new Error("EVIDENCE_MODEL_VARIABLES_REQUIRED");
    }
    interactiveModel = {
      operation: packet.interactiveModel.operation,
      outputLabel: packet.interactiveModel.outputLabel,
      ...(packet.interactiveModel.outputUnit ? { outputUnit: packet.interactiveModel.outputUnit } : {}),
      variables: variables.map(item => ({
        id: item.id!,
        label: item.label,
        min: item.min!,
        max: item.max!,
        step: item.step!,
        initial: item.initial!,
        ...(item.unit ? { unit: item.unit } : {})
      }))
    };
  }

  const fallbackSummary = `Synthèse structurée à partir de ${safeItems.length} élément(s) de preuve fourni(s) pour « ${topic} ».`;
  const contradictionNote = diagnostics.length > 0
    ? ` ${diagnostics.length} contradiction(s) ont été exclues du contenu rendu.`
    : "";

  return {
    title: topic,
    summary: `${packet.summary ?? fallbackSummary}${contradictionNote}`,
    ...(facts.length > 0 ? {
      cards: facts.map(item => ({
        title: item.label,
        body: item.claim,
        evidenceRefs: [item.evidenceRef]
      }))
    } : {}),
    ...(steps.length > 0 ? { steps } : {}),
    ...(metrics.length > 0 ? { metrics } : {}),
    ...(comparisons.length > 0 ? { comparisons } : {}),
    ...(questions.length > 0 ? { questions } : {}),
    ...(interactiveModel ? { interactiveModel } : {})
  };
}

export function compileRepresentationFromEvidence(
  input: RepresentationEvidenceCompileRequest
): RepresentationEvidenceCompileResult {
  validateRequest(input);

  const items = input.evidencePacket.items;
  const { diagnostics, conflictingKeys } = findContradictions(items);
  const safeItems = items.filter(item =>
    !item.contradictionKey || !conflictingKeys.has(item.contradictionKey)
  );

  if (safeItems.length === 0) {
    throw new Error("EVIDENCE_NO_NON_CONTRADICTORY_CONTENT");
  }

  const inferredSignals = inferSignals(safeItems, input.evidencePacket);
  const content = buildContent(
    input.topic,
    input.evidencePacket,
    safeItems,
    diagnostics
  );

  const evidenceRefs = unique(items.map(item => item.evidenceRef));
  const compilation = compileRepresentationArtifact({
    representationRequest: {
      intent: `Compile evidence-backed representation for: ${input.topic}`,
      domain: input.domain,
      topic: input.topic,
      objective: input.objective,
      ...(input.learnerLevel ? { learnerLevel: input.learnerLevel } : {}),
      constraints: input.constraints,
      signals: inferredSignals,
      evidenceRefs
    },
    content
  });

  return {
    adapterId: GENESIS_EVIDENCE_TO_CONTENT_ADAPTER.adapterId,
    inferredSignals,
    content,
    diagnostics,
    compilation,
    truthState: GENESIS_EVIDENCE_TO_CONTENT_ADAPTER.truthState
  };
}
