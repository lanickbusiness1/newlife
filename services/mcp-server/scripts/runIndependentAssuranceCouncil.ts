import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  OpenAICompatibleCouncilClient,
  runIndependentAssuranceCouncil,
  type CouncilEvidenceByRole
} from "../src/assuranceCouncilExecutor.js";
import { verifyIndependentAssurance } from "../src/independentAssurance.js";

const repoRoot = path.resolve(process.cwd(), "../..");

function requiredEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value || value.trim().length === 0) throw new Error(`IAC_RUNNER_CONFIG_INVALID: ${name} is required`);
  return value.trim();
}

async function boundedFile(relativePath: string, maxChars = 18_000): Promise<string> {
  const absolute = path.join(repoRoot, relativePath);
  const content = await readFile(absolute, "utf8");
  const bounded = content.length <= maxChars
    ? content
    : `${content.slice(0, Math.floor(maxChars / 2))}\n\n...[BOUNDED FOR CONTEXT]...\n\n${content.slice(-Math.floor(maxChars / 2))}`;
  return `FILE ${relativePath}\n${bounded}`;
}

async function optionalFile(relativePath: string, maxChars = 12_000): Promise<string | null> {
  try { return await boundedFile(relativePath, maxChars); } catch { return null; }
}

async function buildEvidence(): Promise<CouncilEvidenceByRole> {
  const architecture = await Promise.all([
    boundedFile("services/mcp-server/src/independentAssurance.ts"),
    boundedFile("services/mcp-server/src/assuranceCouncilExecutor.ts"),
    boundedFile("services/mcp-server/src/releaseCenter.ts"),
    boundedFile("services/mcp-server/src/validationRelay.ts")
  ]);
  const securityCandidates = await Promise.all([
    boundedFile("services/mcp-server/src/index.ts"),
    boundedFile("services/mcp-server/package.json"),
    boundedFile(".github/workflows/mcp-ci.yml"),
    optionalFile(".github/workflows/iac-council.yml"),
    boundedFile("render.yaml")
  ]);
  const sovereignty = await Promise.all([
    boundedFile("services/mcp-server/src/computeEconomics.ts"),
    boundedFile("services/mcp-server/src/deploymentOrchestrator.ts"),
    boundedFile("services/mcp-server/src/domainManager.ts")
  ]);
  const economics = await Promise.all([
    boundedFile("services/mcp-server/src/computeEconomics.ts"),
    boundedFile("docs/genesis-v4/V4-DEC-021-api-first-qualified-least-cost.md")
  ]);
  const diffEvidence = process.env.IAC_DIFF_PATH
    ? await optionalFile(path.relative(repoRoot, path.resolve(process.env.IAC_DIFF_PATH)), 20_000)
    : null;

  return {
    ARCHITECTURE_RUNTIME_AUDITOR: architecture,
    SECURITY_SUPPLY_CHAIN_AUDITOR: securityCandidates.filter((item): item is string => Boolean(item)),
    SOVEREIGNTY_COMPLIANCE_AUDITOR: sovereignty,
    ECONOMICS_FINOPS_AUDITOR: economics,
    ADVERSARIAL_RED_TEAM_AUDITOR: [
      `PR #64 snapshot review; CI evidence: ${process.env.IAC_CI_EVIDENCE ?? "not supplied"}`,
      ...(diffEvidence ? [diffEvidence] : [])
    ]
  };
}

const snapshotSha = requiredEnv("SNAPSHOT_SHA", process.env.GITHUB_SHA);
const baseUrl = requiredEnv("IAC_BASE_URL", "http://127.0.0.1:8080/v1");
const model = requiredEnv("IAC_MODEL", "afriagenesis-iac-qwen25-coder-7b-q4km");
const generatedAt = process.env.IAC_GENERATED_AT ?? new Date().toISOString();
const builderAgentIds = requiredEnv("IAC_BUILDER_AGENT_IDS", "agent:builder:deploybot")
  .split(",").map(value => value.trim()).filter(Boolean);
const externalMandate = (process.env.IAC_EXTERNAL_MANDATE ?? "false").toLowerCase() === "true";
const outputPath = path.resolve(process.env.IAC_OUTPUT ?? path.join(process.cwd(), "artifacts", "internal-assurance", `${snapshotSha}.json`));

const client = new OpenAICompatibleCouncilClient({
  baseUrl,
  model,
  apiKey: process.env.IAC_API_KEY,
  maxTokens: Number(process.env.IAC_MAX_TOKENS ?? 900),
  temperature: 0,
  timeoutMs: Number(process.env.IAC_TIMEOUT_MS ?? 240_000)
});

const result = await runIndependentAssuranceCouncil({
  snapshotSha,
  builderAgentIds,
  externalMandate,
  evidenceByRole: await buildEvidence(),
  generatedAt,
  evidenceRef: requiredEnv("IAC_EVIDENCE_REF", `github-actions:${process.env.GITHUB_RUN_ID ?? "local"}:${snapshotSha}`)
}, client);

verifyIndependentAssurance(result.evidence);
await mkdir(path.dirname(outputPath), { recursive: true });
const artifact = {
  schemaVersion: "1.0.0",
  execution: {
    snapshotSha,
    provider: process.env.IAC_PROVIDER ?? "local-llama.cpp",
    model,
    modelSha256: process.env.IAC_MODEL_SHA256 ?? null,
    runtimeSha256: process.env.IAC_RUNTIME_SHA256 ?? null,
    githubRunId: process.env.GITHUB_RUN_ID ?? null,
    generatedAt
  },
  ...result
};
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`IAC_ARTIFACT=${outputPath}`);
console.log(`IAC_VERDICT=${result.evidence.verdict}`);
console.log(`IAC_SHA256=${result.evidence.sha256}`);
console.log(`IAC_OPEN_P0=${result.evidence.openP0}`);
console.log(`IAC_OPEN_P1=${result.evidence.openP1}`);
