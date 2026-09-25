import test from "node:test";
import assert from "node:assert/strict";
import { validateApiEnvelope } from "../src/api-envelope.mjs";

test("API envelope fails closed without source provenance", () => {
  const result = validateApiEnvelope({ eventYear: 2030, data: [] });
  assert.equal(result.ok, false);
  assert.match(result.reason, /provenance/i);
});

test("API envelope accepts only 2030 HTTPS-sourced snapshots", () => {
  const result = validateApiEnvelope({
    eventYear: 2030,
    provenance: {
      provider: "official-provider",
      sourceUrl: "https://example.org/source",
      verifiedAt: "2026-09-25T06:30:00Z"
    },
    data: []
  });
  assert.equal(result.ok, true);

  const wrongYear = validateApiEnvelope({
    eventYear: 2026,
    provenance: {
      provider: "official-provider",
      sourceUrl: "https://example.org/source",
      verifiedAt: "2026-09-25T06:30:00Z"
    },
    data: []
  });
  assert.equal(wrongYear.ok, false);
});
