import { createHash } from "node:crypto";
import {
  resolveRepresentation,
  type RepresentationKind,
  type RepresentationRequest,
  type RepresentationResolution
} from "./representationResolver.js";

export const GENESIS_REPRESENTATION_COMPILER_PROFILE = {
  profileId: "GEN-COMPILER-PROFILE-REPRESENTATION-001",
  version: "0.1.0",
  decisionId: "V4-DEC-042",
  parentCompiler: "140_compiler.sql",
  compilerContractRef: "ABL-COMPILER-SCE-001",
  outputManifestRef: "COMPILER-OUTPUT-MANIFEST-001",
  outputFormat: "self_contained_html",
  truthState: "COMPILED_ARTIFACT_ONLY"
} as const;

export interface EvidenceBackedCard {
  title: string;
  body: string;
  evidenceRefs: string[];
}

export interface EvidenceBackedStep {
  label: string;
  detail: string;
  evidenceRefs: string[];
}

export interface EvidenceBackedMetric {
  label: string;
  value: number;
  unit?: string;
  evidenceRefs: string[];
}

export interface EvidenceBackedComparison {
  label: string;
  values: Record<string, string | number>;
  evidenceRefs: string[];
}

export interface EvidenceBackedQuestion {
  prompt: string;
  options: string[];
  correctIndex?: number;
  explanation?: string;
  evidenceRefs: string[];
}

export interface RepresentationFormField {
  id: string;
  label: string;
  type: "text" | "number" | "checkbox";
  required?: boolean;
}

export interface NumericVariable {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  initial: number;
  unit?: string;
}

export interface BoundedInteractiveModel {
  operation: "min" | "max" | "sum" | "average";
  outputLabel: string;
  outputUnit?: string;
  variables: NumericVariable[];
}

export interface RepresentationContentModel {
  title: string;
  summary: string;
  cards?: EvidenceBackedCard[];
  steps?: EvidenceBackedStep[];
  metrics?: EvidenceBackedMetric[];
  comparisons?: EvidenceBackedComparison[];
  questions?: EvidenceBackedQuestion[];
  formFields?: RepresentationFormField[];
  interactiveModel?: BoundedInteractiveModel;
}

export interface RepresentationArtifactCompileRequest {
  representationRequest: RepresentationRequest;
  content: RepresentationContentModel;
}

export interface RepresentationArtifactManifest {
  artifactId: string;
  compilerProfileId: typeof GENESIS_REPRESENTATION_COMPILER_PROFILE.profileId;
  compilerProfileVersion: typeof GENESIS_REPRESENTATION_COMPILER_PROFILE.version;
  decisionId: typeof GENESIS_REPRESENTATION_COMPILER_PROFILE.decisionId;
  outputManifestRef: typeof GENESIS_REPRESENTATION_COMPILER_PROFILE.outputManifestRef;
  requestedPrimaryKind: RepresentationKind;
  selectedKind: RepresentationKind;
  degraded: boolean;
  degradedFrom?: RepresentationKind;
  degradationReason?: string;
  representationEventId: string;
  evidenceRefs: string[];
  contentDigest: string;
  artifactDigest: string;
  manifestDigest: string;
  truthState: "COMPILED_ARTIFACT_ONLY";
  effectivenessClaim: "NOT_MEASURED";
}

export interface CompiledRepresentationArtifact {
  resolution: RepresentationResolution;
  manifest: RepresentationArtifactManifest;
  html: string;
}

const MAX_ITEMS = 50;
const MAX_TEXT = 6000;
const MAX_ARTIFACT_BYTES = 180_000;
const FORMATS_WITH_PROVIDER_RENDERERS = new Set<RepresentationKind>([
  "map",
  "audio",
  "video_animation",
  "digital_twin"
]);
const OPERATIONS = new Set<BoundedInteractiveModel["operation"]>([
  "min",
  "max",
  "sum",
  "average"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, code: string, max = MAX_TEXT): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(code);
  }
}

function evidenceRefs(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some(ref => typeof ref !== "string" || !ref.trim())) {
    throw new Error("REPRESENTATION_ARTIFACT_EVIDENCE_REQUIRED");
  }
}

