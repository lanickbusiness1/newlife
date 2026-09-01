import { z } from "zod";

export const GENESIS_V4_NATIVE_MARKET_LOCALIZATION_ANCHOR = {
  assetId: "GEN-V4-NATIVE-MARKET-LOCALIZATION-GATE-001",
  decisionId: "V4-DEC-029",
  version: "0.1.0",
  proofMode: "deterministic-fail-closed"
} as const;

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

export const AFRICA_100M_MARKET_LOCALES = [
  "en-NG",
  "am-ET",
  "ar-EG",
  "fr-CD"
] as const;

const LocaleEvidenceSchema = z.object({
  locale: z.string().min(2),
  translationComplete: z.boolean(),
  uiRenderPassed: z.boolean(),
  e2ePassed: z.boolean(),
  rtlPassed: z.boolean().optional()
});

const NativeMarketLocalizationInputSchema = z.object({
  marketScope: z.enum(["GLOBAL", "AFRICA"]),
  localeEvidence: z.array(LocaleEvidenceSchema).optional()
});

export type NativeMarketLocalizationInput = z.infer<typeof NativeMarketLocalizationInputSchema>;
export type LocaleEvidence = z.infer<typeof LocaleEvidenceSchema>;
export type NativeMarketLocalizationDecision = "PASS" | "HOLD" | "INVALID_INPUT";

export type NativeMarketLocalizationResult = {
  assetId: typeof GENESIS_V4_NATIVE_MARKET_LOCALIZATION_ANCHOR.assetId;
  decisionId: typeof GENESIS_V4_NATIVE_MARKET_LOCALIZATION_ANCHOR.decisionId;
  decision: NativeMarketLocalizationDecision;
  canPromoteM6: boolean;
  requiredLocales: readonly string[];
  missingLocales: string[];
  unprovenLocales: string[];
  blockers: string[];
};

function invalidResult(): NativeMarketLocalizationResult {
  return {
    assetId: GENESIS_V4_NATIVE_MARKET_LOCALIZATION_ANCHOR.assetId,
    decisionId: GENESIS_V4_NATIVE_MARKET_LOCALIZATION_ANCHOR.decisionId,
    decision: "INVALID_INPUT",
    canPromoteM6: false,
    requiredLocales: [],
    missingLocales: [],
    unprovenLocales: [],
    blockers: ["INVALID_INPUT"]
  };
}

export function evaluateNativeMarketLocalization(input: unknown): NativeMarketLocalizationResult {
  const parsed = NativeMarketLocalizationInputSchema.safeParse(input);
  if (!parsed.success) return invalidResult();

  const requiredLocales = parsed.data.marketScope === "GLOBAL"
    ? GLOBAL_100M_MARKET_LOCALES
    : AFRICA_100M_MARKET_LOCALES;

  const evidenceByLocale = new Map(
    (parsed.data.localeEvidence ?? []).map(item => [item.locale, item])
  );

  const missingLocales = requiredLocales.filter(locale => !evidenceByLocale.has(locale));
  const unprovenLocales = requiredLocales.filter(locale => {
    const evidence = evidenceByLocale.get(locale);
    if (!evidence) return false;
    return !evidence.translationComplete || !evidence.uiRenderPassed || !evidence.e2ePassed;
  });

  const blockers = [
    ...missingLocales.map(locale => `MISSING_LOCALE_EVIDENCE:${locale}`),
    ...unprovenLocales.map(locale => `LOCALE_NOT_TEST_PROVEN:${locale}`)
  ];

  const arabicEvidence = evidenceByLocale.get("ar-EG");
  if (requiredLocales.includes("ar-EG") && arabicEvidence && arabicEvidence.rtlPassed !== true) {
    blockers.push("RTL_NOT_PROVEN:ar-EG");
  }

  const decision: NativeMarketLocalizationDecision = blockers.length === 0 ? "PASS" : "HOLD";

  return {
    assetId: GENESIS_V4_NATIVE_MARKET_LOCALIZATION_ANCHOR.assetId,
    decisionId: GENESIS_V4_NATIVE_MARKET_LOCALIZATION_ANCHOR.decisionId,
    decision,
    canPromoteM6: decision === "PASS",
    requiredLocales,
    missingLocales: [...missingLocales],
    unprovenLocales: [...unprovenLocales],
    blockers
  };
}
