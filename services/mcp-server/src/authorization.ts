import type { BoundRequestContext } from "./auth.js";

export const GENESIS_AUTHZ_ANCHOR = "GEN-V4-ASIR-AUTHZ-001" as const;

export interface TerritorialTarget {
  countries?: string[];
  organizations?: string[];
  missions?: string[];
}

export function authorizeContext(ctx: BoundRequestContext, requiredScope: string): void {
  if (!ctx.permissionScope.includes(requiredScope)) {
    throw new Error(`ECES_DENY: scope '${requiredScope}' absent`);
  }

  if (ctx.dataClassification === "restricted") {
    if (!ctx.permissionScope.includes("data:restricted")) {
      throw new Error("ECES_DENY: scope 'data:restricted' absent");
    }
    if (!ctx.approvalContext) {
      throw new Error("ECES_REVIEW_REQUIRED: approvalContext absent");
    }
  }
}

function allowed(target: string, attributes: string[], normalizer: (value: string) => string): boolean {
  if (attributes.includes("*")) return true;
  const normalizedTarget = normalizer(target);
  return attributes.some(value => normalizer(value) === normalizedTarget);
}

export function authorizeTerritorialTarget(ctx: BoundRequestContext, target: TerritorialTarget): void {
  for (const country of target.countries ?? []) {
    if (!allowed(country, ctx.allowedCountries, value => value.toUpperCase())) {
      throw new Error(`ECES_ABAC_COUNTRY_DENY:${country.toUpperCase()}`);
    }
  }

  for (const organization of target.organizations ?? []) {
    if (!allowed(organization, ctx.allowedOrganizations, value => value.toUpperCase())) {
      throw new Error(`ECES_ABAC_ORGANIZATION_DENY:${organization}`);
    }
  }

  for (const mission of target.missions ?? []) {
    if (!allowed(mission, ctx.allowedMissions, value => value.toLowerCase())) {
      throw new Error(`ECES_ABAC_MISSION_DENY:${mission}`);
    }
  }
}
