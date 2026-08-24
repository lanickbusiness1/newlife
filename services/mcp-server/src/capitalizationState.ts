export type CapitalizationStateConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
};

type FetchLike = typeof fetch;

function required(value: unknown, code: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(code);
  }
  return value.trim();
}

function normalizedBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export async function loadAuthoritativeCapitalizationFingerprints(
  tenantId: string,
  config: CapitalizationStateConfig,
  fetchImpl: FetchLike = fetch
): Promise<string[]> {
  const tenant = required(tenantId, "CAPITALIZATION_DEDUP_TENANT_REQUIRED");
  const supabaseUrl = normalizedBaseUrl(required(config?.supabaseUrl, "CAPITALIZATION_DEDUP_STATE_UNAVAILABLE"));
  const serviceRoleKey = required(config?.serviceRoleKey, "CAPITALIZATION_DEDUP_STATE_UNAVAILABLE");

  let response: Response;
  try {
    response = await fetchImpl(
      `${supabaseUrl}/rest/v1/rpc/genesis_capitalization_known_fingerprints`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ p_tenant_id: tenant })
      }
    );
  } catch {
    throw new Error("CAPITALIZATION_DEDUP_STATE_UNAVAILABLE");
  }

  if (!response.ok) {
    throw new Error("CAPITALIZATION_DEDUP_STATE_UNAVAILABLE");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("CAPITALIZATION_DEDUP_STATE_UNAVAILABLE");
  }

  if (!Array.isArray(payload) || !payload.every(value => typeof value === "string")) {
    throw new Error("CAPITALIZATION_DEDUP_STATE_UNAVAILABLE");
  }

  return [...new Set(payload.map(value => value.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}
