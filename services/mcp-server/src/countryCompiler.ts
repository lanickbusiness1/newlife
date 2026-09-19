export const GENESIS_V4_COUNTRY_COMPILER_ANCHOR = {
  genome: "GENESIS_V4",
  assetId: "GEN-V4-COUNTRY-COMPILER-001",
  version: "1.0.0",
  contractId: "GEN-V4-COUNTRY-GENOME-CONTRACT-001",
  contractVersion: "1.0.0",
  doctrine: "One Core, Many Country Genomes",
  proofProtocol: "Benin Proof Country -> Mali Portability Country",
  invariant:
    "Country differences must stay in Policy Packs, Connectors, configuration, schemas or dictionaries; no silent country fork of the CORE."
} as const;

export type CapabilityStatus = "available" | "partial" | "unavailable";
export type CapabilityDecision =
  | "REUSE_EXISTING"
  | "INTEGRATE"
  | "AUGMENT"
  | "REPLACE_BY_MANDATE_ONLY"
  | "NOT_NEEDED"
  | "BLOCKED_NEEDS_EVIDENCE";

export type CompileStatus = "READY_FOR_BLUEPRINT" | "NEEDS_EVIDENCE" | "BLOCKED";
export type PortabilityVerdict =
  | "PORTABILITY_FAIL"
  | "PORTABILITY_CONDITIONAL"
  | "REPRODUCTION_PROVEN_CANDIDATE";

export interface ExistingCapability {
  id: string;
  name: string;
  status: CapabilityStatus;
  evidence_ref: string;
}

export interface CapabilityGap {
  id: string;
  name: string;
  evidence_ref?: string;
}

export interface CountryGenome {
  contract_id: string;
  contract_version: string;
  genome_id: string;
  genome_version: string;
  country: {
    code_iso2: string;
    name: string;
    region: string;
    jurisdiction: string;
    timezone: string;
    currencies: string[];
    languages: {
      official: string[];
      local: string[];
      working: string[];
    };
  };
  authority: {
    sovereign_owner: string;
    competent_authorities: string[];
    mandates: string[];
  };
  truth: {
    max_truth_state: string;
    evidence_refs: string[];
    unresolved_claims: string[];
  };
  sovereignty: {
    data_residency_rules: string[];
    transfer_rules: string[];
    retention_rules: string[];
    consent_rules: string[];
    sovereignty_policy_refs: string[];
  };
  capabilities: {
    existing: ExistingCapability[];
    gaps: CapabilityGap[];
    reuse_decisions?: unknown[];
  };
  infrastructure: {
    compute: string[];
    cloud_onprem_hybrid: string[];
    connectivity: string[];
    energy_constraints: string[];
    offline_edge_constraints: string[];
  };
  identity: {
    authoritative_sources: string[];
    trust_frameworks: string[];
    approved_connectors: string[];
  };
  payments: {
    domestic_rails: string[];
    regional_rails: string[];
    public_payment_rails: string[];
    approved_connectors: string[];
  };
  legal_regulatory: {
    policy_packs: string[];
    sector_rules: string[];
    privacy_rules: string[];
    procurement_rules: string[];
    fiscal_rules: string[];
  };
  domains: {
    selected_domain_genomes: string[];
    selected_os_families: string[];
    required_skills: string[];
  };
  security: {
    criticality: string;
    permissions_model: string;
    secrets_policy: string;
    logging_policy: string;
    rollback_required: boolean;
    kill_switch_required: boolean;
  };
  business: {
    solvent_buyers: string[];
    essential_demands: string[];
    offers: string[];
    pricing_assumptions: string[];
    unit_economics_refs: string[];
  };
  deployment: {
    topology: string;
    country_connectors: string[];
    feature_flags: string[];
    rollback_target: string;
  };
  governance: {
    required_gates: string[];
    human_approvers: string[];
    review_cycle: string;
  };
  reme: {
    evidence_root: string;
    learning_return_path: string;
  };
}

export interface CountryCompileRequest {
  executionId: string;
  parentCoreRef: string;
  targetTruthState: string;
  countryGenome: CountryGenome;
  requestedCapabilities: string[];
  requestedCoreMutation?: boolean;
}

export interface CapabilityMatrixItem {
  capabilityId: string;
  name: string;
  decision: CapabilityDecision;
  evidenceRefs: string[];
  reason: string;
}

