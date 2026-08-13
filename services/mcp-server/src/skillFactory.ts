import { z } from "zod";

export const GENESIS_V4_SKILL_FACTORY_ANCHOR = "GEN-V4-SKILL-FACTORY-002" as const;
export const SKILL_REUSE_THRESHOLD = 0.8 as const;

export type SkillLevel = "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
export type SkillStatus = "draft_ready" | "alert_ready" | "m8_required" | "blocked";
export type GateStatus = "pass" | "conditional" | "fail";
export type RiskDomain =
  | "security"
  | "legal"
  | "payment"
  | "production"
  | "doctrine"
  | "pii"
  | "external_write"
  | "deployment"
  | "rollback"
  | "public_claim";

const SkillLevelSchema = z.enum(["L0", "L1", "L2", "L3", "L4", "L5"]);
const RiskDomainSchema = z.enum([
  "security",
  "legal",
  "payment",
  "production",
  "doctrine",
  "pii",
  "external_write",
  "deployment",
  "rollback",
  "public_claim"
]);

const ContextLayerSchema = z.object({
  status: z.enum(["covered", "partial", "not_applicable"]),
  evidenceRefs: z.array(z.string().min(1)).default([])
});

export const Stratex99ContextSchema = z.object({
  languageSemantic: ContextLayerSchema,
  regulatoryLegal: ContextLayerSchema,
  institutional: ContextLayerSchema,
  economicFinancialPayment: ContextLayerSchema,
  culturalHumanAdoption: ContextLayerSchema,
  infrastructureResilience: ContextLayerSchema,
  marketBusinessRevenue: ContextLayerSchema,
  technologyDataAgenticAI: ContextLayerSchema,
  governanceSovereigntyAssurance: ContextLayerSchema
});

export type Stratex99Context = z.infer<typeof Stratex99ContextSchema>;

const Stratex9QualificationSchema = z.object({
  status: z.enum(["go", "conditional", "no_go"]),
  evidenceRefs: z.array(z.string().min(1)).default([])
});

const SkillFactoryInputSchema = z.object({
  id: z.string().min(3),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  level: SkillLevelSchema,
  domain: z.string().min(3),
  problem: z.string().min(8),
  triggers: z.array(z.string().min(1)).min(1),
  inputs: z.array(z.string().min(1)).min(1),
  outputs: z.array(z.string().min(1)).min(1),
  dependencies: z.array(z.string().min(1)).default([]),
  connectors: z.array(z.string().min(1)).default([]),
  permissions: z.array(z.string().min(1)).min(1),
  procedure: z.array(z.string().min(1)).min(1),
  verification: z.array(z.string().min(1)).min(1),
  remeEvidence: z.array(z.string().min(1)).min(1),
  metrics: z.array(z.string().min(1)).min(1),
  rollback: z.string().min(8),
  languages: z.array(z.string().min(1)).min(1),
  regions: z.array(z.string().min(1)).default([]),
  countries: z.array(z.string().min(2)).default([]),
  institutions: z.array(z.string().min(1)).default([]),
  riskDomains: z.array(RiskDomainSchema).default([]),
  warnings: z.array(z.string().min(1)).default([]),
  context: Stratex99ContextSchema.optional(),
  stratex9: Stratex9QualificationSchema.optional(),
  configurableMetadata: z.record(z.unknown()).default({}),
  universalInvariants: z.record(z.unknown()).default({}),
  outcomeEvidencePresent: z.boolean().default(false),
  localRulesSeparated: z.boolean().default(false),
  permissionsBounded: z.boolean().default(false),
  doubleReviewPassed: z.boolean().default(false),
  secondContextTestPassed: z.boolean().default(false),
  hardcodedNationalRule: z.boolean().default(false),
  m8Approval: z.boolean().default(false)
});

export type SkillFactoryInput = z.input<typeof SkillFactoryInputSchema>;
export type ParsedSkillFactoryInput = z.output<typeof SkillFactoryInputSchema>;

export interface SkillGates {
  m6: GateStatus;
  s7plus: GateStatus;
  m8: GateStatus;
}

export interface CompiledSkill extends ParsedSkillFactoryInput {
  anchor: typeof GENESIS_V4_SKILL_FACTORY_ANCHOR;
  status: SkillStatus;
  gates: SkillGates;
  blockers: string[];
  alerts: string[];
  doubleReviewRequired: boolean;
  m8ApprovalRequired: boolean;
}

