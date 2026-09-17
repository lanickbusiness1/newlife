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
