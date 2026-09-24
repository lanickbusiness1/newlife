function cleanText(value, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function redactCardLikeNumbers(value) {
  return value.replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted-card-like-number]");
}

export function sanitizeEvidenceRecord(input = {}) {
  return Object.freeze({
    id: cleanText(input.id, 80) || "evidence-" + Date.now(),
    seller: cleanText(input.seller, 120),
    reference: cleanText(input.reference, 120),
    receiptNote: redactCardLikeNumbers(cleanText(input.receiptNote, 500)),
    createdAt: cleanText(input.createdAt, 40) || new Date().toISOString()
  });
}

export function assessTicketRisk(text = "") {
  const value = cleanText(text, 1000).toLowerCase();
  const checks = [
    ["guaranteed-ticket", /guaranteed|garanti|garantizado|garantido/],
    ["credential-request", /password|mot de passe|contraseña|senha/],
    ["card-data-request", /card number|numéro de carte|numero de tarjeta|número do cartão|cvv/],
    ["crypto-only", /crypto only|bitcoin only|usdt only|paiement crypto uniquement/],
    ["urgency-pressure", /pay now|urgent payment|paie maintenant|paiement urgent/]
  ];
  const signals = checks.filter(([, regex]) => regex.test(value)).map(([name]) => name);
  const level = signals.length >= 2 ? "HIGH" : signals.length === 1 ? "MEDIUM" : "LOW";
  return Object.freeze({ level, signals });
}
