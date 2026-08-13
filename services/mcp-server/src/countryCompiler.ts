import {
  verifyContextPackProvenance,
  type ContextPackProvenance
} from "./contextPackProvenance.js";
import {
  Stratex99ContextSchema,
  type SkillLevel,
  type Stratex99Context
} from "./skillFactory.js";
import { SkillRegistry, type RegistryEntry } from "./skillRegistry.js";

export const GENESIS_V4_COUNTRY_COMPILER_ANCHOR = "GEN-V4-COUNTRY-COMPILER-001" as const;

export interface Stratex9CountryQualification {
  status: "go" | "conditional" | "no_go";
  evidenceRefs: string[];
}

export interface CountryCompileInput {
  countryCode: string;
  contextPack?: Stratex99Context;
  contextProvenance?: ContextPackProvenance;
  stratex9Qualification: Stratex9CountryQualification;
  skillRefs: Array<{ id: string; version: string }>;
}

export interface CountrySkillLineage {
  id: string;
  version: string;
  level: SkillLevel;
  sha256: string;
}

export interface CountryCompiledSkill {
  anchor: typeof GENESIS_V4_COUNTRY_COMPILER_ANCHOR;
  countryCode: string;
  contextPack: Stratex99Context;
  contextProvenance: ContextPackProvenance;
  stratex9Qualification: Stratex9CountryQualification;
  configuration: Record<string, unknown>;
  universalInvariants: Record<string, unknown>;
  lineage: CountrySkillLineage[];
  alerts: string[];
}

const LEVEL_ORDER: Record<SkillLevel, number> = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
  L5: 5
};

const CRITICAL_CONTEXT_LAYERS: Array<keyof Stratex99Context> = [
  "regulatoryLegal",
  "infrastructureResilience",
  "governanceSovereigntyAssurance"
];

function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function validateCountryCode(countryCode: string): string {
  const normalized = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(normalized)) {
    throw new Error("COUNTRY_CODE_INVALID");
  }
  return normalized;
}

function validateContext(contextPack: Stratex99Context | undefined): Stratex99Context {
  if (!contextPack) {
    throw new Error("COUNTRY_CONTEXT_REQUIRED");
  }
  const parsed = Stratex99ContextSchema.safeParse(contextPack);
  if (!parsed.success) {
    throw new Error("COUNTRY_CONTEXT_INVALID");
  }
  for (const [layer, value] of Object.entries(parsed.data)) {
    if (value.evidenceRefs.length === 0) {
      throw new Error(`COUNTRY_CONTEXT_EVIDENCE_REQUIRED:${layer}`);
    }
    if (
      value.status === "partial" &&
      CRITICAL_CONTEXT_LAYERS.includes(layer as keyof Stratex99Context)
    ) {
      throw new Error(`COUNTRY_CONTEXT_CRITICAL_INCOMPLETE:${layer}`);
    }
  }
  return parsed.data;
}

function validateStratex9(qualification: Stratex9CountryQualification): string[] {
  if (qualification.status === "no_go") {
    throw new Error("STRATEX9_NO_GO");
  }
  if (qualification.evidenceRefs.length === 0) {
    throw new Error("STRATEX9_EVIDENCE_REQUIRED");
  }
  return qualification.status === "conditional" ? ["STRATEX9_CONDITIONAL"] : [];
}

function enforceJurisdiction(countryCode: string, entry: RegistryEntry): void {
  if (!["L2", "L3", "L4", "L5"].includes(entry.skill.level)) return;
  const countries = entry.skill.countries.map(value => value.toUpperCase());
  if (countries.length > 0 && !countries.includes(countryCode)) {
    throw new Error(`JURISDICTION_MISMATCH:${entry.skill.id}:${countryCode}`);
  }
}

function enforceLifecycle(entry: RegistryEntry): void {
  if (entry.lifecycle.status === "deprecated") {
    throw new Error(`DEPRECATED_SKILL_NOT_COMPOSABLE:${entry.skill.id}@${entry.skill.version}`);
  }
}

export async function compileCountrySkill(
  registry: SkillRegistry,
  input: CountryCompileInput
): Promise<CountryCompiledSkill> {
  const countryCode = validateCountryCode(input.countryCode);
  const contextPack = validateContext(input.contextPack);
  const alerts = validateStratex9(input.stratex9Qualification);

  if (input.skillRefs.length === 0) {
    throw new Error("COUNTRY_SKILL_REFS_REQUIRED");
  }

  const entries = await Promise.all(
    input.skillRefs.map(ref => registry.read(ref.id, ref.version))
  );
  entries.sort((left, right) => LEVEL_ORDER[left.skill.level] - LEVEL_ORDER[right.skill.level]);

  const configuration: Record<string, unknown> = {};
  const universalInvariants: Record<string, unknown> = {};
  const lineage: CountrySkillLineage[] = [];

  for (const entry of entries) {
    enforceLifecycle(entry);
    enforceJurisdiction(countryCode, entry);

    for (const [key, value] of Object.entries(entry.skill.universalInvariants)) {
      if (Object.prototype.hasOwnProperty.call(universalInvariants, key) && !sameValue(universalInvariants[key], value)) {
        throw new Error(`GENOME_INVARIANT_VIOLATION:${key}`);
      }
      universalInvariants[key] = value;
    }

    for (const [key, value] of Object.entries(entry.skill.configurableMetadata)) {
      if (Object.prototype.hasOwnProperty.call(universalInvariants, key) && !sameValue(universalInvariants[key], value)) {
        throw new Error(`GENOME_INVARIANT_VIOLATION:${key}`);
      }
      configuration[key] = value;
    }

    lineage.push({
      id: entry.skill.id,
      version: entry.skill.version,
      level: entry.skill.level,
      sha256: entry.integrity.sha256
    });
  }

  const contextProvenance = verifyContextPackProvenance(
    input.contextProvenance,
    countryCode,
    contextPack
  );

  return {
    anchor: GENESIS_V4_COUNTRY_COMPILER_ANCHOR,
    countryCode,
    contextPack,
    contextProvenance,
    stratex9Qualification: input.stratex9Qualification,
    configuration,
    universalInvariants,
    lineage,
    alerts
  };
}
