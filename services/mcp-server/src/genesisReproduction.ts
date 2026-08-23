export const GENESIS_V4_REPRODUCTION_ENGINE_ANCHOR =
  "GEN-V4-REPRODUCTION-ENGINE-001" as const;

export interface GenesisCoreIdentity {
  id: "GENESIS";
  genomeVersion: string;
  authorityRef: string;
  inheritedSystems: string[];
  universalInvariants: Record<string, unknown>;
}

const REQUIRED_GENESIS_SYSTEMS = [
  "GENOME",
  "DFM",
  "TRM",
  "STRATEX-99",
  "GOIR",
  "ECES",
  "M6",
  "S7+",
  "M8",
  "R.E.M.E"
] as const;

export function validateGenesisCoreIdentity(
  identity: GenesisCoreIdentity
): GenesisCoreIdentity {
  if (identity.id !== "GENESIS") {
    throw new Error("GENESIS_CORE_ID_INVALID");
  }

  for (const system of REQUIRED_GENESIS_SYSTEMS) {
    if (!identity.inheritedSystems.includes(system)) {
      throw new Error(`GENESIS_CORE_INCOMPLETE:${system}`);
    }
  }

  return identity;
}
