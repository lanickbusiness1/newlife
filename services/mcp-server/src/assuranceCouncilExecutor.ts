import { randomUUID } from "node:crypto";
import {
  compileAssuranceReport,
  compileIndependentAssurance,
  type AssuranceAuditorRole,
  type AssuranceFinding,
  type AssuranceReport,
  type AssuranceReportVerdict,
  type AssuranceSpecialistRole,
  type IndependentAssuranceEvidence
} from "./independentAssurance.js";

const BASE_SPECIALIST_ROLES = [
  "ARCHITECTURE_RUNTIME_AUDITOR",
  "SECURITY_SUPPLY_CHAIN_AUDITOR",
  "SOVEREIGNTY_COMPLIANCE_AUDITOR",
  "ECONOMICS_FINOPS_AUDITOR"
] as const satisfies readonly AssuranceSpecialistRole[];

const RED_TEAM_ROLE: AssuranceSpecialistRole = "ADVERSARIAL_RED_TEAM_AUDITOR";
const ARBITER_ROLE: AssuranceAuditorRole = "ASSURANCE_ARBITER";

export type CouncilEvidenceByRole = Partial<Record<AssuranceSpecialistRole, readonly string[]>>;

export interface CouncilInferenceRequest {
  role: AssuranceAuditorRole;
  auditorId: string;
  executionContextId: string;
  snapshotSha: string;
  evidence: readonly string[];
  sealedPriorReports: readonly AssuranceReport[];
}

export interface CouncilModelClient {
  complete(request: CouncilInferenceRequest): Promise<string>;
}

export interface RunIndependentAssuranceCouncilInput {
  snapshotSha: string;
  builderAgentIds: string[];
  externalMandate: boolean;
  evidenceByRole: CouncilEvidenceByRole;
  generatedAt: string;
  evidenceRef: string;
}

export interface RunIndependentAssuranceCouncilResult {
  evidence: IndependentAssuranceEvidence;
  reports: AssuranceReport[];
}

interface ModelReportPayload {
  verdict: AssuranceReportVerdict;
  findings: AssuranceFinding[];
  evidenceRefs: string[];
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`ASSURANCE_COUNCIL_EXECUTOR_INVALID: ${name} is required`);
  }
  return value.trim();
}

function parseModelPayload(raw: string): ModelReportPayload {
  const text = requiredString(raw, "model response");
  const unfenced = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(unfenced);
  } catch {
    throw new Error("ASSURANCE_COUNCIL_MODEL_JSON_INVALID: model response must be one JSON object");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("ASSURANCE_COUNCIL_MODEL_JSON_INVALID: model response must be an object");
  }
  const payload = parsed as Record<string, unknown>;
  if (!new Set(["PASS", "HOLD", "BLOCK"]).has(payload.verdict as string)) {
    throw new Error("ASSURANCE_COUNCIL_MODEL_INVALID: verdict must be PASS, HOLD or BLOCK");
  }
  if (!Array.isArray(payload.findings)) {
    throw new Error("ASSURANCE_COUNCIL_MODEL_INVALID: findings must be an array");
  }
  if (!Array.isArray(payload.evidenceRefs) || payload.evidenceRefs.length === 0) {
    throw new Error("ASSURANCE_COUNCIL_MODEL_INVALID: evidenceRefs must not be empty");
  }

  return {
    verdict: payload.verdict as AssuranceReportVerdict,
    findings: payload.findings as AssuranceFinding[],
    evidenceRefs: payload.evidenceRefs.map((ref, index) => requiredString(ref, `evidenceRefs[${index}]`))
  };
}

function identityFor(role: AssuranceAuditorRole): { auditorId: string; executionContextId: string } {
  return {
    auditorId: `agent:iac:${role.toLowerCase()}:${randomUUID()}`,
    executionContextId: `ctx:iac:${randomUUID()}`
  };
}

async function executeReport(
  role: AssuranceAuditorRole,
  input: RunIndependentAssuranceCouncilInput,
  client: CouncilModelClient,
  sealedPriorReports: readonly AssuranceReport[]
): Promise<AssuranceReport> {
  const identity = identityFor(role);
  const evidence = role === ARBITER_ROLE
    ? []
    : [...(input.evidenceByRole[role as AssuranceSpecialistRole] ?? [])];
  const request: CouncilInferenceRequest = {
    role,
    ...identity,
    snapshotSha: input.snapshotSha,
    evidence,
    sealedPriorReports: [...sealedPriorReports]
  };
  const payload = parseModelPayload(await client.complete(request));
  return compileAssuranceReport({
    auditorRole: role,
    auditorId: identity.auditorId,
    executionContextId: identity.executionContextId,
    snapshotSha: input.snapshotSha,
    findings: payload.findings,
    verdict: payload.verdict,
    evidenceRefs: payload.evidenceRefs,
    generatedAt: input.generatedAt
  });
}

