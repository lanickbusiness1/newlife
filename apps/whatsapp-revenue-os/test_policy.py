from policy import evaluate_followup_policy, evaluate_inbound_policy


def test_stop_is_terminal_for_automation():
    decision = evaluate_inbound_policy("STOP", automated_followups_sent=0, kill_switch=False)
    assert decision.opt_out is True
    assert decision.allow_automated_reply is False
    assert decision.blocked_reason == "opt_out"


def test_stop_with_extra_text_is_still_opt_out():
    decision = evaluate_inbound_policy("STOP merci")
    assert decision.opt_out is True


def test_fourth_followup_is_blocked():
    decision = evaluate_followup_policy(automated_followups_sent=3, kill_switch=False)
    assert decision.allow_automated_reply is False
    assert decision.blocked_reason == "followup_cap_reached"


def test_kill_switch_blocks_outbound():
    decision = evaluate_inbound_policy("Bonjour", kill_switch=True)
    assert decision.allow_automated_reply is False
    assert decision.blocked_reason == "kill_switch_active"


def test_sensitive_topic_escalates_to_human():
    decision = evaluate_inbound_policy("Pouvez-vous garantir le prix final dans le contrat ?")
    assert decision.allow_automated_reply is False
    assert decision.escalate_human is True
    assert decision.blocked_reason == "sensitive_topic_requires_human"
