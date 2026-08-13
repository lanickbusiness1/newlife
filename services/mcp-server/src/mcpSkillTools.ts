import { z } from "zod";
import { authorizeTerritorialTarget } from "./authorization.js";
import { compileCountrySkill, GENESIS_V4_COUNTRY_COMPILER_ANCHOR } from "./countryCompiler.js";
import {
  compileSkill,
  evaluatePromotion,
  GENESIS_V4_SKILL_FACTORY_ANCHOR,
  Stratex99ContextSchema
} from "./skillFactory.js";
import {
  GENESIS_SKILL_REGISTRY_VERSION,
  SkillRegistry,
  type InstallApprovals,
  type RegistryEntry
} from "./skillRegistry.js";

export const SKILL_MCP_HEALTH = {
  skillFactory: GENESIS_V4_SKILL_FACTORY_ANCHOR,
  skillRegistry: GENESIS_SKILL_REGISTRY_VERSION,
  countryCompiler: GENESIS_V4_COUNTRY_COMPILER_ANCHOR
} as const;

export const SKILL_MCP_TOOL_NAMES = [
  "genome.skill_factory.compile",
  "genome.skill_factory.match",
  "genome.skill_factory.install",
  "genome.skill_factory.promote",
  "genome.skill_registry.list",
  "genome.skill_registry.read",
  "genome.country_compiler.compile"
] as const;

type RegisterFn = (
  name: string,
  description: string,
  inputSchema: Record<string, z.ZodTypeAny>,
  requiredScope: string,
  handler: (args: any) => Promise<unknown>
) => void;

const SkillLevelSchema = z.enum(["L0", "L1", "L2", "L3", "L4", "L5"]);

const SkillRequestSchema = z.object({
  level: SkillLevelSchema,
  domain: z.string().min(3),
  problem: z.string().min(8),
  triggers: z.array(z.string().min(1)).min(1),
  inputs: z.array(z.string().min(1)).min(1),
  outputs: z.array(z.string().min(1)).min(1),
  dependencies: z.array(z.string().min(1)).default([]),
  connectors: z.array(z.string().min(1)).default([]),
  permissions: z.array(z.string().min(1)).min(1),
  regions: z.array(z.string().min(1)).optional(),
  countries: z.array(z.string().min(2)).optional(),
  institutions: z.array(z.string().min(1)).optional()
});

const PromotionSchema = z.object({
  fromLevel: SkillLevelSchema,
  toLevel: SkillLevelSchema,
  outcomeEvidencePresent: z.boolean(),
  localRulesSeparated: z.boolean(),
  permissionsBounded: z.boolean(),
  doubleReviewPassed: z.boolean(),
  rollbackPresent: z.boolean(),
  secondContextTestPassed: z.boolean(),
  hardcodedNationalRule: z.boolean()
});

const CountryCompileSchema = z.object({
  countryCode: z.string().min(2).max(3),
  contextPack: Stratex99ContextSchema,
  stratex9Qualification: z.object({
    status: z.enum(["go", "conditional", "no_go"]),
    evidenceRefs: z.array(z.string().min(1))
  }),
  skillRefs: z.array(z.object({
    id: z.string().min(3),
    version: z.string().regex(/^\d+\.\d+\.\d+$/)
  })).min(1)
});

const InstallApprovalsSchema = z.object({
  doubleReview: z.boolean().optional(),
  m8Approval: z.boolean().optional()
}).default({});

function authorizeRegistryEntry(context: any, entry: RegistryEntry): void {
  authorizeTerritorialTarget(context, {
    countries: entry.skill.countries,
    organizations: entry.skill.institutions
  });
}

function registryEntryVisible(context: any, entry: RegistryEntry): boolean {
  try {
    authorizeRegistryEntry(context, entry);
    return true;
  } catch {
    return false;
  }
}

export function validateInstallApprovalAuthority(
  approvals: InstallApprovals,
  permissionScope: string[]
): void {
  if (approvals.m8Approval && !permissionScope.includes("genome:skill:m8")) {
    throw new Error("M8_APPROVAL_SCOPE_REQUIRED");
  }
  if (approvals.doubleReview && !permissionScope.includes("genome:skill:review")) {
    throw new Error("DOUBLE_REVIEW_SCOPE_REQUIRED");
  }
}

