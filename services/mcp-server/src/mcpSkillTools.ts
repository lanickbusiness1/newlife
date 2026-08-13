import { z } from "zod";
import { authorizeTerritorialTarget } from "./authorization.js";
import { GENESIS_CONTEXT_PACK_PROVENANCE_VERSION } from "./contextPackProvenance.js";
import { compileCountrySkill, GENESIS_V4_COUNTRY_COMPILER_ANCHOR } from "./countryCompiler.js";
import {
  GENESIS_GOVERNANCE_APPROVAL_LEDGER_VERSION,
  GENESIS_GOVERNANCE_APPROVAL_REVOCATION_VERSION,
  GovernanceApprovalLedger,
  type InstallApprovalRefs
} from "./governanceApprovalLedger.js";
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
  approvalLedger: GENESIS_GOVERNANCE_APPROVAL_LEDGER_VERSION,
  approvalRevocation: GENESIS_GOVERNANCE_APPROVAL_REVOCATION_VERSION,
  contextPackProvenance: GENESIS_CONTEXT_PACK_PROVENANCE_VERSION,
  countryCompiler: GENESIS_V4_COUNTRY_COMPILER_ANCHOR
} as const;

export const SKILL_MCP_TOOL_NAMES = [
  "genome.skill_factory.compile",
  "genome.skill_factory.match",
  "genome.skill_approval.review_attest",
  "genome.skill_approval.m8_attest",
  "genome.skill_approval.review_revoke",
  "genome.skill_approval.m8_revoke",
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

const ContextPackSourceSchema = z.object({
  sourceId: z.string().trim().min(3),
  publisher: z.string().trim().min(2),
  locator: z.string().trim().min(3),
  retrievedAt: z.string().trim().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional()
}).strict();

const ContextPackProvenanceInputSchema = z.object({
  provenanceVersion: z.literal(GENESIS_CONTEXT_PACK_PROVENANCE_VERSION),
  contextPackId: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,127}$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  countryCode: z.string().regex(/^[A-Za-z]{2,3}$/),
  issuer: z.string().trim().min(3),
  issuedAt: z.string().trim().min(1),
  expiresAt: z.string().trim().min(1),
  sources: z.array(ContextPackSourceSchema).min(1),
  contextSha256: z.string().regex(/^[a-f0-9]{64}$/)
}).strict();

const CountryCompileSchema = z.object({
  countryCode: z.string().min(2).max(3),
  contextPack: Stratex99ContextSchema,
  contextProvenance: ContextPackProvenanceInputSchema,
  stratex9Qualification: z.object({
    status: z.enum(["go", "conditional", "no_go"]),
    evidenceRefs: z.array(z.string().min(1))
  }),
  skillRefs: z.array(z.object({
    id: z.string().min(3),
    version: z.string().regex(/^\d+\.\d+\.\d+$/)
  })).min(1)
});

const InstallApprovalRefsSchema = z.object({
  reviewApprovalId: z.string().uuid().optional(),
  m8ApprovalId: z.string().uuid().optional()
}).strict().default({});

const ApprovalRevocationInputSchema = {
  approvalId: z.string().uuid(),
  reason: z.string().trim().min(3).max(1000)
};

function authorizeCompiledSkill(context: any, compiled: ReturnType<typeof compileSkill>): void {
  authorizeTerritorialTarget(context, {
    countries: compiled.countries,
    organizations: compiled.institutions
  });
}

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
  registry = new SkillRegistry(),
  approvalLedger = new GovernanceApprovalLedger()
): void {
  register(
    "genome.skill_factory.compile",
    "Compile un Skill DNA GENESIS V4 avec contextualisation STRATEX-99 et gates M6/S7+/M8.",
    { context: contextSchema, payload: z.unknown() },
    "genome:skill:compile",
    async ({ context, payload }) => {
      const compiled = compileSkill(payload);
      authorizeCompiledSkill(context, compiled);
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
    "genome.skill_approval.review_attest",
    "Atteste la Double Review d'un Skill DNA exact. L'attestation est immuable, fingerprintée, expirante et liée à l'identité OIDC du reviewer.",
    { context: contextSchema, payload: z.unknown() },
    "genome:skill:review",
    async ({ context, payload }) => {
      const compiled = compileSkill(payload);
      authorizeCompiledSkill(context, compiled);
      return approvalLedger.attest(compiled, "double_review", context);
    }
  );

  register(
    "genome.skill_approval.m8_attest",
    "Atteste l'approbation M8 d'un Skill DNA sensible exact. L'attestation est immuable, fingerprintée, expirante et liée à l'identité OIDC M8 avec MFA.",
    { context: contextSchema, payload: z.unknown() },
    "genome:skill:m8",
    async ({ context, payload }) => {
      const compiled = compileSkill(payload);
      authorizeCompiledSkill(context, compiled);
      return approvalLedger.attest(compiled, "m8", context);
    }
  );

  register(
    "genome.skill_approval.review_revoke",
    "Retire une attestation de Double Review via un événement append-only immuable, sans modifier l'attestation d'origine.",
    { context: contextSchema, ...ApprovalRevocationInputSchema },
    "genome:skill:review",
    async ({ context, approvalId, reason }) =>
      approvalLedger.revoke(approvalId, "double_review", context, reason)
  );

  register(
    "genome.skill_approval.m8_revoke",
    "Retire une attestation M8 via un événement append-only immuable, sans modifier l'attestation d'origine.",
    { context: contextSchema, ...ApprovalRevocationInputSchema },
    "genome:skill:m8",
    async ({ context, approvalId, reason }) =>
      approvalLedger.revoke(approvalId, "m8", context, reason)
  );

  register(
    "genome.skill_factory.install",
    "Compile puis installe un skill gouverné dans une section critique conservant les locks d'attestation jusqu'à l'écriture Registry.",
    {
      context: contextSchema,
      payload: z.unknown(),
      approvalRefs: InstallApprovalRefsSchema
    },
    "genome:skill:install",
    async ({ context, payload, approvalRefs }) => {
      const refs = InstallApprovalRefsSchema.parse(approvalRefs) as InstallApprovalRefs;
      const compiled = compileSkill(payload);
      authorizeCompiledSkill(context, compiled);
      return approvalLedger.withVerifiedInstall(
        compiled,
        refs,
        context,
        approvals => registry.install(compiled, approvals)
      );
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
    "Compose L0-L5 pour un pays avec Context Pack STRATEX-99 prouvé, qualification STRATEX-9 et invariants GENOME.",
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
