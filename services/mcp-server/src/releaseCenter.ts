import { createHash } from "node:crypto";
import type { DomainEvidence } from "./domainManager.js";
import type { ProviderDeploymentEvidence } from "./deploymentOrchestrator.js";
import {
  verifyAiEconomicsCertificate,
  type AiEconomicsCertificate
} from "./computeEconomics.js";

export type ReleaseRiskClass = "low" | "moderate" | "high" | "regulated";
export type ReleaseTargetDeliverable = "url" | "apk" | "aab" | "service" | "infrastructure";

type Pass = "pass";

export interface ReleaseEvidenceBundle {
  schemaVersion: "1.1.0";
  releaseId: string;
  assetId: string;
  version: string;
  commitSha: string;
  ciRun: string;
  testSummary: string;
  gates: {
    m6: Pass;
    s7plus: Pass;
    m8: Pass;
    big4?: Pass;
  };
  sovereigntyDecisionRef: string;
  aiEconomicsCertificate: AiEconomicsCertificate;
  provider: ProviderDeploymentEvidence;
  domain?: DomainEvidence;
  finalUrlOrArtifact: string;
  healthcheck: {
    url: string;
    status: number;
    passed: true;
    checkedAt: string;
  };
  rollback: {
    reference: string;
    verified: true;
  };
  changelog: string[];
  remeRef: string;
  generatedAt: string;
  sha256: string;
}

export type ReleaseEvidenceInput = Omit<ReleaseEvidenceBundle, "schemaVersion" | "sha256">;

function required(value: string | undefined, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`DEPLOYBOT_RELEASE_INVALID: ${name} is required`);
  }
  return value.trim();
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

function digest(bundleWithoutHash: Omit<ReleaseEvidenceBundle, "sha256">): string {
  return createHash("sha256").update(canonicalize(bundleWithoutHash)).digest("hex");
}

function bundleWithoutHash(bundle: ReleaseEvidenceBundle): Omit<ReleaseEvidenceBundle, "sha256"> {
  const { sha256: _sha256, ...rest } = bundle;
  return rest;
}

function finalUrlUsesCanonicalDomain(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === "afriagenesis.com" || url.hostname.endsWith(".afriagenesis.com");
  } catch {
    return false;
  }
}

export function compileReleaseEvidenceBundle(input: ReleaseEvidenceInput): ReleaseEvidenceBundle {
  required(input.releaseId, "releaseId");
  required(input.assetId, "assetId");
  required(input.version, "version");
  required(input.commitSha, "commitSha");
  required(input.ciRun, "ciRun");
  required(input.testSummary, "testSummary");
  required(input.sovereigntyDecisionRef, "sovereigntyDecisionRef");
  required(input.aiEconomicsCertificate?.workloadId, "aiEconomicsCertificate.workloadId");
  required(input.aiEconomicsCertificate?.sha256, "aiEconomicsCertificate.sha256");
  required(input.finalUrlOrArtifact, "finalUrlOrArtifact");
  required(input.remeRef, "remeRef");
  required(input.generatedAt, "generatedAt");

  if (input.provider.deployedCommitSha !== input.commitSha) {
    throw new Error("DEPLOYBOT_RELEASE_COMMIT_MISMATCH: provider deployed commit differs from release commit");
  }

  const withoutHash: Omit<ReleaseEvidenceBundle, "sha256"> = {
    schemaVersion: "1.1.0",
    ...input
  };

  return {
    ...withoutHash,
    sha256: digest(withoutHash)
  };
}

