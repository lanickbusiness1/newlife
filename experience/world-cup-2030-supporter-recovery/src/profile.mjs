function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function uniqueStrings(values, maxItems) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const clean = cleanText(value, 40);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= maxItems) break;
  }
  return result;
}

export const DEFAULT_PROFILE = Object.freeze({
  nickname: "",
  country: "",
  favoriteTeams: [],
  notifications: false
});

export function normalizeSupporterProfile(input) {
  if (!input || typeof input !== "object") return { ...DEFAULT_PROFILE, favoriteTeams: [] };
  return {
    nickname: cleanText(input.nickname, 40),
    country: cleanText(input.country, 40),
    favoriteTeams: uniqueStrings(input.favoriteTeams, 5),
    notifications: input.notifications === true
  };
}

export function isProfileReady(profile) {
  const normalized = normalizeSupporterProfile(profile);
  return Boolean(normalized.nickname && normalized.country);
}