export interface CountryCompileResult {
  status: CompileStatus;
  executionId: string;
  country: string;
  coreRef: string;
  compilerRef: string;
  targetTruthState: string;
  capabilityMatrix: CapabilityMatrixItem[];
  generated: {
    capabilityMatrixRef: string;
    policyPackManifestRef: string;
    connectorManifestRef: string;
    domainSelectionRef: string;
    permissionsMatrixRef: string;
    dataResidencyPolicyRef: string;
    deploymentTopologyRef: string;
    countryTestPlanRef: string;
    evidencePackIndexRef: string;
    rollbackPlanRef: string;
    birthCertificateRef: string;
    compilerOutputManifestRef: string;
  };
  blockers: string[];
  warnings: string[];
  evidenceRefs: string[];
}

export interface CountryPortabilityAssessment {
  sourceCountry: string;
  targetCountry: string;
  sourceCoreRef: string;
  targetCoreRef: string;
  coreUnchanged: boolean;
  criticalRegressions: string[];
  verdict: PortabilityVerdict;
  evidenceRefs: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every(item => typeof item === "string" && item.trim().length > 0);
}

function addBlocker(blockers: string[], condition: boolean, code: string) {
  if (!condition) blockers.push(code);
}

function unique(values: string[]) {
  return [...new Set(values.filter(nonEmptyText))];
}

function validateCountryGenome(input: unknown): string[] {
  const blockers: string[] = [];
  if (!isRecord(input)) return ["COUNTRY_GENOME_REQUIRED"];

  addBlocker(blockers, input.contract_id === GENESIS_V4_COUNTRY_COMPILER_ANCHOR.contractId, "COUNTRY_GENOME_CONTRACT_ID_INVALID");
  addBlocker(blockers, input.contract_version === GENESIS_V4_COUNTRY_COMPILER_ANCHOR.contractVersion, "COUNTRY_GENOME_CONTRACT_VERSION_INVALID");
  addBlocker(blockers, nonEmptyText(input.genome_id), "COUNTRY_GENOME_ID_REQUIRED");
  addBlocker(blockers, nonEmptyText(input.genome_version), "COUNTRY_GENOME_VERSION_REQUIRED");

  const country = isRecord(input.country) ? input.country : {};
  addBlocker(blockers, nonEmptyText(country.code_iso2) && String(country.code_iso2).length === 2, "COUNTRY_CODE_REQUIRED");
  addBlocker(blockers, nonEmptyText(country.name), "COUNTRY_NAME_REQUIRED");
  addBlocker(blockers, nonEmptyText(country.region), "COUNTRY_REGION_REQUIRED");
  addBlocker(blockers, nonEmptyText(country.jurisdiction), "COUNTRY_JURISDICTION_REQUIRED");
  addBlocker(blockers, nonEmptyText(country.timezone), "COUNTRY_TIMEZONE_REQUIRED");
  addBlocker(blockers, nonEmptyStringArray(country.currencies), "COUNTRY_CURRENCY_REQUIRED");

  const authority = isRecord(input.authority) ? input.authority : {};
  addBlocker(blockers, nonEmptyText(authority.sovereign_owner), "SOVEREIGN_OWNER_REQUIRED");
  addBlocker(blockers, nonEmptyStringArray(authority.competent_authorities), "COMPETENT_AUTHORITY_REQUIRED");
  addBlocker(blockers, nonEmptyStringArray(authority.mandates), "AUTHORITY_MANDATE_REQUIRED");

  const truth = isRecord(input.truth) ? input.truth : {};
  addBlocker(blockers, nonEmptyText(truth.max_truth_state), "MAX_TRUTH_STATE_REQUIRED");
  addBlocker(blockers, nonEmptyStringArray(truth.evidence_refs), "COUNTRY_EVIDENCE_REQUIRED");

  const sovereignty = isRecord(input.sovereignty) ? input.sovereignty : {};
  addBlocker(blockers, nonEmptyStringArray(sovereignty.sovereignty_policy_refs), "SOVEREIGNTY_POLICY_REQUIRED");

  const capabilities = isRecord(input.capabilities) ? input.capabilities : {};
  addBlocker(blockers, Array.isArray(capabilities.existing), "CAPABILITY_INVENTORY_REQUIRED");
  addBlocker(blockers, Array.isArray(capabilities.gaps), "CAPABILITY_GAPS_REQUIRED");

  const security = isRecord(input.security) ? input.security : {};
  addBlocker(blockers, security.rollback_required === true, "ROLLBACK_REQUIRED");
  addBlocker(blockers, security.kill_switch_required === true, "KILL_SWITCH_REQUIRED");
  addBlocker(blockers, nonEmptyText(security.permissions_model), "PERMISSIONS_MODEL_REQUIRED");
  addBlocker(blockers, nonEmptyText(security.secrets_policy), "SECRETS_POLICY_REQUIRED");
  addBlocker(blockers, nonEmptyText(security.logging_policy), "LOGGING_POLICY_REQUIRED");

  const governance = isRecord(input.governance) ? input.governance : {};
  const requiredGates = Array.isArray(governance.required_gates)
    ? governance.required_gates.filter(nonEmptyText)
    : [];
  for (const gate of ["STRATEX-9", "M6", "S7+", "M8"]) {
    addBlocker(blockers, requiredGates.includes(gate), `GATE_${gate.replace(/[^A-Z0-9]/g, "_")}_REQUIRED`);
  }

  const deployment = isRecord(input.deployment) ? input.deployment : {};
  addBlocker(blockers, nonEmptyText(deployment.rollback_target), "ROLLBACK_TARGET_REQUIRED");

  return unique(blockers);
}