export async function runIndependentAssuranceCouncil(
  input: RunIndependentAssuranceCouncilInput,
  client: CouncilModelClient
): Promise<RunIndependentAssuranceCouncilResult> {
  requiredString(input?.snapshotSha, "snapshotSha");
  requiredString(input?.generatedAt, "generatedAt");
  requiredString(input?.evidenceRef, "evidenceRef");
  if (!Array.isArray(input?.builderAgentIds) || input.builderAgentIds.length === 0) {
    throw new Error("ASSURANCE_COUNCIL_EXECUTOR_INVALID: builderAgentIds are required");
  }
  if (typeof input?.externalMandate !== "boolean") {
    throw new Error("ASSURANCE_COUNCIL_EXECUTOR_INVALID: externalMandate must be boolean");
  }
  if (!client || typeof client.complete !== "function") {
    throw new Error("ASSURANCE_COUNCIL_EXECUTOR_INVALID: model client is required");
  }

  // These four calls deliberately receive no peer report or shared conversational history.
  const baseReports: AssuranceReport[] = [];
  for (const role of BASE_SPECIALIST_ROLES) {
    baseReports.push(await executeReport(role, input, client, []));
  }

  // Red Team is allowed to challenge only sealed specialist reports.
  const redTeamReport = await executeReport(RED_TEAM_ROLE, input, client, baseReports);
  const specialistReports = [...baseReports, redTeamReport];

  // Arbiter is last and sees the five sealed specialist reports, never builder context/history.
  const arbiterReport = await executeReport(ARBITER_ROLE, input, client, specialistReports);
  const evidence = compileIndependentAssurance({
    snapshotSha: input.snapshotSha,
    specialistReports,
    arbiterReport,
    builderAgentIds: input.builderAgentIds,
    externalMandate: input.externalMandate,
    evidenceRef: input.evidenceRef,
    generatedAt: input.generatedAt
  });

  return { evidence, reports: [...specialistReports, arbiterReport] };
}

export interface OpenAICompatibleCouncilClientOptions {
  baseUrl: string;
  model: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

function roleInstruction(role: AssuranceAuditorRole): string {
  const focus: Record<AssuranceAuditorRole, string> = {
    ARCHITECTURE_RUNTIME_AUDITOR: "architecture, runtime contracts, state transitions, fail-closed controls, rollback and integration correctness",
    SECURITY_SUPPLY_CHAIN_AUDITOR: "security boundaries, dependency/supply-chain risk, secrets, permissions, malformed-input and evidence-spoofing attacks",
    SOVEREIGNTY_COMPLIANCE_AUDITOR: "data classification, localization, sovereignty, privacy/compliance boundaries and external-mandate triggers",
    ECONOMICS_FINOPS_AUDITOR: "compute economics, cost routing, quality/SLA thresholds, lock-in, energy, margin and Qualified Least Cost policy",
    ADVERSARIAL_RED_TEAM_AUDITOR: "challenge the four sealed specialist reports, search for bypasses, contradictions, false confidence and missing attack paths",
    ASSURANCE_ARBITER: "adjudicate the five sealed reports without inventing evidence; preserve every unresolved P0/P1 and issue the strictest justified verdict"
  };
  return focus[role];
}

function buildMessages(request: CouncilInferenceRequest) {
  const system = [
    `You are the AfrIAgenesis Independent Assurance Council role ${request.role}.`,
    `Your independent execution identity is ${request.auditorId}; context ${request.executionContextId}.`,
    `Audit only snapshot ${request.snapshotSha}.`,
    `Focus on ${roleInstruction(request.role)}.`,
    "Return ONLY JSON with keys verdict, findings, evidenceRefs.",
    "verdict must be PASS, HOLD, or BLOCK.",
    "findings is an array of {id,severity,title,status,evidenceRefs}; severity P0/P1/P2 and status OPEN/RESOLVED.",
    "P0 means critical release blocker; P1 means material blocker; P2 is non-blocking hardening.",
    "Never convert missing evidence into PASS. Never claim facts absent from supplied evidence."
  ].join("\n");

  const user = JSON.stringify({
    snapshotSha: request.snapshotSha,
    roleEvidence: request.evidence,
    sealedPriorReports: request.sealedPriorReports
  });
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export class OpenAICompatibleCouncilClient implements CouncilModelClient {
  constructor(private readonly options: OpenAICompatibleCouncilClientOptions) {
    requiredString(options?.baseUrl, "baseUrl");
    requiredString(options?.model, "model");
  }

  async complete(request: CouncilInferenceRequest): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 180_000);
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (this.options.apiKey) headers.authorization = `Bearer ${this.options.apiKey}`;
      const response = await fetch(`${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: this.options.model,
          messages: buildMessages(request),
          temperature: this.options.temperature ?? 0,
          max_tokens: this.options.maxTokens ?? 1400,
          response_format: { type: "json_object" }
        })
      });
      if (!response.ok) {
        throw new Error(`ASSURANCE_COUNCIL_MODEL_HTTP_${response.status}`);
      }
      const body = await response.json() as any;
      const content = body?.choices?.[0]?.message?.content;
      return requiredString(content, "chat completion content");
    } finally {
      clearTimeout(timeout);
    }
  }
}
