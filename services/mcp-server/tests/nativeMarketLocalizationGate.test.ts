import { describe, expect, test } from "vitest";
import { evaluateNativeMarketLocalization } from "../src/nativeMarketLocalizationGate";

describe("GENESIS V4 Native Market Localization Gate", () => {
  test("requires the canonical 16 market-locales for a GLOBAL SaaS", () => {
    const result = evaluateNativeMarketLocalization({ marketScope: "GLOBAL" });

    expect(result.decision).toBe("PASS");
    expect(result.requiredLocales).toEqual([
      "hi-IN",
      "zh-CN",
      "en-US",
      "id-ID",
      "ur-PK",
      "en-NG",
      "pt-BR",
      "bn-BD",
      "ru-RU",
      "am-ET",
      "es-MX",
      "ja-JP",
      "ar-EG",
      "fil-PH",
      "fr-CD",
      "vi-VN"
    ]);
  });
});