function asCountryGenome(value: unknown): CountryGenome {
  return value as CountryGenome;
}

function decideCapability(
  capabilityId: string,
  genome: CountryGenome
): CapabilityMatrixItem {
  const existing = genome.capabilities.existing.find(item => item.id === capabilityId);
  const gap = genome.capabilities.gaps.find(item => item.id === capabilityId);

  if (existing?.status === "available" && nonEmptyText(existing.evidence_ref)) {
    return {
      capabilityId,
      name: existing.name,
      decision: "REUSE_EXISTING",
      evidenceRefs: [existing.evidence_ref],
      reason: "Existing evidenced national capability must be reused; rebuilding is forbidden by Existing Capability First."
    };
  }

  if (existing?.status === "partial" && nonEmptyText(existing.evidence_ref)) {
    return {
      capabilityId,
      name: existing.name,
      decision: "INTEGRATE",
      evidenceRefs: [existing.evidence_ref],
      reason: "Partial national capability is integrated and extended through connectors/configuration before any replacement."
    };
  }

  if (gap && nonEmptyText(gap.evidence_ref)) {
    return {
      capabilityId,
      name: gap.name,
      decision: "AUGMENT",
      evidenceRefs: [gap.evidence_ref],
      reason: "A documented capability gap exists; augmentation is permitted without modifying the shared CORE."
    };
  }

  return {
    capabilityId,
    name: existing?.name ?? gap?.name ?? capabilityId,
    decision: "BLOCKED_NEEDS_EVIDENCE",
    evidenceRefs: existing?.evidence_ref ? [existing.evidence_ref] : [],
    reason: "No sufficient evidence proves an existing capability or an authorized gap."
  };
}

function generatedRefs(countryCode: string, executionId: string): CountryCompileResult["generated"] {
  const prefix = `country:${countryCode.toLowerCase()}:${executionId}`;
  return {
    capabilityMatrixRef: `${prefix}:capability-matrix`,
    policyPackManifestRef: `${prefix}:policy-pack-manifest`,
    connectorManifestRef: `${prefix}:connector-manifest`,
    domainSelectionRef: `${prefix}:domain-selection`,
    permissionsMatrixRef: `${prefix}:permissions-matrix`,
    dataResidencyPolicyRef: `${prefix}:data-residency-policy`,
    deploymentTopologyRef: `${prefix}:deployment-topology`,
    countryTestPlanRef: `${prefix}:test-plan`,
    evidencePackIndexRef: `${prefix}:evidence-pack-index`,
    rollbackPlanRef: `${prefix}:rollback-plan`,
    birthCertificateRef: `${prefix}:birth-certificate`,
    compilerOutputManifestRef: `${prefix}:compiler-output-manifest`
  };
}

