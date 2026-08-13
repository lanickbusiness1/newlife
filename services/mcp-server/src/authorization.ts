import type { BoundRequestContext } from "./auth.js";

export const GENESIS_AUTHZ_ANCHOR = "GEN-V4-ASIR-AUTHZ-001" as const;

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