export function verifyReleaseEvidenceBundle(
  bundle: ReleaseEvidenceBundle,
  policy: { riskClass: ReleaseRiskClass; targetDeliverable: ReleaseTargetDeliverable }
): { valid: true; sha256: string; aiEconomicsCertificateSha256: string } {
  if (bundle.schemaVersion !== "1.1.0") {
    throw new Error("DEPLOYBOT_RELEASE_SCHEMA_UNSUPPORTED");
  }

  const expectedHash = digest(bundleWithoutHash(bundle));
  if (!/^[a-f0-9]{64}$/.test(bundle.sha256) || bundle.sha256 !== expectedHash) {
    throw new Error("DEPLOYBOT_RELEASE_SHA_MISMATCH: release bundle is tampered or malformed");
  }

  required(bundle.releaseId, "releaseId");
  required(bundle.assetId, "assetId");
  required(bundle.version, "version");
  required(bundle.commitSha, "commitSha");
  required(bundle.ciRun, "ciRun");
  required(bundle.testSummary, "testSummary");
  required(bundle.sovereigntyDecisionRef, "sovereigntyDecisionRef");
  required(bundle.aiEconomicsCertificate?.workloadId, "aiEconomicsCertificate.workloadId");
  required(bundle.aiEconomicsCertificate?.sha256, "aiEconomicsCertificate.sha256");
  required(bundle.finalUrlOrArtifact, "finalUrlOrArtifact");
  required(bundle.remeRef, "remeRef");

  const economicsVerification = verifyAiEconomicsCertificate(bundle.aiEconomicsCertificate);

  if (bundle.gates.m6 !== "pass" || bundle.gates.s7plus !== "pass" || bundle.gates.m8 !== "pass") {
    throw new Error("DEPLOYBOT_RELEASE_GATES_INCOMPLETE: M6, S7+ and M8 must pass");
  }

  if ((policy.riskClass === "high" || policy.riskClass === "regulated") && bundle.gates.big4 !== "pass") {
    throw new Error("DEPLOYBOT_RELEASE_BIG4_REQUIRED: Big4 must pass for high/regulated release policy");
  }

  if (bundle.provider.providerStatus !== "live") {
    throw new Error("DEPLOYBOT_RELEASE_PROVIDER_NOT_LIVE");
  }

  if (bundle.provider.deployedCommitSha !== bundle.commitSha) {
    throw new Error("DEPLOYBOT_RELEASE_COMMIT_MISMATCH: provider deployed commit differs from release commit");
  }

  const publicDelivery = policy.targetDeliverable === "url"
    || policy.targetDeliverable === "service"
    || policy.targetDeliverable === "infrastructure";

  if (publicDelivery && finalUrlUsesCanonicalDomain(bundle.finalUrlOrArtifact)) {
    if (!bundle.domain) {
      throw new Error("DEPLOYBOT_RELEASE_DOMAIN_REQUIRED: canonical AfrIAgenesis delivery requires domain evidence");
    }
    if (bundle.domain.hostname.toLowerCase() !== new URL(bundle.finalUrlOrArtifact).hostname.toLowerCase()) {
      throw new Error("DEPLOYBOT_RELEASE_DOMAIN_MISMATCH: final URL hostname differs from domain evidence");
    }
    if (!bundle.domain.dnsVerified) {
      throw new Error("DEPLOYBOT_RELEASE_DNS_REQUIRED: DNS is not verified");
    }
    if (!bundle.domain.tlsVerified) {
      throw new Error("DEPLOYBOT_RELEASE_TLS_REQUIRED: TLS is not verified");
    }
    if (typeof bundle.domain.httpsStatus !== "number" || bundle.domain.httpsStatus < 200 || bundle.domain.httpsStatus >= 400) {
      throw new Error("DEPLOYBOT_RELEASE_HTTPS_FAILED: canonical HTTPS status is not successful");
    }
  }

  if (bundle.healthcheck.passed !== true || bundle.healthcheck.status < 200 || bundle.healthcheck.status >= 400) {
    throw new Error("DEPLOYBOT_RELEASE_HEALTHCHECK_REQUIRED: verified healthcheck is missing");
  }

  if (bundle.rollback.verified !== true || !bundle.rollback.reference?.trim()) {
    throw new Error("DEPLOYBOT_RELEASE_ROLLBACK_REQUIRED: verified rollback evidence is missing");
  }

  return {
    valid: true,
    sha256: bundle.sha256,
    aiEconomicsCertificateSha256: economicsVerification.sha256
  };
}
