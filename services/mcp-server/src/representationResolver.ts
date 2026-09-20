export const GENESIS_V4_REPRESENTATION_RESOLVER_ANCHOR = {
  genome: "GENESIS_V4",
  decisionId: "V4-DEC-042",
  capability: "Generative Interaction & Representation Layer",
  firstDomainAdapter: "EDUA_V2",
  truthState: "DESIGN_SELECTION_ONLY"
} as const;

export type RepresentationKind =
  | "text"
  | "table"
  | "chart"
  | "diagram"
  | "simulation"
  | "map"
  | "timeline"
  | "infographic"
  | "handwritten_note"
  | "sticky_board"
  | "flashcards"
  | "quiz"
  | "form"
  | "calculator"
  | "audio"
  | "video_animation"
  | "dashboard"
  | "digital_twin";

export type RepresentationDomain =
  | "education"
  | "finance"
  | "government"
  | "health"
  | "agriculture"
  | "industry"
  | "humanitarian"
  | "enterprise"
  | "general";

export interface RepresentationConstraints {
  bandwidth: "offline" | "low" | "normal";
  device: "mobile" | "desktop" | "kiosk";
  language: string;
}

export interface RepresentationSignals {
  dynamicProcess?: boolean;
  quantitative?: boolean;
  comparisonNeeded?: boolean;
  manipulationNeeded?: boolean;
  procedural?: boolean;
  spatial?: boolean;
  sequential?: boolean;
  assessmentNeeded?: boolean;
  richMediaHelpful?: boolean;
}

export interface RepresentationRequest {
  intent: string;
  domain: RepresentationDomain;
  topic?: string;
  objective: string;
  learnerLevel?: string;
  constraints: RepresentationConstraints;
  signals?: RepresentationSignals;
  evidenceRefs: string[];
}

export interface RankedRepresentation {
  kind: RepresentationKind;
  role: "primary" | "supporting";
  score: number;
  reasons: string[];
}

export interface RepresentationTelemetry {
  eventId: string;
  eventType: "representation.selected";
  domain: RepresentationDomain;
  objective: string;
  selectedKinds: RepresentationKind[];
  constraintsApplied: string[];
  evidenceRefs: string[];
}

export interface RemeRepresentationCandidate {
  status: "candidate_only";
  type: "representation_effectiveness";
  measurementPlan: string[];
  hypothesis: string;
  requiresGateReview: true;
}

export interface RepresentationResolution {
  domain: RepresentationDomain;
  primary: RankedRepresentation;
  composition: RankedRepresentation[];
  constraintsApplied: string[];
  telemetry: RepresentationTelemetry;
  remeCandidate: RemeRepresentationCandidate;
  truthState: "DESIGN_SELECTION_ONLY";
}

export interface EduaRepresentationRequest {
  concept: string;
  learnerLevel: string;
  learningObjective: string;
  constraints: RepresentationConstraints;
  signals?: RepresentationSignals;
  evidenceRefs: string[];
}

export interface EduaRepresentationResolution {
  northStar: "measured_comprehension";
  masteryLoop: [
    "understand",
    "represent",
    "interact",
    "test",
    "diagnose",
    "re_explain",
    "measure_mastery",
    "adapt"
  ];
  representation: RepresentationResolution;
}

const DOMAINS = new Set<RepresentationDomain>([
  "education",
  "finance",
  "government",
  "health",
  "agriculture",
  "industry",
  "humanitarian",
  "enterprise",
  "general"
]);

const BANDWIDTHS = new Set<RepresentationConstraints["bandwidth"]>(["offline", "low", "normal"]);
const DEVICES = new Set<RepresentationConstraints["device"]>(["mobile", "desktop", "kiosk"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, code: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(code);
  }
}

