from __future__ import annotations

import hashlib

from domain import HandoffSummary, InboundMessage, OrchestrationResult
from policy import evaluate_inbound_policy
from qualification import merge_qualification, next_missing_question, qualify_text, score_qualification
from store import RevenueStore, redact_phone
from whatsapp import WhatsAppAdapter


def _sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


class RevenueOrchestrator:
    def __init__(self, store: RevenueStore, whatsapp: WhatsAppAdapter) -> None:
        self.store = store
        self.whatsapp = whatsapp

    def process(self, message: InboundMessage, *, kill_switch: bool = False) -> OrchestrationResult:
        org = message.organization_id
        contact_id = self.store.upsert_contact(org, message.from_number)
        conversation_id = self.store.get_or_create_conversation(org, contact_id)
        self.store.record_message_meta(
            org,
            conversation_id,
            message.message_id,
            "inbound",
            _sha256_text(message.text),
            "received",
        )

        decision = evaluate_inbound_policy(message.text, automated_followups_sent=0, kill_switch=kill_switch)

        if decision.opt_out:
            self.store.save_opt_out(org, contact_id, message.message_id)
            self.store.append_audit(org, "opt_out", conversation_id, {
                "source_message_id": message.message_id,
                "phone_redacted": redact_phone(message.from_number),
            })
            return OrchestrationResult(
                conversation_id=conversation_id,
                state="OPTED_OUT",
                reply_sent=False,
                opt_out=True,
                policy_reason=decision.blocked_reason,
            )

        if self.store.is_opted_out(org, contact_id):
            self.store.append_audit(org, "outbound_blocked", conversation_id, {
                "reason": "previous_opt_out",
                "source_message_id": message.message_id,
            })
            return OrchestrationResult(
                conversation_id=conversation_id,
                state="OPTED_OUT",
                reply_sent=False,
                opt_out=True,
                policy_reason="previous_opt_out",
            )

        current_qualification = qualify_text(message.text)
        previous_qualification = self.store.get_latest_qualification(org, conversation_id)
        qualification = merge_qualification(previous_qualification, current_qualification)
        score = score_qualification(qualification)
        self.store.save_qualification(org, conversation_id, qualification, score)

        if decision.escalate_human:
            handoff = HandoffSummary(
                conversation_id=conversation_id,
                phone_redacted=redact_phone(message.from_number),
                reason="sensitive_topic_requires_human",
                qualification=qualification,
                score=score,
            )
            self.store.save_handoff(org, handoff)
            self.store.append_audit(org, "handoff_created", conversation_id, {
                "reason": handoff.reason,
                "score": score.points,
                "temperature": score.temperature,
            })
            return OrchestrationResult(
                conversation_id=conversation_id,
                state="HANDOFF",
                qualification=qualification,
                score=score,
                reply_sent=False,
                handoff_created=True,
                policy_reason=decision.blocked_reason,
            )

        appointment_proposed = False
        handoff_created = False

        if score.temperature == "hot":
            reply_text = (
                "Merci, votre demande est suffisamment qualifiée. "
                "Préférez-vous une visite cette semaine ou la semaine prochaine ? "
                "Un conseiller humain prendra le relais pour confirmer le créneau et les informations du bien."
            )
            self.store.save_appointment(org, conversation_id, "human_confirmation_required")
            handoff = HandoffSummary(
                conversation_id=conversation_id,
                phone_redacted=redact_phone(message.from_number),
                reason="hot_lead",
                qualification=qualification,
                score=score,
            )
            self.store.save_handoff(org, handoff)
            appointment_proposed = True
            handoff_created = True
            state = "HANDOFF"
        else:
            missing_question = next_missing_question(qualification)
            reply_text = missing_question or (
                "Merci. Votre demande est enregistrée et un conseiller humain va la reprendre."
            )
            state = "QUALIFYING" if missing_question else "QUALIFIED"

        if not decision.allow_automated_reply:
            self.store.append_audit(org, "outbound_blocked", conversation_id, {
                "reason": decision.blocked_reason,
                "kill_switch": kill_switch,
            })
            return OrchestrationResult(
                conversation_id=conversation_id,
                state=state,
                qualification=qualification,
                score=score,
                reply_text=reply_text,
                reply_sent=False,
                appointment_proposed=appointment_proposed,
                handoff_created=handoff_created,
                policy_reason=decision.blocked_reason,
            )

        try:
            send_result = self.whatsapp.send_text(message.from_number, reply_text)
        except Exception:
            self.store.append_audit(org, "outbound_blocked", conversation_id, {
                "reason": "adapter_send_failed",
            })
            return OrchestrationResult(
                conversation_id=conversation_id,
                state=state,
                qualification=qualification,
                score=score,
                reply_text=reply_text,
                reply_sent=False,
                appointment_proposed=appointment_proposed,
                handoff_created=handoff_created,
                policy_reason="adapter_send_failed",
            )

        outbound_message_id = str(send_result.get("message_id") or f"out-{message.message_id}")
        self.store.record_message_meta(
            org,
            conversation_id,
            outbound_message_id,
            "outbound",
            _sha256_text(reply_text),
            "sent",
        )
        self.store.append_audit(org, "outbound_sent", conversation_id, {
            "message_id": outbound_message_id,
            "phone_redacted": redact_phone(message.from_number),
        })
        return OrchestrationResult(
            conversation_id=conversation_id,
            state=state,
            qualification=qualification,
            score=score,
            reply_text=reply_text,
            reply_sent=True,
            appointment_proposed=appointment_proposed,
            handoff_created=handoff_created,
        )
