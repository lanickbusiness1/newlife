const TARGET_YEAR = 2030;

function validHttpsUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function validTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function validateCompetitionPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "payload required" };
  }

  if (payload.eventYear !== TARGET_YEAR) {
    return { ok: false, reason: "eventYear must be 2030" };
  }

  const provenance = payload.provenance;
  if (
    !provenance ||
    typeof provenance.provider !== "string" ||
    !provenance.provider.trim() ||
    !validHttpsUrl(provenance.sourceUrl) ||
    !validTimestamp(provenance.verifiedAt)
  ) {
    return { ok: false, reason: "verified provenance is required" };
  }

  if (payload.teams != null && !Array.isArray(payload.teams)) {
    return { ok: false, reason: "teams must be an array" };
  }

  if (payload.fixtures != null && !Array.isArray(payload.fixtures)) {
    return { ok: false, reason: "fixtures must be an array" };
  }

  return { ok: true, reason: null };
}

export function promoteCompetitionPayload(payload) {
  const validation = validateCompetitionPayload(payload);
  if (!validation.ok) {
    throw new Error(`competition payload rejected: ${validation.reason}`);
  }

  return Object.freeze({
    ...structuredClone(payload),
    truthState: "SOURCE_PROVEN"
  });
}
