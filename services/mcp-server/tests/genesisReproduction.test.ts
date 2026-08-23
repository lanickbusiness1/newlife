import { describe, expect, it } from "vitest";
import {
  validateGenesisCoreIdentity,
  type GenesisCoreIdentity
} from "../src/genesisReproduction.js";

const core: GenesisCoreIdentity = {
  id: "GENESIS",
  genomeVersion: "4.0.0",
  authorityRef: "notion:genome:3b0cdd91-020e-818c-af3b-d4593c037f14",
  inheritedSystems: [
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
  ],
  universalInvariants: {
    sovereignContextRequired: true,
    remeReturnRequired: true
  }
};

describe("GENESIS V4 reproduction core identity", () => {
  it("accepts a reproduction-capable GENESIS core", () => {
    expect(validateGenesisCoreIdentity(core)).toEqual(core);
  });

  it("rejects a GENESIS core missing M8", () => {
    expect(() =>
      validateGenesisCoreIdentity({
        ...core,
        inheritedSystems: core.inheritedSystems.filter(value => value !== "M8")
      })
    ).toThrow("GENESIS_CORE_INCOMPLETE:M8");
  });

  it("rejects a non-GENESIS root identity", () => {
    expect(() =>
      validateGenesisCoreIdentity({
        ...core,
        id: "AFRIAGENESIS" as "GENESIS"
      })
    ).toThrow("GENESIS_CORE_ID_INVALID");
  });
});
