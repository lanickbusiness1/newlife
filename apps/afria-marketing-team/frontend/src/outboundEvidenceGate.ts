export const OUTBOUND_EVIDENCE_GATE = {
  assetId: "OEG-001",
  name: "Outbound Evidence Gate™",
  doctrine:
    "Prepared messages do not change CRM status until external proof exists. Missing WhatsApp, LinkedIn, email, or payment connectivity is an activation task, not a product blocker.",
  strictRules: [
    "Message préparé ≠ Message envoyé",
    "Message envoyé = send_proof obligatoire",
    "Réponse reçue = reply_proof obligatoire",
    "Diagnostic réservé = diagnostic_proof obligatoire",
    "Proposition envoyée = proposal_proof obligatoire",
    "Paiement reçu = payment_proof obligatoire",
    "Canal externe non connecté = activation canal, pas blocage produit"
  ]
} as const;

export type OutboundChannel = "whatsapp" | "email" | "linkedin";
export type OutboundStatus =
  | "prepared"
  | "sent"
  | "replied"
  | "diagnostic_reserved"
  | "proposal_sent"
  | "payment_requested"
  | "paid";
export type OutboundEvidenceKind =
  | "prepared_message"
  | "send_proof"
  | "reply_proof"
  | "diagnostic_proof"
  | "proposal_proof"
  | "payment_request_proof"
  | "payment_proof";

export interface OutboundEvidenceRef {
  kind: OutboundEvidenceKind;
  ref: string;
  capturedAt: string;
}

export interface ProspectOutboundRecord {
  id: string;
  leadName: string;
  company: string;
  country: string;
  segment: string;
  channel: OutboundChannel;
  status: OutboundStatus;
  offer: string;
  amountFcfa: number;
  message: string;
  phone?: string;
  email?: string;
  linkedinUrl?: string;
  evidenceRefs: OutboundEvidenceRef[];
}

export interface EvidenceTransitionDecision {
  allowed: boolean;
  nextStatus: OutboundStatus;
  requiredEvidence: OutboundEvidenceKind[];
  reason: string;
  classification: "evidence_ok" | "evidence_missing" | "manual_review";
}

export interface ChannelActivationDecision {
  channel: OutboundChannel;
  status: "ready" | "activation_required";
  productBlocked: boolean;
  reason: string;
  nextAction: string;
}

export interface OutboundEvidenceSummary {
  totalProspects: number;
  preparedWithoutSendProof: number;
  sentWithProof: number;
  repliesWithProof: number;
  proposalsWithProof: number;
  paymentsWithProof: number;
  verifiedBlockers: string[];
  activationActions: string[];
}

const REQUIRED_EVIDENCE_BY_STATUS: Record<Exclude<OutboundStatus, "prepared">, OutboundEvidenceKind[]> = {
  sent: ["send_proof"],
  replied: ["send_proof", "reply_proof"],
  diagnostic_reserved: ["send_proof", "reply_proof", "diagnostic_proof"],
  proposal_sent: ["send_proof", "reply_proof", "diagnostic_proof", "proposal_proof"],
  payment_requested: ["send_proof", "reply_proof", "diagnostic_proof", "proposal_proof", "payment_request_proof"],
  paid: ["send_proof", "reply_proof", "diagnostic_proof", "proposal_proof", "payment_request_proof", "payment_proof"]
};

export function buildWhatsAppOutboundLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildOutboundDraft(record: ProspectOutboundRecord): string {
  if (record.channel === "whatsapp") {
    if (!record.phone) return "PHONE_REQUIRED_FOR_WHATSAPP_DRAFT";
    return buildWhatsAppOutboundLink(record.phone, record.message);
  }

  if (record.channel === "email") {
    if (!record.email) return "EMAIL_REQUIRED_FOR_EMAIL_DRAFT";
    return `mailto:${record.email}?subject=${encodeURIComponent(record.offer)}&body=${encodeURIComponent(record.message)}`;
  }

  if (!record.linkedinUrl) return "LINKEDIN_URL_REQUIRED_FOR_LINKEDIN_DRAFT";
  return `${record.linkedinUrl} :: ${record.message}`;
}

export function getRequiredEvidenceForStatus(status: OutboundStatus): OutboundEvidenceKind[] {
  if (status === "prepared") return [];
  return REQUIRED_EVIDENCE_BY_STATUS[status];
}

export function canTransitionOutboundStatus(
  record: ProspectOutboundRecord,
  nextStatus: OutboundStatus
): EvidenceTransitionDecision {
  const requiredEvidence = getRequiredEvidenceForStatus(nextStatus);
  const presentKinds = new Set(record.evidenceRefs.filter(item => item.ref.trim()).map(item => item.kind));
  const missingEvidence = requiredEvidence.filter(kind => !presentKinds.has(kind));

  if (missingEvidence.length > 0) {
    return {
      allowed: false,
      nextStatus,
      requiredEvidence,
      reason: `Missing evidence: ${missingEvidence.join(", ")}. CRM status must remain ${record.status}.`,
      classification: "evidence_missing"
    };
  }

  return {
    allowed: true,
    nextStatus,
    requiredEvidence,
    reason: `Evidence satisfied for ${nextStatus}.`,
    classification: "evidence_ok"
  };
}

export function classifyChannelActivation(channel: OutboundChannel, available: boolean): ChannelActivationDecision {
  if (available) {
    return {
      channel,
      status: "ready",
      productBlocked: false,
      reason: `${channel} channel available for controlled outbound execution.`,
      nextAction: "Execute outbound action and capture proof reference."
    };
  }

  return {
    channel,
    status: "activation_required",
    productBlocked: false,
    reason: `${channel} is not connected in this environment. This is a channel activation action, not a product blocker.`,
    nextAction: `Prepare ${channel} draft/link, keep CRM status unchanged, and capture proof before advancing status.`
  };
}

function hasEvidence(record: ProspectOutboundRecord, kind: OutboundEvidenceKind): boolean {
  return record.evidenceRefs.some(item => item.kind === kind && item.ref.trim().length > 0);
}

export function summarizeOutboundEvidence(records: ProspectOutboundRecord[]): OutboundEvidenceSummary {
  return {
    totalProspects: records.length,
    preparedWithoutSendProof: records.filter(record => !hasEvidence(record, "send_proof")).length,
    sentWithProof: records.filter(record => hasEvidence(record, "send_proof")).length,
    repliesWithProof: records.filter(record => hasEvidence(record, "reply_proof")).length,
    proposalsWithProof: records.filter(record => hasEvidence(record, "proposal_proof")).length,
    paymentsWithProof: records.filter(record => hasEvidence(record, "payment_proof")).length,
    verifiedBlockers: [],
    activationActions: [
      "Connecter ou ouvrir WhatsApp Business/API pour envoi contrôlé",
      "Capturer send_proof avant statut Message envoyé",
      "Capturer reply_proof avant statut Réponse reçue",
      "Capturer payment_proof avant statut Payé"
    ]
  };
}