export function compileCountryGenome(input: CountryCompileRequest): CountryCompileResult {
  const requestBlockers: string[] = [];
  addBlocker(requestBlockers, nonEmptyText(input?.executionId), "EXECUTION_ID_REQUIRED");
  addBlocker(requestBlockers, nonEmptyText(input?.parentCoreRef), "PARENT_CORE_REF_REQUIRED");
  addBlocker(requestBlockers, nonEmptyText(input?.targetTruthState), "TARGET_TRUTH_STATE_REQUIRED");
  addBlocker(requestBlockers, Array.isArray(input?.requestedCapabilities), "REQUESTED_CAPABILITIES_REQUIRED");
  if (input?.requestedCoreMutation === true) {
    requestBlockers.push("COUNTRY_CORE_FORK_FORBIDDEN");
  }

  const genomeBlockers = validateCountryGenome(input?.countryGenome);
  const blockers = unique([...requestBlockers, ...genomeBlockers]);

  const genome = asCountryGenome(input?.countryGenome);
  const countryCode = nonEmptyText(genome?.country?.code_iso2) ? genome.country.code_iso2.toUpperCase() : "UNRESOLVED";
  const requestedCapabilities = Array.isArray(input?.requestedCapabilities)
    ? unique(input.requestedCapabilities.filter(nonEmptyText))
    : [];
  const capabilityMatrix = blockers.length === 0
    ? requestedCapabilities.map(capabilityId => decideCapability(capabilityId, genome))
    : [];

  for (const item of capabilityMatrix) {
    if (item.decision === "BLOCKED_NEEDS_EVIDENCE") {
      blockers.push(`CAPABILITY_EVIDENCE_REQUIRED:${item.capabilityId}`);
    }
  }

  const evidenceRefs = blockers.length === 0
    ? unique([
        ...genome.truth.evidence_refs,
        ...genome.authority.mandates,
        ...genome.sovereignty.sovereignty_policy_refs,
        ...capabilityMatrix.flatMap(item => item.evidenceRefs)
      ])
    : [];

  const status: CompileStatus = blockers.length === 0
    ? "READY_FOR_BLUEPRINT"
    : blockers.some(code =>
        code.includes("CONTRACT")
        || code.includes("CODE_REQUIRED")
        || code === "COUNTRY_CORE_FORK_FORBIDDEN"
      )
      ? "BLOCKED"
      : "NEEDS_EVIDENCE";

  return {
    status,
    executionId: nonEmptyText(input?.executionId) ? input.executionId : "UNRESOLVED",
    country: countryCode,
    coreRef: nonEmptyText(input?.parentCoreRef) ? input.parentCoreRef : "UNRESOLVED",
    compilerRef: `${GENESIS_V4_COUNTRY_COMPILER_ANCHOR.assetId}@${GENESIS_V4_COUNTRY_COMPILER_ANCHOR.version}`,
    targetTruthState: nonEmptyText(input?.targetTruthState) ? input.targetTruthState : "UNRESOLVED",
    capabilityMatrix,
    generated: generatedRefs(countryCode, nonEmptyText(input?.executionId) ? input.executionId : "unresolved"),
    blockers: unique(blockers),
    warnings: genome?.truth?.unresolved_claims?.map(claim => `UNRESOLVED_CLAIM:${claim}`) ?? [],
    evidenceRefs
  };
}

function assertCompileResult(value: unknown, label: "SOURCE" | "TARGET"): asserts value is CountryCompileResult {
  if (!isRecord(value)) {
    throw new Error(`COUNTRY_PORTABILITY_INVALID_${label}`);
  }
  const status = value.status;
  const validStatus = status === "READY_FOR_BLUEPRINT" || status === "NEEDS_EVIDENCE" || status === "BLOCKED";
  if (
    !validStatus
    || !nonEmptyText(value.country)
    || !nonEmptyText(value.coreRef)
    || !nonEmptyText(value.compilerRef)
    || !Array.isArray(value.evidenceRefs)
    || !Array.isArray(value.blockers)
  ) {
    throw new Error(`COUNTRY_PORTABILITY_INVALID_${label}`);
  }
}

export function assessCountryPortability(
  source: CountryCompileResult,
  target: CountryCompileResult
): CountryPortabilityAssessment {
  assertCompileResult(source, "SOURCE");
  assertCompileResult(target, "TARGET");

  const regressions: string[] = [];
  const coreUnchanged = source.coreRef === target.coreRef;

  if (!coreUnchanged) regressions.push("CORE_REF_CHANGED");
  if (source.status !== "READY_FOR_BLUEPRINT") regressions.push(`SOURCE_NOT_READY:${source.status}`);
  if (target.status !== "READY_FOR_BLUEPRINT") regressions.push(`TARGET_NOT_READY:${target.status}`);
  if (source.country === target.country) regressions.push("SECOND_COUNTRY_REQUIRED");

  const criticalRegressions = unique(regressions);
  const verdict: PortabilityVerdict = !coreUnchanged || criticalRegressions.includes("SECOND_COUNTRY_REQUIRED")
    ? "PORTABILITY_FAIL"
    : criticalRegressions.length > 0
      ? "PORTABILITY_CONDITIONAL"
      : "REPRODUCTION_PROVEN_CANDIDATE";

  return {
    sourceCountry: source.country,
    targetCountry: target.country,
    sourceCoreRef: source.coreRef,
    targetCoreRef: target.coreRef,
    coreUnchanged,
    criticalRegressions,
    verdict,
    evidenceRefs: unique([...source.evidenceRefs, ...target.evidenceRefs])
  };
}
