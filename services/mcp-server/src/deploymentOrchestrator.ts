export type DeploymentEnvironment = "development" | "staging" | "production";
export type DeploymentProvider = "egreed" | "render" | "railway" | "fly" | "cloudflare" | "vps";
export type DeploymentState =
  | "DEPLOYMENT_PLANNED"
  | "PROVIDER_PENDING"
  | "PROVIDER_DEPLOYED"
  | "DOMAIN_PENDING"
  | "VERIFYING"
  | "RELEASE_READY"
  | "DEPLOYMENT_FAILED"
  | "ROLLED_BACK";

export interface DeploymentRequest {
  assetId: string;
  version: string;
  commitSha: string;
  environment: DeploymentEnvironment;
  provider: DeploymentProvider;
  artifactRef: string;
  healthPath: string;
  desiredHostname?: string;
  sovereigntyDecisionRef: string;
}

export interface ProviderDeploymentEvidence {
  provider: DeploymentProvider;
  deploymentId: string;
  deploymentUrl: string;
  deployedCommitSha: string;
  deployedAt: string;
  providerStatus: "live" | "failed" | "rolled_back";
  providerLogRef?: string;
}

export interface DeploymentEvaluation {
  state: DeploymentState;
  request: DeploymentRequest;
  providerEvidence?: ProviderDeploymentEvidence;
  nextAction: string;
}

function required(value: string | undefined, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`DEPLOYBOT_DEPLOYMENT_INVALID: ${name} is required`);
  }
  return value.trim();
}

export function compileDeploymentRequest(input: DeploymentRequest): DeploymentRequest {
  const request: DeploymentRequest = {
    ...input,
    assetId: required(input.assetId, "assetId"),
    version: required(input.version, "version"),
    commitSha: required(input.commitSha, "commitSha"),
    artifactRef: required(input.artifactRef, "artifactRef"),
    healthPath: required(input.healthPath, "healthPath"),
    sovereigntyDecisionRef: input.sovereigntyDecisionRef?.trim() ?? "",
    desiredHostname: input.desiredHostname?.trim() || undefined
  };

  if (request.environment === "production" && !request.sovereigntyDecisionRef) {
    throw new Error("DEPLOYBOT_SOVEREIGNTY_REQUIRED: production requires sovereigntyDecisionRef");
  }

  return request;
}

export function evaluateDeployment(input: {
  request: DeploymentRequest;
  providerEvidence?: ProviderDeploymentEvidence;
}): DeploymentEvaluation {
  const request = compileDeploymentRequest(input.request);
  const evidence = input.providerEvidence;

  if (!evidence) {
    return {
      state: "PROVIDER_PENDING",
      request,
      nextAction: "Execute the authorized provider adapter and collect deployment evidence."
    };
  }

  if (evidence.provider !== request.provider) {
    throw new Error("DEPLOYBOT_PROVIDER_MISMATCH: provider evidence does not match deployment request");
  }

  if (required(evidence.deployedCommitSha, "deployedCommitSha") !== request.commitSha) {
    throw new Error("DEPLOYBOT_COMMIT_MISMATCH: deployed provider commit differs from requested commit");
  }

  required(evidence.deploymentId, "deploymentId");
  required(evidence.deploymentUrl, "deploymentUrl");
  required(evidence.deployedAt, "deployedAt");

  if (evidence.providerStatus === "failed") {
    return {
      state: "DEPLOYMENT_FAILED",
      request,
      providerEvidence: evidence,
      nextAction: "Preserve provider logs, correct the deployment and recompile a new attempt."
    };
  }

  if (evidence.providerStatus === "rolled_back") {
    return {
      state: "ROLLED_BACK",
      request,
      providerEvidence: evidence,
      nextAction: "Archive rollback evidence and open a new deployment attempt only after correction."
    };
  }

  return {
    state: request.desiredHostname ? "DOMAIN_PENDING" : "VERIFYING",
    request,
    providerEvidence: evidence,
    nextAction: request.desiredHostname
      ? "Compile and verify the canonical domain intent."
      : "Run health and release verification."
  };
}
