import test from "node:test";
import assert from "node:assert/strict";
import {
  recoveryManifest,
  surfaces,
  tournamentState,
  canPromoteQualification,
  tournamentNotice
} from "../src/model.mjs";

test("recovery artifact targets 2030 and remains non-canonical", () => {
  assert.equal(recoveryManifest.targetYear, 2030);
  assert.equal(recoveryManifest.canonicalIdentity, "UNRESOLVED");
  assert.equal(recoveryManifest.sourceRecovery, "NOT_RECOVERED");
  assert.equal(recoveryManifest.productTruth, "RECOVERY_ARTIFACT");
  assert.equal(recoveryManifest.officialBranding, false);
});

test("no tournament facts are invented", () => {
  assert.deepEqual(tournamentState.teams, []);
  assert.deepEqual(tournamentState.fixtures, []);
  assert.deepEqual(tournamentState.qualification, []);
  assert.equal(tournamentState.source, null);
  assert.match(tournamentNotice(), /aucune qualification/i);
});

test("qualification promotion is fail-closed", () => {
  assert.equal(canPromoteQualification({ team: "Example", status: "QUALIFIED" }), false);
  assert.equal(canPromoteQualification({
    team: "Example",
    status: "QUALIFIED",
    sourceUrl: "https://example.org/source",
    verifiedAt: "2026-09-24T00:00:00Z"
  }), true);
});

test("historical functional surfaces are represented", () => {
  const ids = new Set(surfaces.map((surface) => surface.id));
  for (const id of ["home", "matches", "community", "travel", "vault", "assistant"]) {
    assert.equal(ids.has(id), true);
  }
});
