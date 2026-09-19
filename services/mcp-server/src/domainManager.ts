import type { DeploymentEnvironment } from "./deploymentOrchestrator.js";

export type DnsRecordType = "A" | "AAAA" | "CNAME";
export type DomainVerificationState =
  | "DOMAIN_INTENT"
  | "DNS_PENDING"
  | "DNS_VERIFIED"
  | "TLS_PENDING"
  | "HTTPS_VERIFIED"
  | "DOMAIN_FAILED";

const DEPLOYMENT_ENVIRONMENTS = new Set<DeploymentEnvironment>([
  "development",
  "staging",
  "production"
]);

const DNS_RECORD_TYPES = new Set<DnsRecordType>(["A", "AAAA", "CNAME"]);

export interface DomainIntent {
  hostname: string;
  environment: DeploymentEnvironment;
  recordType: DnsRecordType;
  target: string;
  providerDeploymentId: string;
}

export interface DomainEvidence {
  hostname: string;
  resolvedTargets: string[];
  dnsVerified: boolean;
  tlsVerified: boolean;
  certificateIssuer?: string;
  certificateExpiresAt?: string;
  httpsStatus?: number;
  verifiedAt?: string;
}

export interface DomainVerificationResult {
  state: DomainVerificationState;
  intent: DomainIntent;
  evidence: DomainEvidence;
  nextAction: string;
}

function required(value: string | undefined, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`DEPLOYBOT_DOMAIN_INVALID: ${name} is required`);
  }
  return value.trim();
}

function validateEnvironment(value: unknown): DeploymentEnvironment {
  if (typeof value !== "string" || !DEPLOYMENT_ENVIRONMENTS.has(value as DeploymentEnvironment)) {
    throw new Error("DEPLOYBOT_DOMAIN_INVALID: environment must be development, staging or production");
  }
  return value as DeploymentEnvironment;
}

function validateRecordType(value: unknown): DnsRecordType {
  if (typeof value !== "string" || !DNS_RECORD_TYPES.has(value as DnsRecordType)) {
    throw new Error("DEPLOYBOT_DOMAIN_INVALID: recordType must be A, AAAA or CNAME");
  }
  return value as DnsRecordType;
}

function normalizeService(service: string): string {
  const normalized = required(service, "service").toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
    throw new Error("DEPLOYBOT_DOMAIN_INVALID: service must be a valid DNS label");
  }
  return normalized;
}

export function compileDomainIntent(input: {
  service: string;
  environment: DeploymentEnvironment;
  recordType: DnsRecordType;
  target: string;
  providerDeploymentId: string;
}): DomainIntent {
  const service = normalizeService(input.service);
  const environment = validateEnvironment(input.environment);
  const recordType = validateRecordType(input.recordType);
  const hostname = environment === "production"
    ? `${service}.afriagenesis.com`
    : environment === "staging"
      ? `${service}-staging.afriagenesis.com`
      : `${service}-dev.afriagenesis.com`;

  return {
    hostname,
    environment,
    recordType,
    target: required(input.target, "target"),
    providerDeploymentId: required(input.providerDeploymentId, "providerDeploymentId")
  };
}

export function verifyDomainEvidence(input: {
  intent: DomainIntent;
  evidence: DomainEvidence;
}): DomainVerificationResult {
  const { intent, evidence } = input;

  if (required(evidence.hostname, "hostname").toLowerCase() !== intent.hostname.toLowerCase()) {
    throw new Error("DEPLOYBOT_DOMAIN_HOSTNAME_MISMATCH: evidence hostname differs from canonical intent");
  }

  if (!evidence.dnsVerified) {
    return {
      state: "DNS_PENDING",
      intent,
      evidence,
      nextAction: "Verify canonical DNS resolution before TLS/HTTPS promotion."
    };
  }

  if (!Array.isArray(evidence.resolvedTargets) || evidence.resolvedTargets.length === 0) {
    return {
      state: "DNS_PENDING",
      intent,
      evidence,
      nextAction: "Record at least one resolved DNS target for the canonical hostname."
    };
  }

  if (!evidence.tlsVerified) {
    return {
      state: "TLS_PENDING",
      intent,
      evidence,
      nextAction: "Verify a valid TLS certificate for the canonical hostname."
    };
  }

  if (typeof evidence.httpsStatus !== "number" || evidence.httpsStatus < 200 || evidence.httpsStatus >= 400) {
    return {
      state: "DOMAIN_FAILED",
      intent,
      evidence,
      nextAction: "Canonical HTTPS endpoint did not return a successful status."
    };
  }

  return {
    state: "HTTPS_VERIFIED",
    intent,
    evidence,
    nextAction: "Pass canonical domain evidence to Release Center."
  };
}
