import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PREFERENCES, normalizePreferences, SUPPORTED_LANGUAGES } from "../src/preferences.mjs";

test("preferences fail safely to defaults", () => {
  assert.deepEqual(normalizePreferences(null), DEFAULT_PREFERENCES);
  assert.deepEqual(normalizePreferences({ language: "xx" }), DEFAULT_PREFERENCES);
});

test("supported language and host focus are retained", () => {
  const result = normalizePreferences({ language: "en", hostFocus: "Morocco", dataSaver: true });
  assert.equal(SUPPORTED_LANGUAGES.includes(result.language), true);
  assert.equal(result.language, "en");
  assert.equal(result.hostFocus, "Morocco");
  assert.equal(result.dataSaver, true);
});
