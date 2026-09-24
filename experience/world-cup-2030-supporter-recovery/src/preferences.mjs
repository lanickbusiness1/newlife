export const SUPPORTED_LANGUAGES = Object.freeze(["fr", "en", "es", "pt", "ar"]);
export const HOST_FOCUS_OPTIONS = Object.freeze(["Morocco", "Portugal", "Spain", "Argentina", "Paraguay", "Uruguay"]);

export const DEFAULT_PREFERENCES = Object.freeze({
  language: "fr",
  hostFocus: "Morocco",
  dataSaver: false
});

export function normalizePreferences(input) {
  if (!input || typeof input !== "object") return { ...DEFAULT_PREFERENCES };
  if (!SUPPORTED_LANGUAGES.includes(input.language)) return { ...DEFAULT_PREFERENCES };
  return {
    language: input.language,
    hostFocus: HOST_FOCUS_OPTIONS.includes(input.hostFocus) ? input.hostFocus : DEFAULT_PREFERENCES.hostFocus,
    dataSaver: input.dataSaver === true
  };
}
