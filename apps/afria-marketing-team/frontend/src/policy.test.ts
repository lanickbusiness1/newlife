import { describe, expect, test } from "vitest";
import { simulatePolicy } from "./policy";

describe("S7+ policy simulation", () => {
  test("allows generation without human approval", () => {
    expect(simulatePolicy("GENERATE", { humanApproved: false }).state).toBe("allowed");
  });

  test("requires human approval for SEND PAY DELETE EXPORT", () => {
    for (const capability of ["SEND", "PAY", "DELETE", "EXPORT"] as const) {
      const decision = simulatePolicy(capability, { humanApproved: false });
      expect(decision.state).toBe("needs_human");
      expect(decision.reason).toContain("human approval required");
    }
  });

  test("blocks any capability when kill switch is active", () => {
    expect(simulatePolicy("GENERATE", { humanApproved: true, killSwitchActive: true }).state).toBe("blocked");
  });
});