export function registerSkillMcpTools(
  register: RegisterFn,
  contextSchema: z.ZodTypeAny,
  registry = new SkillRegistry()
): void {
  register(
    "genome.skill_factory.compile",
    "Compile un Skill DNA GENESIS V4 avec contextualisation STRATEX-99 et gates M6/S7+/M8.",
    { context: contextSchema, payload: z.unknown() },
    "genome:skill:compile",
    async ({ context, payload }) => {
      const compiled = compileSkill(payload);
      authorizeTerritorialTarget(context, {
        countries: compiled.countries,
        organizations: compiled.institutions
      });
      return compiled;
    }
  );

  register(
    "genome.skill_factory.match",
    "Recherche Registry-first et décide reuse_or_compose à partir du seuil canonique de 80%, après filtrage ABAC des candidats.",
    { context: contextSchema, request: SkillRequestSchema },
    "genome:skill:read",
    async ({ context, request }) => {
      const parsed = SkillRequestSchema.parse(request);
      authorizeTerritorialTarget(context, {
        countries: parsed.countries,
        organizations: parsed.institutions
      });
      return registry.match(parsed, entry => registryEntryVisible(context, entry));
    }
  );

  register(
    "genome.skill_factory.install",
    "Compile puis installe un skill gouverné dans le registre avec contrôle Double Review/M8 et scopes d'autorité dédiés.",
    {
      context: contextSchema,
      payload: z.unknown(),
      approvals: InstallApprovalsSchema
    },
    "genome:skill:install",
    async ({ context, payload, approvals }) => {
      const parsedApprovals = InstallApprovalsSchema.parse(approvals);
      validateInstallApprovalAuthority(parsedApprovals, context.permissionScope ?? []);
      const compiled = compileSkill(payload);
      authorizeTerritorialTarget(context, {
        countries: compiled.countries,
        organizations: compiled.institutions
      });
      return registry.install(compiled, parsedApprovals);
    }
  );

  register(
    "genome.skill_factory.promote",
    "Évalue la promotion Institution/Country/Regional/Domain/Core sans fuite de règle nationale dans le core.",
    { context: contextSchema, promotion: PromotionSchema },
    "genome:skill:promote",
    async ({ promotion }) => evaluatePromotion(PromotionSchema.parse(promotion))
  );

  register(
    "genome.skill_registry.list",
    "Liste uniquement les skills visibles dans le périmètre ABAC vérifié, après contrôle d'intégrité SHA-256.",
    { context: contextSchema },
    "genome:skill:read",
    async ({ context }) => {
      const entries = await registry.list();
      return entries.filter(entry => registryEntryVisible(context, entry));
    }
  );

  register(
    "genome.skill_registry.read",
    "Lit une version précise d'un skill, vérifie son intégrité SHA-256 puis son périmètre ABAC territorial.",
    {
      context: contextSchema,
      id: z.string().min(3),
      version: z.string().regex(/^\d+\.\d+\.\d+$/)
    },
    "genome:skill:read",
    async ({ context, id, version }) => {
      const entry = await registry.read(id, version);
      authorizeRegistryEntry(context, entry);
      return entry;
    }
  );

  register(
    "genome.country_compiler.compile",
    "Compose L0-L5 pour un pays avec Context Pack STRATEX-99, qualification STRATEX-9 et invariants GENOME.",
    { context: contextSchema, payload: CountryCompileSchema },
    "genome:country:compile",
    async ({ context, payload }) => {
      const parsed = CountryCompileSchema.parse(payload);
      authorizeTerritorialTarget(context, { countries: [parsed.countryCode] });

      const referenced = await Promise.all(
        parsed.skillRefs.map(ref => registry.read(ref.id, ref.version))
      );
      authorizeTerritorialTarget(context, {
        organizations: referenced.flatMap(entry => entry.skill.institutions)
      });

      return compileCountrySkill(registry, parsed);
    }
  );
}
