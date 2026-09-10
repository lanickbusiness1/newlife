import { z } from "zod";

export const GENESIS_V4_INDUSTRIAL_DEPENDENCY_ADAPTER_ANCHOR = {
  assetId: "GEN-V4-INDUSTRIAL-DEPENDENCY-ADAPTER-001",
  decisionId: "V4-DEC-036",
  version: "0.1.0",
  parent: "Sovereign Industrialization & Resource Value Capture OS™",
  proofMode: "deterministic-fail-closed"
} as const;

export const INDUSTRIAL_DEPENDENCY_CATEGORIES = [
  "raw_material",
  "power",
  "water",
  "road",
  "rail",
  "port",
  "storage",
  "telecom",
  "workforce",
  "financing",
  "fx",
  "regulation",
  "logistics",
  "buyers"
] as const;

export type IndustrialDependencyCategory = typeof INDUSTRIAL_DEPENDENCY_CATEGORIES[number];
export type IndustrialDependencyStatus =
  | "VERIFIED"
  | "PARTIAL"
  | "BLOCKED"
  | "UNKNOWN"
  | "NOT_APPLICABLE_JUSTIFIED";
export type IndustrialDependencyReadiness = "VERIFIED" | "PARTIAL" | "BLOCKED" | "UNKNOWN" | "INVALID_INPUT";

const DependencySchema = z.object({
  category: z.enum(INDUSTRIAL_DEPENDENCY_CATEGORIES),
  critical: z.boolean(),
  status: z.enum(["VERIFIED", "PARTIAL", "BLOCKED", "UNKNOWN", "NOT_APPLICABLE_JUSTIFIED"]),
  evidenceRefs: z.array(z.string().min(1)).default([]),
  justification: z.string().min(10).optional()
});

const InputSchema = z.object({
  dependencies: z.array(DependencySchema).max(INDUSTRIAL_DEPENDENCY_CATEGORIES.length)
});

export type IndustrialDependencyInput = z.infer<typeof InputSchema>;

export type IndustrialDependencyResult = {
  assetId: typeof GENESIS_V4_INDUSTRIAL_DEPENDENCY_ADAPTER_ANCHOR.assetId;
  decisionId: typeof GENESIS_V4_INDUSTRIAL_DEPENDENCY_ADAPTER_ANCHOR.decisionId;
  version: typeof GENESIS_V4_INDUSTRIAL_DEPENDENCY_ADAPTER_ANCHOR.version;
  readiness: IndustrialDependencyReadiness;
  missingCategories: IndustrialDependencyCategory[];
  blockers: string[];
  canFeedDeliveryGate: boolean;
};

function invalidResult(): IndustrialDependencyResult {
  return {
    assetId: GENESIS_V4_INDUSTRIAL_DEPENDENCY_ADAPTER_ANCHOR.assetId,
    decisionId: GENESIS_V4_INDUSTRIAL_DEPENDENCY_ADAPTER_ANCHOR.decisionId,
    version: GENESIS_V4_INDUSTRIAL_DEPENDENCY_ADAPTER_ANCHOR.version,
    readiness: "INVALID_INPUT",
    missingCategories: [...INDUSTRIAL_DEPENDENCY_CATEGORIES],
    blockers: ["INVALID_INPUT"],
    canFeedDeliveryGate: false
  };
}

export function compileIndustrialDependencyReadiness(input: unknown): IndustrialDependencyResult {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) return invalidResult();

  const dependencies = parsed.data.dependencies;
  const seen = new Set<IndustrialDependencyCategory>();
  for (const dependency of dependencies) {
    if (seen.has(dependency.category)) return invalidResult();
    seen.add(dependency.category);
  }

  const missingCategories = INDUSTRIAL_DEPENDENCY_CATEGORIES.filter(category => !seen.has(category));
  const blockers: string[] = [];
  let hasBlocked = false;
  let hasUnknown = missingCategories.length > 0;
  let hasPartial = false;

  for (const category of missingCategories) {
    blockers.push(`DEPENDENCY_CATEGORY_MISSING:${category}`);
  }

  for (const dependency of dependencies) {
    const hasEvidence = dependency.evidenceRefs.length > 0;

    if (dependency.status === "VERIFIED") {
      if (!hasEvidence) {
        hasUnknown = true;
        blockers.push(`DEPENDENCY_EVIDENCE_MISSING:${dependency.category}`);
      }
      continue;
    }

    if (dependency.status === "NOT_APPLICABLE_JUSTIFIED") {
      if (dependency.critical) {
        hasBlocked = true;
        blockers.push(`CRITICAL_DEPENDENCY_CANNOT_BE_NOT_APPLICABLE:${dependency.category}`);
      } else if (!dependency.justification || !hasEvidence) {
        hasUnknown = true;
        blockers.push(`NOT_APPLICABLE_NOT_PROVEN:${dependency.category}`);
      }
      continue;
    }

    if (dependency.status === "BLOCKED") {
      if (dependency.critical) {
        hasBlocked = true;
        blockers.push(`CRITICAL_DEPENDENCY_BLOCKED:${dependency.category}`);
      } else {
        hasPartial = true;
        blockers.push(`NONCRITICAL_DEPENDENCY_BLOCKED:${dependency.category}`);
      }
      continue;
    }

    if (dependency.status === "UNKNOWN") {
      hasUnknown = true;
      blockers.push(`DEPENDENCY_UNKNOWN:${dependency.category}`);
      continue;
    }

    if (dependency.status === "PARTIAL") {
      hasPartial = true;
      blockers.push(`DEPENDENCY_PARTIAL:${dependency.category}`);
      if (!hasEvidence) {
        hasUnknown = true;
        blockers.push(`DEPENDENCY_EVIDENCE_MISSING:${dependency.category}`);
      }
    }
  }

  let readiness: IndustrialDependencyReadiness = "VERIFIED";
  if (hasBlocked) readiness = "BLOCKED";
  else if (hasUnknown) readiness = "UNKNOWN";
  else if (hasPartial) readiness = "PARTIAL";

  return {
    assetId: GENESIS_V4_INDUSTRIAL_DEPENDENCY_ADAPTER_ANCHOR.assetId,
    decisionId: GENESIS_V4_INDUSTRIAL_DEPENDENCY_ADAPTER_ANCHOR.decisionId,
    version: GENESIS_V4_INDUSTRIAL_DEPENDENCY_ADAPTER_ANCHOR.version,
    readiness,
    missingCategories,
    blockers,
    canFeedDeliveryGate: readiness === "VERIFIED"
  };
}