export type SkillRecord = CompiledSkill;

export interface SkillRequest {
  level: SkillLevel;
  domain: string;
  problem: string;
  triggers: string[];
  inputs: string[];
  outputs: string[];
  dependencies: string[];
  connectors: string[];
  permissions: string[];
  regions?: string[];
  countries?: string[];
  institutions?: string[];
}

export interface PromotionInput {
  fromLevel: SkillLevel;
  toLevel: SkillLevel;
  outcomeEvidencePresent: boolean;
  localRulesSeparated: boolean;
  permissionsBounded: boolean;
  doubleReviewPassed: boolean;
  rollbackPresent: boolean;
  secondContextTestPassed: boolean;
  hardcodedNationalRule: boolean;
}

export interface PromotionDecision {
  allowed: boolean;
  blockers: string[];
}

const TERRITORIAL_LEVELS = new Set<SkillLevel>(["L2", "L3", "L4", "L5"]);
const CRITICAL_CONTEXT_LAYERS: Array<keyof Stratex99Context> = [
  "regulatoryLegal",
  "infrastructureResilience",
  "governanceSovereigntyAssurance"
];
const SENSITIVE_RISK_DOMAINS = new Set<RiskDomain>([
  "security",
  "legal",
  "payment",
  "production",
  "doctrine",
  "pii",
  "external_write",
  "deployment",
  "rollback",
  "public_claim"
]);

const DESTRUCTIVE_PATTERNS: RegExp[] = [
  /\brm\s+-rf\b/i,
  /curl\b[^\n|]*\|\s*(?:bash|sh)\b/i,
  /\bsudo\b/i,
  /\bchmod\s+777\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*[^\s]+/i,
  /"(?:api[_-]?key|access[_-]?token|secret|password)"\s*:\s*"[^"\n]+"/i
];

function parseSkillInput(input: unknown): ParsedSkillFactoryInput {
  const parsed = SkillFactoryInputSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(issue => `${issue.path.join(".")}:${issue.message}`).join(";");
    throw new Error(`SKILL_DNA_INVALID:${issues}`);
  }
  return parsed.data;
}

function hasDestructiveContent(input: ParsedSkillFactoryInput): boolean {
  const text = JSON.stringify(input);
  return DESTRUCTIVE_PATTERNS.some(pattern => pattern.test(text));
}

export function compileSkill(input: unknown): CompiledSkill {
  const skill = parseSkillInput(input);
  const blockers: string[] = [];
  const alerts: string[] = [...skill.warnings];

  if (TERRITORIAL_LEVELS.has(skill.level)) {
    if (!skill.context) {
      blockers.push("STRATEX99_CONTEXT_REQUIRED");
    } else {
      for (const layer of CRITICAL_CONTEXT_LAYERS) {
        if (skill.context[layer].status === "partial") {
          blockers.push(`STRATEX99_CRITICAL_CONTEXT_INCOMPLETE:${layer}`);
        }
      }
      for (const [layer, value] of Object.entries(skill.context)) {
        if (value.status === "partial" && !CRITICAL_CONTEXT_LAYERS.includes(layer as keyof Stratex99Context)) {
          alerts.push(`STRATEX99_CONTEXT_PARTIAL:${layer}`);
        }
      }
    }

    if (!skill.stratex9) {
      blockers.push("STRATEX9_QUALIFICATION_REQUIRED");
    } else if (skill.stratex9.status === "no_go") {
      blockers.push("STRATEX9_NO_GO");
    } else if (skill.stratex9.status === "conditional") {
      alerts.push("STRATEX9_CONDITIONAL");
    }
  }

  const destructive = hasDestructiveContent(skill);
  if (destructive) {
    blockers.push("S7_DESTRUCTIVE_CONTENT");
  }

  const sensitive = skill.riskDomains.some(domain => SENSITIVE_RISK_DOMAINS.has(domain));
  const m8ApprovalRequired = sensitive && !skill.m8Approval;

  const s7plus: GateStatus = destructive ? "fail" : "pass";
  const m8: GateStatus = m8ApprovalRequired ? "conditional" : "pass";
  const nonS7Blocker = blockers.some(blocker => blocker !== "S7_DESTRUCTIVE_CONTENT");
  const m6: GateStatus = nonS7Blocker ? "fail" : alerts.length > 0 ? "conditional" : "pass";

  let status: SkillStatus;
  if (blockers.length > 0) {
    status = "blocked";
  } else if (m8ApprovalRequired) {
    status = "m8_required";
  } else if (alerts.length > 0) {
    status = "alert_ready";
  } else {
    status = "draft_ready";
  }

  return {
    ...skill,
    anchor: GENESIS_V4_SKILL_FACTORY_ANCHOR,
    status,
    gates: { m6, s7plus, m8 },
    blockers,
    alerts,
    doubleReviewRequired: sensitive || status === "alert_ready" || status === "m8_required",
    m8ApprovalRequired
  };
}

function normalizedTokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9à-ÿ_]+/gi, " ")
      .split(/\s+/)
      .map(token => token.trim())
      .filter(Boolean)
  );
}

function setSimilarity(left: Iterable<string>, right: Iterable<string>): number {
  const a = new Set(Array.from(left, value => value.toLowerCase()));
  const b = new Set(Array.from(right, value => value.toLowerCase()));
  if (a.size === 0 && b.size === 0) return 1;
  const union = new Set([...a, ...b]);
  let intersection = 0;
  for (const value of a) {
    if (b.has(value)) intersection += 1;
  }
  return union.size === 0 ? 0 : intersection / union.size;
}

function textSimilarity(left: string, right: string): number {
  return setSimilarity(normalizedTokens(left), normalizedTokens(right));
}

function geographySimilarity(request: SkillRequest, candidate: SkillRecord): number {
  const requested = [
    ...(request.regions ?? []),
    ...(request.countries ?? []),
    ...(request.institutions ?? [])
  ];
  const available = [
    ...(candidate.regions ?? []),
    ...(candidate.countries ?? []),
    ...(candidate.institutions ?? [])
  ];
  if (requested.length === 0) return 1;
  if (candidate.level === "L0" || candidate.level === "L1") return 1;
  return setSimilarity(requested, available);
}

export function scoreSkillCompatibility(request: SkillRequest, candidate: SkillRecord): number {
  const domain = request.domain.toLowerCase() === candidate.domain.toLowerCase() ? 1 : 0;
  const problem = textSimilarity(request.problem, candidate.problem);
  const triggers = setSimilarity(request.triggers, candidate.triggers ?? []);
  const io = setSimilarity(
    [...request.inputs, ...request.outputs],
    [...(candidate.inputs ?? []), ...(candidate.outputs ?? [])]
  );
  const level = request.level === candidate.level ? 1 : 0.5;
  const geography = geographySimilarity(request, candidate);
  const dependencies = setSimilarity(
    [...request.dependencies, ...request.connectors],
    [...(candidate.dependencies ?? []), ...(candidate.connectors ?? [])]
  );
  const permissions = setSimilarity(request.permissions, candidate.permissions ?? []);

  const score =
    domain * 0.25 +
    ((problem + triggers) / 2) * 0.2 +
    io * 0.15 +
    level * 0.1 +
    geography * 0.1 +
    dependencies * 0.1 +
    permissions * 0.1;

  return Math.round(Math.min(1, Math.max(0, score)) * 100) / 100;
}

const LEVEL_ORDER: Record<SkillLevel, number> = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
  L5: 5
};

export function evaluatePromotion(input: PromotionInput): PromotionDecision {
  const blockers: string[] = [];

  if (!input.outcomeEvidencePresent) blockers.push("OUTCOME_EVIDENCE_REQUIRED");
  if (!input.localRulesSeparated) blockers.push("LOCAL_RULES_MUST_BE_SEPARATED");
  if (!input.permissionsBounded) blockers.push("PERMISSIONS_MUST_BE_BOUNDED");
  if (!input.doubleReviewPassed) blockers.push("DOUBLE_REVIEW_REQUIRED");
  if (!input.rollbackPresent) blockers.push("ROLLBACK_REQUIRED");

  const broaderPromotion = LEVEL_ORDER[input.toLevel] < LEVEL_ORDER[input.fromLevel];
  if (broaderPromotion && LEVEL_ORDER[input.toLevel] <= LEVEL_ORDER.L2 && !input.secondContextTestPassed) {
    blockers.push("SECOND_CONTEXT_TEST_REQUIRED");
  }

  if (input.hardcodedNationalRule && (input.toLevel === "L0" || input.toLevel === "L1")) {
    blockers.push("HARDCODED_NATIONAL_RULE_FORBIDDEN");
  }

  return { allowed: blockers.length === 0, blockers };
}
