export const OUTBOX_LIMIT = 20;
const ALLOWED_TYPES = new Set(["COMMUNITY_DRAFT", "WATCH_PARTY_INTEREST", "PROFILE_SYNC"]);

function cleanText(value, max = 280) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function sanitizePayload(type, payload = {}) {
  if (type === "COMMUNITY_DRAFT") {
    return Object.freeze({ text: cleanText(payload.text, 280) });
  }
  if (type === "WATCH_PARTY_INTEREST") {
    return Object.freeze({
      host: cleanText(payload.host, 40),
      note: cleanText(payload.note, 160)
    });
  }
  if (type === "PROFILE_SYNC") {
    return Object.freeze({
      nickname: cleanText(payload.nickname, 40),
      country: cleanText(payload.country, 40)
    });
  }
  return null;
}

export function normalizeOutbox(queue) {
  if (!Array.isArray(queue)) return [];
  return queue
    .filter((item) => item && ALLOWED_TYPES.has(item.type) && item.payload && typeof item.payload === "object")
    .slice(-OUTBOX_LIMIT)
    .map((item) => Object.freeze({
      id: String(item.id || ""),
      type: item.type,
      payload: sanitizePayload(item.type, item.payload),
      createdAt: String(item.createdAt || "")
    }));
}

export function queueOfflineAction(queue, action) {
  if (!action || !ALLOWED_TYPES.has(action.type)) return normalizeOutbox(queue);
  const payload = sanitizePayload(action.type, action.payload);
  const item = Object.freeze({
    id: String(action.id || "outbox-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8)),
    type: action.type,
    payload,
    createdAt: String(action.createdAt || new Date().toISOString())
  });
  return normalizeOutbox(normalizeOutbox(queue).concat(item));
}
