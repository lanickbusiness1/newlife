import test from "node:test";
import assert from "node:assert/strict";
import { hostDataset, qualifiedHostTeams, validateHostDataset } from "../src/hosts.mjs";

test("2030 host dataset is source-proven and complete", () => {
  const result = validateHostDataset(hostDataset);
  assert.equal(result.ok, true);
  assert.equal(hostDataset.eventYear, 2030);
  assert.equal(hostDataset.mainHosts.length, 3);
  assert.equal(hostDataset.centenaryHosts.length, 3);
  assert.equal(qualifiedHostTeams.length, 6);
});

test("all six host/centenary teams carry qualification proof", () => {
  for (const team of qualifiedHostTeams) {
    assert.equal(team.status, "QUALIFIED");
    assert.match(team.sourceUrl, /^https:\/\/(www\.)?fifa\.com|^https:\/\/inside\.fifa\.com/);
    assert.equal(Number.isNaN(Date.parse(team.verifiedAt)), false);
  }
});