function limitedArray(value: unknown, code: string): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) {
    throw new Error(code);
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key =>
    `${JSON.stringify(key)}:${stableStringify(record[key])}`
  ).join(",")}}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function validateItems(content: RepresentationContentModel) {
  if (content.cards !== undefined) {
    limitedArray(content.cards, "REPRESENTATION_ARTIFACT_INVALID_CARDS");
    for (const item of content.cards) {
      if (!isRecord(item)) throw new Error("REPRESENTATION_ARTIFACT_INVALID_CARD");
      requiredText(item.title, "REPRESENTATION_ARTIFACT_INVALID_CARD_TITLE", 300);
      requiredText(item.body, "REPRESENTATION_ARTIFACT_INVALID_CARD_BODY");
      evidenceRefs(item.evidenceRefs);
    }
  }

  if (content.steps !== undefined) {
    limitedArray(content.steps, "REPRESENTATION_ARTIFACT_INVALID_STEPS");
    for (const item of content.steps) {
      if (!isRecord(item)) throw new Error("REPRESENTATION_ARTIFACT_INVALID_STEP");
      requiredText(item.label, "REPRESENTATION_ARTIFACT_INVALID_STEP_LABEL", 300);
      requiredText(item.detail, "REPRESENTATION_ARTIFACT_INVALID_STEP_DETAIL");
      evidenceRefs(item.evidenceRefs);
    }
  }

  if (content.metrics !== undefined) {
    limitedArray(content.metrics, "REPRESENTATION_ARTIFACT_INVALID_METRICS");
    for (const item of content.metrics) {
      if (!isRecord(item)) throw new Error("REPRESENTATION_ARTIFACT_INVALID_METRIC");
      requiredText(item.label, "REPRESENTATION_ARTIFACT_INVALID_METRIC_LABEL", 300);
      if (typeof item.value !== "number" || !Number.isFinite(item.value)) {
        throw new Error("REPRESENTATION_ARTIFACT_INVALID_METRIC_VALUE");
      }
      if (item.unit !== undefined && (typeof item.unit !== "string" || item.unit.length > 40)) {
        throw new Error("REPRESENTATION_ARTIFACT_INVALID_METRIC_UNIT");
      }
      evidenceRefs(item.evidenceRefs);
    }
  }

  if (content.comparisons !== undefined) {
    limitedArray(content.comparisons, "REPRESENTATION_ARTIFACT_INVALID_COMPARISONS");
    for (const item of content.comparisons) {
      if (!isRecord(item)) throw new Error("REPRESENTATION_ARTIFACT_INVALID_COMPARISON");
      requiredText(item.label, "REPRESENTATION_ARTIFACT_INVALID_COMPARISON_LABEL", 300);
      if (!isRecord(item.values) || Object.keys(item.values).length === 0 || Object.keys(item.values).length > 20) {
        throw new Error("REPRESENTATION_ARTIFACT_INVALID_COMPARISON_VALUES");
      }
      for (const value of Object.values(item.values)) {
        if ((typeof value !== "string" && typeof value !== "number") ||
            (typeof value === "number" && !Number.isFinite(value)) ||
            (typeof value === "string" && value.length > 1000)) {
          throw new Error("REPRESENTATION_ARTIFACT_INVALID_COMPARISON_VALUE");
        }
      }
      evidenceRefs(item.evidenceRefs);
    }
  }

  if (content.questions !== undefined) {
    limitedArray(content.questions, "REPRESENTATION_ARTIFACT_INVALID_QUESTIONS");
    for (const item of content.questions) {
      if (!isRecord(item)) throw new Error("REPRESENTATION_ARTIFACT_INVALID_QUESTION");
      requiredText(item.prompt, "REPRESENTATION_ARTIFACT_INVALID_QUESTION_PROMPT");
      limitedArray(item.options, "REPRESENTATION_ARTIFACT_INVALID_OPTIONS");
      if (item.options.length < 2 || item.options.some(option => typeof option !== "string" || !option.trim() || option.length > 1000)) {
        throw new Error("REPRESENTATION_ARTIFACT_INVALID_OPTIONS");
      }
      if (item.correctIndex !== undefined &&
          (!Number.isInteger(item.correctIndex) || item.correctIndex < 0 || item.correctIndex >= item.options.length)) {
        throw new Error("REPRESENTATION_ARTIFACT_INVALID_CORRECT_INDEX");
      }
      if (item.explanation !== undefined) {
        requiredText(item.explanation, "REPRESENTATION_ARTIFACT_INVALID_EXPLANATION");
      }
      evidenceRefs(item.evidenceRefs);
    }
  }

  if (content.formFields !== undefined) {
    limitedArray(content.formFields, "REPRESENTATION_ARTIFACT_INVALID_FORM_FIELDS");
    for (const field of content.formFields) {
      if (!isRecord(field)) throw new Error("REPRESENTATION_ARTIFACT_INVALID_FORM_FIELD");
      requiredText(field.id, "REPRESENTATION_ARTIFACT_INVALID_FIELD_ID", 80);
      requiredText(field.label, "REPRESENTATION_ARTIFACT_INVALID_FIELD_LABEL", 300);
      if (!/^[a-z][a-z0-9_-]*$/i.test(field.id)) throw new Error("REPRESENTATION_ARTIFACT_INVALID_FIELD_ID");
      if (!["text", "number", "checkbox"].includes(String(field.type))) {
        throw new Error("REPRESENTATION_ARTIFACT_INVALID_FIELD_TYPE");
      }
      if (field.required !== undefined && typeof field.required !== "boolean") {
        throw new Error("REPRESENTATION_ARTIFACT_INVALID_FIELD_REQUIRED");
      }
    }
  }

  if (content.interactiveModel !== undefined) {
    const model = content.interactiveModel;
    if (!isRecord(model)) throw new Error("REPRESENTATION_ARTIFACT_INVALID_INTERACTIVE_MODEL");
    if (!OPERATIONS.has(model.operation as BoundedInteractiveModel["operation"])) {
      throw new Error("REPRESENTATION_ARTIFACT_INVALID_OPERATION");
    }
    requiredText(model.outputLabel, "REPRESENTATION_ARTIFACT_INVALID_OUTPUT_LABEL", 300);
    if (model.outputUnit !== undefined && (typeof model.outputUnit !== "string" || model.outputUnit.length > 40)) {
      throw new Error("REPRESENTATION_ARTIFACT_INVALID_OUTPUT_UNIT");
    }
    limitedArray(model.variables, "REPRESENTATION_ARTIFACT_INVALID_VARIABLES");
    if (model.variables.length < 1 || model.variables.length > 8) {
      throw new Error("REPRESENTATION_ARTIFACT_INVALID_VARIABLES");
    }

    const ids = new Set<string>();
    for (const variable of model.variables) {
      if (!isRecord(variable)) throw new Error("REPRESENTATION_ARTIFACT_INVALID_VARIABLE");
      requiredText(variable.id, "REPRESENTATION_ARTIFACT_INVALID_VARIABLE_ID", 80);
      requiredText(variable.label, "REPRESENTATION_ARTIFACT_INVALID_VARIABLE_LABEL", 300);
      if (!/^[a-z][a-z0-9_-]*$/i.test(variable.id) || ids.has(variable.id)) {
        throw new Error("REPRESENTATION_ARTIFACT_INVALID_VARIABLE_ID");
      }
      ids.add(variable.id);
      for (const key of ["min", "max", "step", "initial"] as const) {
        if (typeof variable[key] !== "number" || !Number.isFinite(variable[key])) {
          throw new Error("REPRESENTATION_ARTIFACT_INVALID_VARIABLE_RANGE");
        }
      }
      if (variable.min >= variable.max || variable.step <= 0 ||
          variable.initial < variable.min || variable.initial > variable.max) {
        throw new Error("REPRESENTATION_ARTIFACT_INVALID_VARIABLE_RANGE");
      }
      if (variable.unit !== undefined && (typeof variable.unit !== "string" || variable.unit.length > 40)) {
        throw new Error("REPRESENTATION_ARTIFACT_INVALID_VARIABLE_UNIT");
      }
    }
  }
}

