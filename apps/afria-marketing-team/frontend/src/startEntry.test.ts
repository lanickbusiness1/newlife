import { describe, expect, test } from "vitest";
import {
  START_CAPABILITIES,
  buildFreePreview,
  buildStartEntryPath,
  getStartCapability
} from "./startEntry";

describe("Low-Friction Capability-to-Cash Entry", () => {
  test("exposes exactly the four CEO-validated entry capabilities", () => {
    expect(START_CAPABILITIES.map(capability => capability.id)).toEqual([
      "prospect",
      "call-intelligence",
      "proposal",
      "signal"
    ]);
  });

  test("keeps the public front door on /start", () => {
    expect(buildStartEntryPath()).toBe("/start");
  });

  test("generates a bounded free preview without inventing commercial figures", () => {
    const preview = buildFreePreview(
      "proposal",
      "Entreprise: Kora Logistics. Besoin: réduire les retards de livraison. Aucun budget communiqué."
    );

    expect(preview.title).toContain("AfrIA Proposal");
    expect(preview.output).toContain("Kora Logistics");
    expect(preview.output).toContain("réduire les retards de livraison");
    expect(preview.output).toContain("À confirmer");
    expect(preview.output).not.toMatch(/\b\d+[\s.,]?\d*\s*(FCFA|USD|EUR|€|\$)\b/i);
    expect(preview.isBoundedFreePreview).toBe(true);
  });

  test("returns a clear capability contract for conversion into paid execution", () => {
    const capability = getStartCapability("prospect");

    expect(capability.name).toBe("AfrIA Prospect");
    expect(capability.freePromise.length).toBeGreaterThan(10);
    expect(capability.paidCta).toMatch(/acheter|activer/i);
    expect(capability.bundleCta).toContain("Starter Pack");
  });
});
