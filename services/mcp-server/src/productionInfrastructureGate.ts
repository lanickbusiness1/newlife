export const GENESIS_V4_PRODUCTION_INFRASTRUCTURE_GATE_ANCHOR = {
  genome: "GENESIS_V4",
  assetId: "INF-DEPLOYBOT-001",
  policyId: "PIG-001",
  doctrine: "Build → Production Infrastructure Gate™ → M6",
  threshold: 85,
  invariant:
    "A release candidate cannot enter M6 unless its Production Readiness Score is at least 85/100 and every critical Security, Identity/Auth, Availability and Recovery control is proven."
} as const;

export type ProductionDomain =
  | "frontend_performance"
  | "backend_api"
  | "data_storage"
  | "identity_permissions"
  | "security"
  | "infrastructure_scaling"
  | "observability"
  | "availability_recovery"
  | "cicd_release"
  | "finops_isolation";

interface ProductionControlPolicy {
  domain: ProductionDomain;
  weight: number;
  critical: boolean;
}

export const PRODUCTION_CONTROL_POLICY = {
  frontend_build: { domain: "frontend_performance", weight: 3, critical: false },
  responsive_accessibility: { domain: "frontend_performance", weight: 3, critical: false },
  performance_budget: { domain: "frontend_performance", weight: 4, critical: false },

  api_contract_tests: { domain: "backend_api", weight: 3, critical: false },
  timeout_idempotency: { domain: "backend_api", weight: 2, critical: false },
  versioning_health: { domain: "backend_api", weight: 3, critical: false },
  backend_build: { domain: "backend_api", weight: 2, critical: false },

  migrations_versioned: { domain: "data_storage", weight: 2, critical: false },
  indexes_integrity: { domain: "data_storage", weight: 2, critical: false },
  rls_enforced: { domain: "data_storage", weight: 3, critical: true },
  storage_policy: { domain: "data_storage", weight: 3, critical: false },

  authentication: { domain: "identity_permissions", weight: 4, critical: true },
  authorization_rbac_abac: { domain: "identity_permissions", weight: 3, critical: true },
  session_token_policy: { domain: "identity_permissions", weight: 3, critical: true },

  tls_https: { domain: "security", weight: 3, critical: true },
  secrets_management: { domain: "security", weight: 3, critical: true },
  dependency_security: { domain: "security", weight: 2, critical: true },
  security_headers: { domain: "security", weight: 2, critical: true },
  rate_limiting_abuse: { domain: "security", weight: 2, critical: true },
  waf_ddos: { domain: "security", weight: 1, critical: true },
  sbom_supply_chain: { domain: "security", weight: 2, critical: true },

  compute_declared: { domain: "infrastructure_scaling", weight: 2, critical: false },
  caching_cdn: { domain: "infrastructure_scaling", weight: 2, critical: false },
  load_balancing_autoscaling: { domain: "infrastructure_scaling", weight: 2, critical: false },
  health_checks: { domain: "infrastructure_scaling", weight: 2, critical: true },
  infrastructure_as_code: { domain: "infrastructure_scaling", weight: 2, critical: false },

  structured_logs: { domain: "observability", weight: 2, critical: false },
  error_tracking: { domain: "observability", weight: 2, critical: false },
  metrics_tracing: { domain: "observability", weight: 2, critical: false },
  alerting: { domain: "observability", weight: 2, critical: false },
  audit_trail: { domain: "observability", weight: 2, critical: false },

  backup_configured: { domain: "availability_recovery", weight: 2, critical: true },
  restore_test: { domain: "availability_recovery", weight: 3, critical: true },
  rollback_test: { domain: "availability_recovery", weight: 2, critical: true },
  dr_rpo_rto: { domain: "availability_recovery", weight: 2, critical: true },
  availability_slo: { domain: "availability_recovery", weight: 1, critical: true },

  version_control: { domain: "cicd_release", weight: 2, critical: false },
  ci_tests: { domain: "cicd_release", weight: 3, critical: false },
  artifact_provenance: { domain: "cicd_release", weight: 2, critical: false },
  release_evidence: { domain: "cicd_release", weight: 3, critical: false },

  cost_budget_guard: { domain: "finops_isolation", weight: 2, critical: false },
  tenant_isolation: { domain: "finops_isolation", weight: 3, critical: true }
} as const satisfies Record<string, ProductionControlPolicy>;

export type ProductionControlId = keyof typeof PRODUCTION_CONTROL_POLICY;

export const PRODUCTION_CONTROL_IDS = Object.keys(PRODUCTION_CONTROL_POLICY) as ProductionControlId[];

export type ProductionControlStatus = "pass" | "fail" | "not_applicable";

export interface ProductionControlEvidence {
  status: ProductionControlStatus;
  evidenceRefs: string[];
  note?: string;
}

export interface ProductionInfrastructureGateInput {
  assetId: string;
  releaseId: string;
  environment: "development" | "preproduction" | "production";
  multiTenant: boolean;
  controls: Partial<Record<ProductionControlId, ProductionControlEvidence>>;
}

export type ProductionInfrastructureDecision =
  | "PASS_TO_M6"
  | "BLOCK_SCORE"
  | "BLOCK_CRITICAL";

export interface ProductionDomainScore {
  earned: number;
  total: number;
}