function assertEvidenceRefs(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some(ref => typeof ref !== "string" || !ref.trim())) {
    throw new Error("REPRESENTATION_EVIDENCE_REQUIRED");
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function validateRequest(input: unknown): asserts input is RepresentationRequest {
  if (!isRecord(input)) {
    throw new Error("REPRESENTATION_INVALID_REQUEST");
  }

  requiredText(input.intent, "REPRESENTATION_INVALID_INTENT");
  requiredText(input.objective, "REPRESENTATION_INVALID_OBJECTIVE");
  requiredText(input.domain, "REPRESENTATION_INVALID_DOMAIN");

  if (!DOMAINS.has(input.domain as RepresentationDomain)) {
    throw new Error("REPRESENTATION_INVALID_DOMAIN");
  }

  if (!isRecord(input.constraints)) {
    throw new Error("REPRESENTATION_INVALID_CONSTRAINTS");
  }

  if (!BANDWIDTHS.has(input.constraints.bandwidth as RepresentationConstraints["bandwidth"])) {
    throw new Error("REPRESENTATION_INVALID_BANDWIDTH");
  }

  if (!DEVICES.has(input.constraints.device as RepresentationConstraints["device"])) {
    throw new Error("REPRESENTATION_INVALID_DEVICE");
  }

  requiredText(input.constraints.language, "REPRESENTATION_INVALID_LANGUAGE");
  assertEvidenceRefs(input.evidenceRefs);

  if (input.signals !== undefined && !isRecord(input.signals)) {
    throw new Error("REPRESENTATION_INVALID_SIGNALS");
  }
}

function addCandidate(
  scores: Map<RepresentationKind, { score: number; reasons: string[] }>,
  kind: RepresentationKind,
  score: number,
  reason: string
) {
  const current = scores.get(kind);
  if (current) {
    current.score += score;
    current.reasons.push(reason);
    return;
  }

  scores.set(kind, { score, reasons: [reason] });
}

function rankRepresentations(input: RepresentationRequest) {
  const scores = new Map<RepresentationKind, { score: number; reasons: string[] }>();
  const signals = input.signals ?? {};

  addCandidate(scores, "text", 20, "Universal accessible fallback.");

  if (signals.dynamicProcess) {
    addCandidate(scores, "simulation", 120, "Dynamic mechanism benefits from manipulation and causal feedback.");
    addCandidate(scores, "diagram", 55, "Diagram supports structural understanding of the mechanism.");
  }

  if (signals.quantitative) {
    addCandidate(scores, "calculator", 125, "Quantitative outcome requires direct parameter manipulation.");
    addCandidate(scores, "chart", 95, "Chart exposes quantitative variation and sensitivity.");
  }

  if (signals.comparisonNeeded) {
    addCandidate(scores, "chart", 45, "Comparison benefits from visual contrast.");
    addCandidate(scores, "table", 40, "Table preserves exact comparable values.");
  }

  if (signals.manipulationNeeded && signals.quantitative) {
    addCandidate(scores, "dashboard", 70, "Interactive decision support benefits from coordinated controls and outputs.");
  } else if (signals.manipulationNeeded) {
    addCandidate(scores, "simulation", 60, "Manipulation requirement favors an interactive representation.");
  }

  if (signals.procedural) {
    addCandidate(scores, "sticky_board", 130, "Procedure requires ordered actionable steps and completion state.");
    addCandidate(scores, "text", 55, "Text fallback preserves the procedure in low-connectivity contexts.");
  }

  if (signals.spatial) {
    addCandidate(scores, "map", 120, "Spatial reasoning requires geospatial representation.");
    addCandidate(scores, "diagram", 45, "Diagram can provide a non-map spatial fallback.");
  }

  if (signals.sequential) {
    addCandidate(scores, "timeline", 105, "Temporal or sequential logic benefits from ordered visualization.");
  }

  if (signals.assessmentNeeded) {
    addCandidate(scores, "quiz", 85, "Assessment is required to measure understanding or task readiness.");
  }

  if (signals.richMediaHelpful) {
    addCandidate(scores, "video_animation", 75, "Animation can clarify motion or change over time.");
  }

  if (input.domain === "education") {
    addCandidate(scores, "infographic", 35, "Education benefits from concise visual synthesis.");
    if (!signals.assessmentNeeded) {
      addCandidate(scores, "flashcards", 30, "Recall practice is a lightweight supporting representation.");
    }
  }

  if (input.domain === "finance" || input.domain === "government" || input.domain === "industry") {
    addCandidate(scores, "dashboard", 30, "Operational domains often need monitored decision state.");
  }

  return scores;
}

function applyConstraints(
  scores: Map<RepresentationKind, { score: number; reasons: string[] }>,
  input: RepresentationRequest
): string[] {
  const applied: string[] = [];

  if (input.constraints.bandwidth === "low") {
    scores.delete("video_animation");
    scores.delete("digital_twin");
    applied.push("LOW_BANDWIDTH_POLICY");
  }

  if (input.constraints.bandwidth === "offline") {
    scores.delete("video_animation");
    scores.delete("digital_twin");
    applied.push("OFFLINE_FIRST_POLICY");
  }

  if (input.constraints.device === "mobile") {
    const dashboard = scores.get("dashboard");
    if (dashboard) {
      dashboard.score -= 20;
      dashboard.reasons.push("Mobile device reduces dashboard priority.");
    }
    applied.push("MOBILE_FIRST_POLICY");
  }

  return applied;
}

export function resolveRepresentation(input: RepresentationRequest): RepresentationResolution {
  validateRequest(input);

  const scores = rankRepresentations(input);
  const constraintsApplied = applyConstraints(scores, input);

  const ranked = [...scores.entries()]
    .map(([kind, value]) => ({
      kind,
      score: value.score,
      reasons: unique(value.reasons)
    }))
    .sort((left, right) => right.score - left.score || left.kind.localeCompare(right.kind))
    .slice(0, 3);

  if (ranked.length === 0) {
    throw new Error("REPRESENTATION_NO_SAFE_FORMAT");
  }

  const composition = ranked.map((item, index) => ({
    ...item,
    role: index === 0 ? "primary" as const : "supporting" as const
  }));
  const primary = composition[0]!;
  const selectedKinds = composition.map(item => item.kind);
  const eventSeed = [
    input.domain,
    input.objective,
    input.intent,
    input.constraints.bandwidth,
    input.constraints.device,
    ...selectedKinds
  ].join("|");

  const telemetry: RepresentationTelemetry = {
    eventId: `repr-${stableHash(eventSeed)}`,
    eventType: "representation.selected",
    domain: input.domain,
    objective: input.objective,
    selectedKinds,
    constraintsApplied,
    evidenceRefs: unique(input.evidenceRefs)
  };

  return {
    domain: input.domain,
    primary,
    composition,
    constraintsApplied,
    telemetry,
    remeCandidate: {
      status: "candidate_only",
      type: "representation_effectiveness",
      measurementPlan: [
        "task_completion",
        "comprehension_delta",
        "time_to_outcome",
        "format_switch_rate"
      ],
      hypothesis: `${primary.kind} is the best current representation for the explicit intent and constraints; effectiveness remains to be measured.`,
      requiresGateReview: true
    },
    truthState: "DESIGN_SELECTION_ONLY"
  };
}

export function adaptEduaRepresentation(input: EduaRepresentationRequest): EduaRepresentationResolution {
  if (!isRecord(input)) {
    throw new Error("EDUA_REPRESENTATION_INVALID_REQUEST");
  }
  requiredText(input.concept, "EDUA_REPRESENTATION_INVALID_CONCEPT");
  requiredText(input.learnerLevel, "EDUA_REPRESENTATION_INVALID_LEARNER_LEVEL");
  requiredText(input.learningObjective, "EDUA_REPRESENTATION_INVALID_OBJECTIVE");

  const representation = resolveRepresentation({
    intent: `Learn and master: ${input.concept}`,
    domain: "education",
    topic: input.concept,
    objective: input.learningObjective,
    learnerLevel: input.learnerLevel,
    constraints: input.constraints,
    signals: input.signals,
    evidenceRefs: input.evidenceRefs
  });

  return {
    northStar: "measured_comprehension",
    masteryLoop: [
      "understand",
      "represent",
      "interact",
      "test",
      "diagnose",
      "re_explain",
      "measure_mastery",
      "adapt"
    ],
    representation
  };
}
