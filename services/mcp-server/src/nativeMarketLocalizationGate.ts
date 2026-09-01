export type MarketScope = "GLOBAL" | "AFRICA";

export const GLOBAL_100M_MARKET_LOCALES = [
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
] as const;

export type NativeMarketLocalizationInput = {
  marketScope: MarketScope;
};

export type NativeMarketLocalizationResult = {
  decision: "PASS";
  requiredLocales: readonly string[];
};

export function evaluateNativeMarketLocalization(
  input: NativeMarketLocalizationInput
): NativeMarketLocalizationResult {
  if (input.marketScope === "GLOBAL") {
    return {
      decision: "PASS",
      requiredLocales: GLOBAL_100M_MARKET_LOCALES
    };
  }

  return {
    decision: "PASS",
    requiredLocales: []
  };
}