function validateCompileRequest(input: unknown): asserts input is RepresentationArtifactCompileRequest {
  if (!isRecord(input) || !isRecord(input.content) || !isRecord(input.representationRequest)) {
    throw new Error("REPRESENTATION_ARTIFACT_INVALID_REQUEST");
  }

  requiredText(input.content.title, "REPRESENTATION_ARTIFACT_INVALID_TITLE", 500);
  requiredText(input.content.summary, "REPRESENTATION_ARTIFACT_INVALID_SUMMARY");
  validateItems(input.content as unknown as RepresentationContentModel);
}

function collectEvidence(input: RepresentationArtifactCompileRequest): string[] {
  const refs = [...input.representationRequest.evidenceRefs];
  for (const collection of [
    input.content.cards,
    input.content.steps,
    input.content.metrics,
    input.content.comparisons,
    input.content.questions
  ]) {
    for (const item of collection ?? []) refs.push(...item.evidenceRefs);
  }
  return unique(refs);
}

function canRender(kind: RepresentationKind, content: RepresentationContentModel): boolean {
  switch (kind) {
    case "text":
      return true;
    case "table":
      return Boolean(content.comparisons?.length);
    case "chart":
      return Boolean(content.metrics?.length);
    case "diagram":
      return Boolean(content.cards?.length || content.steps?.length);
    case "simulation":
    case "calculator":
      return Boolean(content.interactiveModel);
    case "timeline":
      return Boolean(content.steps?.length);
    case "infographic":
      return Boolean(content.cards?.length || content.metrics?.length || content.steps?.length);
    case "handwritten_note":
      return true;
    case "sticky_board":
      return Boolean(content.steps?.length);
    case "flashcards":
      return Boolean(content.cards?.length);
    case "quiz":
      return Boolean(content.questions?.length);
    case "form":
      return Boolean(content.formFields?.length);
    case "dashboard":
      return Boolean(content.metrics?.length || content.cards?.length || content.steps?.length);
    case "map":
    case "audio":
    case "video_animation":
    case "digital_twin":
      return false;
    default:
      return false;
  }
}

