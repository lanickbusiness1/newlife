import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROFILE, normalizeSupporterProfile, isProfileReady } from "../src/profile.mjs";

test("supporter profile defaults to privacy-preserving local identity", () => {
  const profile = normalizeSupporterProfile(null);
  assert.deepEqual(profile, DEFAULT_PROFILE);
  assert.equal(isProfileReady(profile), false);
});

test("supporter profile keeps only allowed local fields", () => {
  const profile = normalizeSupporterProfile({
    nickname: "  Lanick  ",
    country: "Benin",
    favoriteTeams: ["Benin", "Morocco", "Benin", "Brazil", "France", "Mali", "Guinea"],
    notifications: true,
    email: "private@example.com",
    phone: "+22300000000"
  });
  assert.equal(profile.nickname, "Lanick");
  assert.equal(profile.country, "Benin");
  assert.deepEqual(profile.favoriteTeams, ["Benin", "Morocco", "Brazil", "France", "Mali"]);
  assert.equal(profile.notifications, true);
  assert.equal("email" in profile, false);
  assert.equal("phone" in profile, false);
  assert.equal(isProfileReady(profile), true);
});
