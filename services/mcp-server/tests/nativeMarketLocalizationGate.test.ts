import { describe, expect, test } from "vitest";
import {
  AFRICA_100M_MARKET_LOCALES,
  GLOBAL_100M_MARKET_LOCALES,
  evaluateNativeMarketLocalization
} from "../src/nativeMarketLocalizationGate";

function proven(locale: string) {
  return {
    locale,
    translationComplete: true,
    uiRenderPassed: true,
    e2ePassed: true,
    rtlPassed: locale === "ar-EG" ? true : undefined
  };
}

describe("GENESIS V4 Native Market Localization Gate", () => {
  test("requires the canonical 16 market-locales for a GLOBAL SaaS and holds without evidence", () => {
    const result = evaluateNativeMarketLocalization({ marketScope: "GLOBAL" });

    expect(result.decision).toBe("HOLD");
    expect(result.canPromoteM6).toBe(false);
    expect(result.requiredLocales).toEqual(GLOBAL_100M_MARKET_LOCALES);
    expect(result.requiredLocales).toHaveLength(16);
  });

  test("requires the four African >100M market-locales for an AFRICA SaaS", () => {
    const result = evaluateNativeMarketLocalization({ marketScope: "AFRICA" });

    expect(result.requiredLocales).toEqual([
      "en-NG",
      "am-ET",
      "ar-EG",
      "fr-CD"
    ]);
    expect(result.requiredLocales).toEqual(AFRICA_100M_MARKET_LOCALES);
  });

  test("passes GLOBAL only when every mandatory locale is test-proven", () => {
    const result = evaluateNativeMarketLocalization({
      marketScope: "GLOBAL",
      localeEvidence: GLOBAL_100M_MARKET_LOCALES.map(proven)
    });

    expect(result.decision).toBe("PASS");
    expect(result.canPromoteM6).toBe(true);
    expect(result.missingLocales).toEqual([]);
    expect(result.unprovenLocales).toEqual([]);
  });

  test("fails closed when Arabic RTL proof is absent", () => {
    const evidence = GLOBAL_100M_MARKET_LOCALES.map(proven).map(item =>
      item.locale === "ar-EG" ? { ...item, rtlPassed: false } : item
    );

    const result = evaluateNativeMarketLocalization({
      marketScope: "GLOBAL",
      localeEvidence: evidence
    });

    expect(result.decision).toBe("HOLD");
    expect(result.canPromoteM6).toBe(false);
    expect(result.blockers).toContain("RTL_NOT_PROVEN:ar-EG");
  });

  test("fails closed on malformed input instead of throwing", () => {
    const result = evaluateNativeMarketLocalization(null);

    expect(result.decision).toBe("INVALID_INPUT");
    expect(result.canPromoteM6).toBe(false);
    expect(result.blockers).toContain("INVALID_INPUT");
  });
});