function degradationReason(primary: RepresentationKind, content: RepresentationContentModel): string {
  if ((primary === "simulation" || primary === "calculator") && !content.interactiveModel) {
    return "INTERACTIVE_MODEL_REQUIRED";
  }
  if (FORMATS_WITH_PROVIDER_RENDERERS.has(primary)) {
    return "RENDERER_UNAVAILABLE_IN_SELF_CONTAINED_HTML_PROFILE";
  }
  return `CONTENT_MODEL_INSUFFICIENT_FOR_${primary.toUpperCase()}`;
}

function chooseKind(
  resolution: RepresentationResolution,
  content: RepresentationContentModel
): { selectedKind: RepresentationKind; degraded: boolean; degradationReason?: string } {
  for (const candidate of resolution.composition) {
    if (canRender(candidate.kind, content)) {
      const degraded = candidate.kind !== resolution.primary.kind;
      return {
        selectedKind: candidate.kind,
        degraded,
        degradationReason: degraded ? degradationReason(resolution.primary.kind, content) : undefined
      };
    }
  }

  const fallbackOrder: RepresentationKind[] = [
    "infographic",
    "timeline",
    "chart",
    "sticky_board",
    "table",
    "diagram",
    "flashcards",
    "quiz",
    "form",
    "handwritten_note",
    "text"
  ];

  const selectedKind = fallbackOrder.find(kind => canRender(kind, content));
  if (!selectedKind) throw new Error("REPRESENTATION_ARTIFACT_NO_SAFE_RENDERER");

  return {
    selectedKind,
    degraded: selectedKind !== resolution.primary.kind,
    degradationReason: selectedKind !== resolution.primary.kind
      ? degradationReason(resolution.primary.kind, content)
      : undefined
  };
}

function renderCards(cards: EvidenceBackedCard[]): string {
  return `<div class="cards">${cards.map(card =>
    `<article class="card"><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.body)}</p></article>`
  ).join("")}</div>`;
}

function renderSteps(steps: EvidenceBackedStep[], checkbox = false): string {
  if (checkbox) {
    return `<div class="steps">${steps.map((step, index) =>
      `<label class="step-card"><input type="checkbox"> <strong>${index + 1}. ${escapeHtml(step.label)}</strong><span>${escapeHtml(step.detail)}</span></label>`
    ).join("")}</div>`;
  }

  return `<ol class="timeline">${steps.map(step =>
    `<li><strong>${escapeHtml(step.label)}</strong><p>${escapeHtml(step.detail)}</p></li>`
  ).join("")}</ol>`;
}

function renderMetrics(metrics: EvidenceBackedMetric[]): string {
  const max = Math.max(...metrics.map(metric => Math.abs(metric.value)), 1);
  return `<div class="chart">${metrics.map(metric => {
    const width = Math.max(3, Math.min(100, Math.round((Math.abs(metric.value) / max) * 100)));
    return `<div class="bar-row"><strong>${escapeHtml(metric.label)}</strong><div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div><span>${escapeHtml(formatNumber(metric.value))}${metric.unit ? ` ${escapeHtml(metric.unit)}` : ""}</span></div>`;
  }).join("")}</div>`;
}

