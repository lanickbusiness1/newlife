const TARGET_YEAR = 2030;

function validHttpsUrl(value) {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function validateApiEnvelope(envelope) {
  if (!envelope || typeof envelope !== "object") return { ok: false, reason: "envelope required" };
  if (envelope.eventYear !== TARGET_YEAR) return { ok: false, reason: "eventYear must be 2030" };

  const provenance = envelope.provenance;
  if (
    !provenance ||
    typeof provenance.provider !== "string" ||
    !provenance.provider.trim() ||
    !validHttpsUrl(provenance.sourceUrl) ||
    typeof provenance.verifiedAt !== "string" ||
    Number.isNaN(Date.parse(provenance.verifiedAt))
  ) {
    return { ok: false, reason: "verified provenance is required" };
  }

  if (!Array.isArray(envelope.data)) return { ok: false, reason: "data must be an array" };
  return { ok: true, reason: null };
}
