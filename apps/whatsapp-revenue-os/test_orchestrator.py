from domain import InboundMessage
from orchestrator import RevenueOrchestrator
from store import InMemoryRevenueStore
from whatsapp import FakeWhatsAppAdapter


def _make():
    store = InMemoryRevenueStore()
    adapter = FakeWhatsAppAdapter()
    return store, adapter, RevenueOrchestrator(store, adapter)


def test_demo_flow_qualifies_persists_replies_and_handoffs():
    store, adapter, orchestrator = _make()
    result = orchestrator.process(InboundMessage(
        organization_id="org-demo",
        message_id="wamid.demo1",
        from_number="+224600000001",
        text="Bonjour, je cherche une parcelle vers Calavi, budget 12 millions",
    ))
    assert result.qualification is not None
    assert result.qualification.zone == "Calavi"
    assert result.qualification.budget_xof == 12_000_000
    assert result.score is not None
    assert result.score.temperature == "hot"
    assert result.reply_sent is True
    assert result.appointment_proposed is True
    assert result.handoff_created is True
    assert len(adapter.sent) == 1
    summary = store.summary("org-demo")
    assert summary["handoffs"] == 1
    assert summary["appointments"] == 1


def test_multi_turn_qualification_accumulates_explicit_answers():
    store, adapter, orchestrator = _make()
    first = orchestrator.process(InboundMessage(
        organization_id="org-demo",
        message_id="wamid.turn1",
        from_number="+224600000020",
        text="Bonjour, je cherche une parcelle",
    ))
    assert first.reply_sent is True
    assert first.qualification is not None
    assert first.qualification.intent == "buy"
    assert first.qualification.property_type == "land"
    assert first.qualification.zone is None

    second = orchestrator.process(InboundMessage(
        organization_id="org-demo",
        message_id="wamid.turn2",
        from_number="+224600000020",
        text="À Calavi, budget 12 millions, dans 2 mois",
    ))
    assert second.qualification is not None
    assert second.qualification.intent == "buy"
    assert second.qualification.property_type == "land"
    assert second.qualification.zone == "Calavi"
    assert second.qualification.budget_xof == 12_000_000
    assert second.qualification.timeline == "dans 2 mois"
    assert second.score is not None
    assert second.score.temperature == "hot"
    assert second.handoff_created is True
    assert second.appointment_proposed is True


def test_stop_persists_optout_and_sends_nothing():
    store, adapter, orchestrator = _make()
    result = orchestrator.process(InboundMessage(
        organization_id="org-demo",
        message_id="wamid.stop",
        from_number="+224600000002",
        text="STOP",
    ))
    assert result.opt_out is True
    assert result.state == "OPTED_OUT"
    assert result.reply_sent is False
    assert adapter.sent == []
    assert store.summary("org-demo")["opt_outs"] == 1


def test_previous_optout_blocks_later_automation_until_manual_reconsent():
    store, adapter, orchestrator = _make()
    phone = "+224600000021"
    orchestrator.process(InboundMessage(
        organization_id="org-demo",
        message_id="wamid.stop-first",
        from_number=phone,
        text="STOP",
    ))

    later = orchestrator.process(InboundMessage(
        organization_id="org-demo",
        message_id="wamid.after-stop",
        from_number=phone,
        text="Bonjour, je cherche une parcelle à Calavi",
    ))

    assert later.opt_out is True
    assert later.state == "OPTED_OUT"
    assert later.reply_sent is False
    assert later.policy_reason == "previous_opt_out"
    assert adapter.sent == []


def test_sensitive_topic_goes_to_human_without_autonomous_claim():
    store, adapter, orchestrator = _make()
    result = orchestrator.process(InboundMessage(
        organization_id="org-demo",
        message_id="wamid.sensitive",
        from_number="+224600000003",
        text="Pouvez-vous garantir le prix final dans le contrat ?",
    ))
    assert result.state == "HANDOFF"
    assert result.handoff_created is True
    assert result.reply_sent is False
    assert result.policy_reason == "sensitive_topic_requires_human"
    assert adapter.sent == []


def test_kill_switch_blocks_outbound_but_keeps_evidence():
    store, adapter, orchestrator = _make()
    result = orchestrator.process(InboundMessage(
        organization_id="org-demo",
        message_id="wamid.kill",
        from_number="+224600000004",
        text="Je cherche une parcelle vers Calavi, budget 12 millions",
    ), kill_switch=True)
    assert result.reply_sent is False
    assert result.policy_reason == "kill_switch_active"
    assert store.summary("org-demo")["qualified"] == 1
    assert store.summary("org-demo")["outbound_blocked"] == 1
    assert adapter.sent == []