function renderTable(rows: EvidenceBackedComparison[]): string {
  const columns = unique(rows.flatMap(row => Object.keys(row.values))).sort();
  return `<div class="table-wrap"><table><thead><tr><th>Élément</th>${columns.map(column =>
    `<th>${escapeHtml(column)}</th>`
  ).join("")}</tr></thead><tbody>${rows.map(row =>
    `<tr><th>${escapeHtml(row.label)}</th>${columns.map(column => {
      const value = row.values[column];
      return `<td>${value === undefined ? "—" : escapeHtml(String(value))}</td>`;
    }).join("")}</tr>`
  ).join("")}</tbody></table></div>`;
}

function renderQuestions(questions: EvidenceBackedQuestion[]): string {
  return `<div class="quiz">${questions.map((question, qIndex) =>
    `<fieldset><legend>${qIndex + 1}. ${escapeHtml(question.prompt)}</legend>${question.options.map((option, index) =>
      `<label><input type="radio" name="q${qIndex}" value="${index}"> ${escapeHtml(option)}</label>`
    ).join("")}</fieldset>`
  ).join("")}</div>`;
}

function renderForm(fields: RepresentationFormField[]): string {
  return `<form class="local-form" onsubmit="return false">${fields.map(field => {
    if (field.type === "checkbox") {
      return `<label><input type="checkbox" id="${escapeHtml(field.id)}"${field.required ? " required" : ""}> ${escapeHtml(field.label)}</label>`;
    }
    return `<label>${escapeHtml(field.label)}<input type="${field.type}" id="${escapeHtml(field.id)}"${field.required ? " required" : ""}></label>`;
  }).join("")}<p class="boundary">Démonstrateur local : aucune soumission réseau.</p></form>`;
}

function renderInteractive(model: BoundedInteractiveModel): string {
  const operation = model.operation;
  return `<section class="interactive" data-operation="${operation}">
    <div class="controls">${model.variables.map(variable =>
      `<label>${escapeHtml(variable.label)} <output id="out-${variable.id}">${escapeHtml(formatNumber(variable.initial))}${variable.unit ? escapeHtml(variable.unit) : ""}</output><input class="model-variable" id="${variable.id}" data-unit="${escapeHtml(variable.unit ?? "")}" type="range" min="${variable.min}" max="${variable.max}" step="${variable.step}" value="${variable.initial}"></label>`
    ).join("")}</div>
    <div class="result"><span>${escapeHtml(model.outputLabel)}</span><strong id="model-result"></strong><span>${escapeHtml(model.outputUnit ?? "")}</span></div>
  </section>
  <script>
  (function(){
    const root=document.querySelector(".interactive");
    if(!root)return;
    const vars=[...root.querySelectorAll(".model-variable")];
    const operation=root.dataset.operation;
    function compute(values){
      if(operation==="min")return Math.min(...values);
      if(operation==="max")return Math.max(...values);
      if(operation==="sum")return values.reduce((a,b)=>a+b,0);
      if(operation==="average")return values.reduce((a,b)=>a+b,0)/values.length;
      return 0;
    }
    function update(){
      const values=vars.map(input=>{
        const value=Number(input.value);
        const output=document.getElementById("out-"+input.id);
        if(output)output.textContent=String(Math.round(value*100)/100)+(input.dataset.unit||"");
        return value;
      });
      const result=document.getElementById("model-result");
      if(result)result.textContent=String(Math.round(compute(values)*100)/100);
    }
    vars.forEach(input=>input.addEventListener("input",update));
    update();
  })();
  </script>`;
}