export interface ProductionInfrastructureGateResult {
  anchor: typeof GENESIS_V4_PRODUCTION_INFRASTRUCTURE_GATE_ANCHOR;
  assetId: string;
  releaseId: string;
  environment: ProductionInfrastructureGateInput["environment"];
  score: number;
  threshold: number;
  decision: ProductionInfrastructureDecision;
  nextGate: "M6" | null;
  criticalFailures: ProductionControlId[];
  blockers: string[];
  exemptions: string[];
  domainScores: Record<ProductionDomain, ProductionDomainScore>;
  evaluatedControls: number;
  requiredControls: number;
  evidenceContract: string[];
}

const DOMAINS: ProductionDomain[] = [
  "frontend_performance",
  "backend_api",
  "data_storage",
  "identity_permissions",
  "security",
  "infrastructure_scaling",
  "observability",
  "availability_recovery",
  "cicd_release",
  "finops_isolation"
];

const EVIDENCE_CONTRACT = [
  "asset_id",
  "release_id",
  "environment",
  "control_id",
  "control_status",
  "evidence_refs",
  "production_readiness_score",
  "critical_failures",
  "gate_decision",
  "evaluated_at"
];

const PRODUCTION_ENVIRONMENTS = new Set<ProductionInfrastructureGateInput["environment"]>([
  "development",
  "preproduction",
  "production"
]);

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertProductionInfrastructureGateInput(
  input: unknown
): asserts input is ProductionInfrastructureGateInput {
  if (!isRecord(input)) {
    throw new Error("GENESIS_V4_PIG_INVALID: payload must be an object");
  }

  if (!nonEmpty(input.assetId) || !nonEmpty(input.releaseId)) {
    throw new Error("GENESIS_V4_PIG_INVALID: assetId and releaseId are required");
  }

  if (typeof input.environment !== "string" || !PRODUCTION_ENVIRONMENTS.has(input.environment as ProductionInfrastructureGateInput["environment"])) {
    throw new Error("GENESIS_V4_PIG_INVALID: environment must be development, preproduction or production");
  }

  if (typeof input.multiTenant !== "boolean") {
    throw new Error("GENESIS_V4_PIG_INVALID: multiTenant must be boolean");
  }

  if (!isRecord(input.controls)) {
    throw new Error("GENESIS_V4_PIG_INVALID: controls must be an object");
  }
}

function hasEvidence(control: ProductionControlEvidence | undefined): boolean {
  return Boolean(
    control
      && control.status === "pass"
      && Array.isArray(control.evidenceRefs)
      && control.evidenceRefs.some(nonEmpty)
  );
}

function emptyDomainScores(): Record<ProductionDomain, ProductionDomainScore> {
  return Object.fromEntries(
    DOMAINS.map(domain => [domain, { earned: 0, total: 0 }])
  ) as Record<ProductionDomain, ProductionDomainScore>;
}

export function evaluateProductionInfrastructureGate(
  input: unknown
): ProductionInfrastructureGateResult {
  assertProductionInfrastructureGateInput(input);

  const domainScores = emptyDomainScores();
  const blockers: string[] = [];
  const exemptions: string[] = [];
  const criticalFailures: ProductionControlId[] = [];
  let score = 0;
  let evaluatedControls = 0;

  for (const id of PRODUCTION_CONTROL_IDS) {
    const policy = PRODUCTION_CONTROL_POLICY[id];
    const domain = domainScores[policy.domain];
    domain.total += policy.weight;

    if (id === "tenant_isolation" && input.multiTenant === false) {
      score += policy.weight;
      domain.earned += policy.weight;
      evaluatedControls += 1;
      exemptions.push("tenant_isolation:single_tenant");
      continue;
    }

    const control = input.controls[id];
    const proven = hasEvidence(control);

    if (proven) {
      score += policy.weight;
      domain.earned += policy.weight;
      evaluatedControls += 1;
      continue;
    }

    if (control) evaluatedControls += 1;

    if (!control) {
      blockers.push(`${id}:missing`);
    } else if (control.status === "not_applicable") {
      blockers.push(`${id}:not_applicable_not_authorized`);
    } else if (control.status === "pass") {
      blockers.push(`${id}:evidence_missing`);
    } else {
      blockers.push(`${id}:failed`);
    }

    if (policy.critical) criticalFailures.push(id);
  }

  const threshold = GENESIS_V4_PRODUCTION_INFRASTRUCTURE_GATE_ANCHOR.threshold;
  const decision: ProductionInfrastructureDecision = criticalFailures.length > 0
    ? "BLOCK_CRITICAL"
    : score < threshold
      ? "BLOCK_SCORE"
      : "PASS_TO_M6";

  return {
    anchor: GENESIS_V4_PRODUCTION_INFRASTRUCTURE_GATE_ANCHOR,
    assetId: input.assetId,
    releaseId: input.releaseId,
    environment: input.environment,
    score,
    threshold,
    decision,
    nextGate: decision === "PASS_TO_M6" ? "M6" : null,
    criticalFailures,
    blockers,
    exemptions,
    domainScores,
    evaluatedControls,
    requiredControls: PRODUCTION_CONTROL_IDS.length,
    evidenceContract: [...EVIDENCE_CONTRACT]
  };
}
