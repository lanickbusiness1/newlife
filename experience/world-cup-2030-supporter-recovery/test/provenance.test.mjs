import test from "node:test";
import assert from "node:assert/strict";
import { validateCompetitionPayload, promoteCompetitionPayload } from "../src/provenance.mjs";

const verifiedSource = {
  provider: "official-source-placeholder",
  sourceUrl: "https://example.org/official-source",
  verifiedAt: "2026-09-24T19:50:00Z"
};

test("competition payload is rejected without provenance", () => {
  const result = validateCompetitionPayload({
    eventYear: 2030,
    teams: [{ name: "Example", status: "QUALIFIED" }]
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /provenance/i);
});

test("wrong tournament year is rejected", () => {
  const result = validateCompetitionPayload({
    eventYear: 2026,
    provenance: verifiedSource,
    teams: []
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /2030/);
});

test("verified 2030 payload can be promoted", () => {
  const payload = {
    eventYear: 2030,
    provenance: verifiedSource,
    teams: [],
    fixtures: []
  };
  assert.equal(validateCompetitionPayload(payload).ok, true);
  const promoted = promoteCompetitionPayload(payload);
  assert.equal(promoted.truthState, "SOURCE_PROVEN");
  assert.equal(promoted.eventYear, 2030);
});

test("promotion never mutates the source payload", () => {
  const payload = {
    eventYear: 2030,
    provenance: verifiedSource,
    teams: [],
    fixtures: []
  };
  promoteCompetitionPayload(payload);
  assert.equal("truthState" in payload, false);
});