function renderBody(kind: RepresentationKind, content: RepresentationContentModel): string {
  const cards = content.cards ?? [];
  const steps = content.steps ?? [];
  const metrics = content.metrics ?? [];

  switch (kind) {
    case "timeline":
      return renderSteps(steps);
    case "sticky_board":
      return renderSteps(steps, true);
    case "chart":
      return renderMetrics(metrics);
    case "table":
      return renderTable(content.comparisons ?? []);
    case "diagram":
      return `<div class="diagram">${(cards.length ? cards : steps.map(step => ({
        title: step.label,
        body: step.detail,
        evidenceRefs: step.evidenceRefs
      }))).map((card, index, all) =>
        `<div class="diagram-node"><strong>${escapeHtml(card.title)}</strong><span>${escapeHtml(card.body)}</span></div>${index < all.length - 1 ? '<span class="arrow">→</span>' : ""}`
      ).join("")}</div>`;
    case "simulation":
    case "calculator":
      return renderInteractive(content.interactiveModel!);
    case "infographic":
      return `${cards.length ? renderCards(cards) : ""}${metrics.length ? renderMetrics(metrics) : ""}${steps.length ? renderSteps(steps) : ""}`;
    case "handwritten_note":
      return `<div class="handwritten"><h2>${escapeHtml(content.title)}</h2><p>${escapeHtml(content.summary)}</p>${cards.map(card => `<p><strong>${escapeHtml(card.title)} :</strong> ${escapeHtml(card.body)}</p>`).join("")}</div>`;
    case "flashcards":
      return `<div class="flashcards">${cards.map(card => `<article tabindex="0"><strong>${escapeHtml(card.title)}</strong><p>${escapeHtml(card.body)}</p></article>`).join("")}</div>`;
    case "quiz":
      return renderQuestions(content.questions ?? []);
    case "form":
      return renderForm(content.formFields ?? []);
    case "dashboard":
      return `<div class="dashboard">${metrics.length ? renderMetrics(metrics) : ""}${cards.length ? renderCards(cards) : ""}${steps.length ? renderSteps(steps, true) : ""}</div>`;
    case "text":
    default:
      return `<div class="text-content"><p>${escapeHtml(content.summary)}</p>${cards.length ? renderCards(cards) : ""}${steps.length ? renderSteps(steps) : ""}</div>`;
  }
}

function renderDocument(
  artifactId: string,
  kind: RepresentationKind,
  content: RepresentationContentModel,
  resolution: RepresentationResolution,
  language: string,
  degraded: boolean,
  degradation?: string,
  evidence: string[] = []
): string {
  const boundary = degraded
    ? `Compilation dégradée explicitement depuis ${resolution.primary.kind} : ${degradation ?? "renderer unavailable"}.`
    : `Format sélectionné par Representation Resolver : ${kind}.`;

  return `<!doctype html>
<html lang="${escapeHtml(language.slice(0, 24))}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:">
<title>${escapeHtml(content.title)}</title>
<style>
:root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#2d2117;background:#fff8ec}
*{box-sizing:border-box}body{margin:0;padding:14px}main{max-width:980px;margin:auto}
header{padding:20px;border-radius:22px;background:linear-gradient(135deg,#f4a261,#e76f51)}
h1{margin:.2rem 0;font-size:clamp(1.55rem,5vw,2.6rem)}p{line-height:1.5}
.meta{font-size:.82rem;background:#fff8;padding:6px 9px;border-radius:99px;display:inline-block}
.boundary{padding:10px 12px;background:#fff1c8;border-left:4px solid #e9c46a;border-radius:10px}
.cards,.steps,.flashcards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:14px 0}
.card,.step-card,.flashcards article{display:block;padding:14px;border:1px solid #ead5b8;border-radius:16px;background:#fff}
.step-card span{display:block;margin-top:6px;font-weight:400}.timeline{display:grid;gap:10px}.timeline li{padding:10px 12px;background:#fff;border:1px solid #ead5b8;border-radius:14px}
.chart{display:grid;gap:10px}.bar-row{display:grid;grid-template-columns:minmax(90px,1fr) 3fr minmax(60px,auto);gap:8px;align-items:center}.bar-track{height:20px;background:#eee1ce;border-radius:99px;overflow:hidden}.bar-fill{height:100%;background:#588157}
.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;background:#fff}th,td{padding:9px;border:1px solid #e2cfb4;text-align:left}
.diagram{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center}.diagram-node{max-width:220px;padding:13px;border:1px solid #d8c1a3;border-radius:16px;background:#fff}.diagram-node span{display:block;margin-top:6px}.arrow{font-weight:900}
.handwritten{background:repeating-linear-gradient(#fffdf6 0,#fffdf6 27px,#bdd4e7 28px);padding:26px;border-left:5px solid #ef476f;font-family:"Comic Sans MS","Bradley Hand",cursive;min-height:280px}
.controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.controls label{display:block;padding:12px;background:#fff;border:1px solid #ead5b8;border-radius:14px}.controls input{width:100%}.result{font-size:1.5rem;font-weight:800;margin:14px 0}
.quiz fieldset{margin:12px 0;border:1px solid #ead5b8;border-radius:14px}.quiz label,.local-form label{display:block;margin:8px 0}
.local-form input[type=text],.local-form input[type=number]{display:block;width:100%;max-width:520px;padding:9px}
.evidence{margin-top:18px;font-size:.8rem;color:#6f5c4c}.evidence code{overflow-wrap:anywhere}
footer{margin-top:18px;font-size:.82rem;color:#6f5c4c}
@media(max-width:560px){.bar-row{grid-template-columns:85px 1fr 55px}}
</style>
</head>
<body>
<main data-artifact-id="${artifactId}" data-compiler-profile="${GENESIS_REPRESENTATION_COMPILER_PROFILE.profileId}" data-representation-kind="${kind}" data-truth-state="COMPILED_ARTIFACT_ONLY">
<header><span class="meta">${GENESIS_REPRESENTATION_COMPILER_PROFILE.profileId} · ${kind}</span><h1>${escapeHtml(content.title)}</h1><p>${escapeHtml(content.summary)}</p></header>
<p class="boundary">${escapeHtml(boundary)} Artifact compilé ≠ preuve d'efficacité.</p>
${renderBody(kind, content)}
<section class="evidence"><strong>Evidence lineage</strong><p>${evidence.map(ref => `<code>${escapeHtml(ref)}</code>`).join(" · ")}</p></section>
<footer>V4-DEC-042 · ${artifactId} · COMPILED_ARTIFACT_ONLY · NOT_MEASURED</footer>
</main>
</body>
</html>`;
}

