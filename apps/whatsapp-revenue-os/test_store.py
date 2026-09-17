from domain import HandoffSummary
from qualification import qualify_text, score_qualification
from store import InMemoryRevenueStore, redact_phone


def test_in_memory_store_tracks_qualification_handoff_and_optout():
    store = InMemoryRevenueStore()
    org = "org-demo"
    contact_id = store.upsert_contact(org, "+224600000001")
    conversation_id = store.get_or_create_conversation(org, contact_id)
    qualification = qualify_text("Je veux acheter une maison à Cotonou, budget 25 millions, urgent")
    score = score_qualification(qualification)

    store.save_qualification(org, conversation_id, qualification, score)
    store.save_appointment(org, conversation_id, "human_confirmation_required")
    store.save_handoff(org, HandoffSummary(
        conversation_id=conversation_id,
        phone_redacted=redact_phone("+224600000001"),
        reason="hot_lead",
        qualification=qualification,
        score=score,
    ))
    store.save_opt_out(org, contact_id, "msg-stop")

    summary = store.summary(org)
    assert summary["qualified"] == 1
    assert summary["hot"] == 1
    assert summary["appointments"] == 1
    assert summary["handoffs"] == 1
    assert summary["opt_outs"] == 1


def test_message_store_keeps_hash_not_body():
    store = InMemoryRevenueStore()
    org = "org-demo"
    contact_id = store.upsert_contact(org, "+224600000002")
    conversation_id = store.get_or_create_conversation(org, contact_id)
    store.record_message_meta(org, conversation_id, "wamid.1", "inbound", "abc123", "received")
    message = store.messages[0]
    assert message["content_sha256"] == "abc123"
    assert "body" not in message
    assert "text" not in message


def test_redact_phone_only_exposes_last_four_digits():
    assert redact_phone("+224611406262") == "+***6262"
