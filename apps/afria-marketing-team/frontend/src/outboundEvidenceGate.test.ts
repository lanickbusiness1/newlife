import { describe, expect, it } from "vitest";
import {
  buildWhatsAppOutboundLink,
  canTransitionOutboundStatus,
  classifyChannelActivation,
  summarizeOutboundEvidence,
  type ProspectOutboundRecord
} from "./outboundEvidenceGate";

const baseRecord: ProspectOutboundRecord = {
  id: "lead-001",
  leadName: "Prospect test",
  company: "Entreprise test",
  country: "Bénin",
  segment: "PME",
  channel: "whatsapp",
  status: "prepared",
  offer: "Starter Revenue Engine",
  amountFcfa: 49900,
  phone: "+229 61 10 73 73",
  message: "Bonjour, diagnostic express AfrIA Marketing Team™.",
  evidenceRefs: []
};

describe("Outbound Evidence Gate™", () => {
  it("keeps a prepared message from becoming sent without a send proof", () => {
    const decision = canTransitionOutboundStatus(baseRecord, "sent");

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("send_proof");
    expect(decision.classification).toBe("evidence_missing");
  });

  it("allows a message to become sent when send proof exists", () => {
    const decision = canTransitionOutboundStatus(
      {
        ...baseRecord,
        evidenceRefs: [{ kind: "send_proof", ref: "wa://message/123", capturedAt: "2026-08-30T09:00:00Z" }]
      },
      "sent"
    );

    expect(decision.allowed).toBe(true);
    expect(decision.nextStatus).toBe("sent");
  });

  it("builds a WhatsApp outbound link from a phone number and message", () => {
    const link = buildWhatsAppOutboundLink("+229 61 10 73 73", "Bonjour AfrIA");

    expect(link).toBe("https://wa.me/22961107373?text=Bonjour%20AfrIA");
  });

  it("classifies an unavailable external channel as activation, not product blocker", () => {
    const channel = classifyChannelActivation("whatsapp", false);

    expect(channel.status).toBe("activation_required");
    expect(channel.productBlocked).toBe(false);
  });

  it("summarizes proof coverage without inventing sent messages", () => {
    const summary = summarizeOutboundEvidence([
      baseRecord,
      {
        ...baseRecord,
        id: "lead-002",
        status: "sent",
        evidenceRefs: [{ kind: "send_proof", ref: "mail://sent/456", capturedAt: "2026-08-30T09:05:00Z" }]
      }
    ]);

    expect(summary.totalProspects).toBe(2);
    expect(summary.sentWithProof).toBe(1);
    expect(summary.preparedWithoutSendProof).toBe(1);
    expect(summary.verifiedBlockers).toEqual([]);
  });
});