function canonicalContent(content: RepresentationContentModel): string {
  return stableStringify(content);
}

export function compileRepresentationArtifact(
  input: RepresentationArtifactCompileRequest
): CompiledRepresentationArtifact {
  validateCompileRequest(input);

  const resolution = resolveRepresentation(input.representationRequest);
  const evidence = collectEvidence(input);
  if (evidence.length === 0) throw new Error("REPRESENTATION_ARTIFACT_EVIDENCE_REQUIRED");

  const selection = chooseKind(resolution, input.content);
  const contentDigest = digest(canonicalContent(input.content));
  const artifactSeed = [
    GENESIS_REPRESENTATION_COMPILER_PROFILE.profileId,
    GENESIS_REPRESENTATION_COMPILER_PROFILE.version,
    resolution.telemetry.eventId,
    selection.selectedKind,
    contentDigest
  ].join("|");
  const artifactId = `repr-art-${digest(artifactSeed).slice(0, 16)}`;

  const html = renderDocument(
    artifactId,
    selection.selectedKind,
    input.content,
    resolution,
    input.representationRequest.constraints.language,
    selection.degraded,
    selection.degradationReason,
    evidence
  );
  if (Buffer.byteLength(html, "utf8") > MAX_ARTIFACT_BYTES) {
    throw new Error("REPRESENTATION_ARTIFACT_TOO_LARGE");
  }
  const artifactDigest = digest(html);

  const manifestBase = {
    artifactId,
    compilerProfileId: GENESIS_REPRESENTATION_COMPILER_PROFILE.profileId,
    compilerProfileVersion: GENESIS_REPRESENTATION_COMPILER_PROFILE.version,
    decisionId: GENESIS_REPRESENTATION_COMPILER_PROFILE.decisionId,
    outputManifestRef: GENESIS_REPRESENTATION_COMPILER_PROFILE.outputManifestRef,
    requestedPrimaryKind: resolution.primary.kind,
    selectedKind: selection.selectedKind,
    degraded: selection.degraded,
    ...(selection.degraded ? {
      degradedFrom: resolution.primary.kind,
      degradationReason: selection.degradationReason
    } : {}),
    representationEventId: resolution.telemetry.eventId,
    evidenceRefs: evidence,
    contentDigest,
    artifactDigest,
    truthState: "COMPILED_ARTIFACT_ONLY" as const,
    effectivenessClaim: "NOT_MEASURED" as const
  };

  const manifestDigest = digest(stableStringify(manifestBase));
  const manifest: RepresentationArtifactManifest = {
    ...manifestBase,
    manifestDigest
  };

  return {
    resolution,
    manifest,
    html
  };
}
