import { describe, expect, test } from "vitest";
import { CASH_ACTIVATION, buildWhatsAppActivationLink, summarizeDayOneTarget } from "./activation";

describe("cash activation operating kit", () => {
  test("sets AfrIA Marketing Team as ready to sell with no imaginary blocker", () => {
    expect(CASH_ACTIVATION.status).toBe("READY_TO_SELL");
    expect(CASH_ACTIVATION.noImaginaryBlockersRule).toContain("activation tasks");
    expect(CASH_ACTIVATION.firstOffer.price).toBe("49 900 FCFA");
    expect(CASH_ACTIVATION.dayOneTarget.revenueFcfa).toBe(199600);
  });

  test("generates a WhatsApp activation link from the canonical primary number", () => {
    const link = buildWhatsAppActivationLink("Test AfrIA Marketing Team");
    expect(link).toContain("https://wa.me/22961107373");
    expect(link).toContain("Test%20AfrIA%20Marketing%20Team");
  });

  test("summarizes the first cash target", () => {
    expect(summarizeDayOneTarget()).toBe("100 prospects → 30 réponses → 10 diagnostics → 4 ventes → 199 600 FCFA");
  });
});
