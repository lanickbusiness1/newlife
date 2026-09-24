const SOURCE_URL = "https://www.fifa.com/en/tournaments/mens/worldcup/articles/world-cup-2030-hosts-qualified-bidding-spain-argentina-morocco-uruguay-portugal-paraguay";
const VERIFIED_AT = "2026-09-24T20:20:00Z";

function record(country, role, continent) {
  return Object.freeze({
    country,
    role,
    continent,
    autoQualified: true,
    sourceUrl: SOURCE_URL,
    verifiedAt: VERIFIED_AT
  });
}

export const hostDataset = Object.freeze({
  eventYear: 2030,
  truthState: "SOURCE_PROVEN",
  source: Object.freeze({
    provider: "FIFA",
    sourceUrl: SOURCE_URL,
    verifiedAt: VERIFIED_AT
  }),
  mainHosts: Object.freeze([
    record("Morocco", "HOST", "Africa"),
    record("Portugal", "HOST", "Europe"),
    record("Spain", "HOST", "Europe")
  ]),
  centenaryHosts: Object.freeze([
    record("Argentina", "CENTENARY_MATCH_HOST", "South America"),
    record("Paraguay", "CENTENARY_MATCH_HOST", "South America"),
    record("Uruguay", "CENTENARY_MATCH_HOST", "South America")
  ])
});

export const qualifiedHostTeams = Object.freeze(
  [...hostDataset.mainHosts, ...hostDataset.centenaryHosts].map((item) =>
    Object.freeze({
      team: item.country,
      status: "QUALIFIED",
      basis: item.role === "HOST" ? "HOST_AUTOMATIC" : "CENTENARY_HOST_AUTOMATIC",
      sourceUrl: item.sourceUrl,
      verifiedAt: item.verifiedAt
    })
  )
);

function fifaSource(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "fifa.com" || host.endsWith(".fifa.com");
  } catch {
    return false;
  }
}

export function validateHostDataset(dataset) {
  if (!dataset || dataset.eventYear !== 2030) return { ok: false, reason: "eventYear must be 2030" };
  if (dataset.truthState !== "SOURCE_PROVEN") return { ok: false, reason: "host dataset must be source-proven" };
  if (!Array.isArray(dataset.mainHosts) || dataset.mainHosts.length !== 3) return { ok: false, reason: "three main hosts required" };
  if (!Array.isArray(dataset.centenaryHosts) || dataset.centenaryHosts.length !== 3) return { ok: false, reason: "three centenary hosts required" };
  const all = [...dataset.mainHosts, ...dataset.centenaryHosts];
  if (new Set(all.map((item) => item.country)).size !== 6) return { ok: false, reason: "six unique countries required" };
  if (!all.every((item) => item.autoQualified && fifaSource(item.sourceUrl) && !Number.isNaN(Date.parse(item.verifiedAt)))) {
    return { ok: false, reason: "every host record requires current FIFA provenance" };
  }
  return { ok: true, reason: null };
}
