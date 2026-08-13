import { createHash } from "node:crypto";
import type { Stratex99Context } from "./skillFactory.js";

export const GENESIS_CONTEXT_PACK_PROVENANCE_VERSION =
  "GENESIS_CONTEXT_PACK_PROVENANCE_0.1.0" as const;

export interface ContextPackSource {
  sourceId: string;
  publisher: string;
  locator: string;
  retrievedAt: string;
  sha256?: string;
}

export interface ContextPackProvenance {
  provenanceVersion: typeof GENESIS_CONTEXT_PACK_PROVENANCE_VERSION;
  contextPackId: string;
  version: string;
  countryCode: string;
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  sources: ContextPackSource[];
  contextSha256: string;
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
}

export function fingerprintContextPack(context: Stratex99Context): string {
  return createHash("sha256").update(canonicalJson(context), "utf8").digest("hex");
}

export function verifyContextPackProvenance(
  provenance: ContextPackProvenance | undefined,
  expectedCountryCode: string,
  context: Stratex99Context,
  now = Date.now()
): ContextPackProvenance {
  if (!provenance) throw new Error("CONTEXT_PACK_PROVENANCE_REQUIRED");
  if (provenance.provenanceVersion !== GENESIS_CONTEXT_PACK_PROVENANCE_VERSION) {
    throw new Error("CONTEXT_PACK_PROVENANCE_INVALID");
  }
  if (!/^\d+\.\d+\.\d+$/.test(provenance.version)) throw new Error("CONTEXT_PACK_PROVENANCE_INVALID");
  if (!/^[a-z0-9][a-z0-9._-]{2,127}$/.test(provenance.contextPackId)) throw new Error("CONTEXT_PACK_PROVENANCE_INVALID");
  if (!Number.isFinite(Date.parse(provenance.issuedAt)) || !Number.isFinite(Date.parse(provenance.expiresAt))) {
    throw new Error("CONTEXT_PACK_PROVENANCE_INVALID");
  }
  const countryCode = provenance.countryCode.trim().toUpperCase();
  const expected = expectedCountryCode.trim().toUpperCase();
  if (countryCode !== expected) throw new Error("CONTEXT_PACK_COUNTRY_MISMATCH");
  if (now >= Date.parse(provenance.expiresAt)) throw new Error("CONTEXT_PACK_EXPIRED");
  if (provenance.sources.length === 0) throw new Error("CONTEXT_PACK_SOURCES_REQUIRED");
  if (provenance.contextSha256 !== fingerprintContextPack(context)) {
    throw new Error("CONTEXT_PACK_INTEGRITY_MISMATCH");
  }
  return { ...provenance, countryCode };
}
