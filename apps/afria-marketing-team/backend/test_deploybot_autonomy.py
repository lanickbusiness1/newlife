from deploybot_autonomy import (
    DeployBotAction,
    classify_deploybot_action,
    run_deploybot_autonomy_cycle,
)


def test_deploybot_executes_non_sensitive_commercial_followup_without_lanick_gate():
    action = DeployBotAction(
        lead_id="lead-esmath-001",
        channel="Gmail",
        action_type="send_followup",
        has_channel_authorization=True,
        has_prepared_content=True,
        evidence_ref="gmail://thread/1a028b2e24227bfd/draft/r-4893786366497632895",
    )

    decision = classify_deploybot_action(action)

    assert decision["deploybot_decision"] == "EXECUTE_AUTONOMOUSLY"
    assert decision["requires_lanick_validation"] is False
    assert decision["product_blocker"] is False
    assert decision["next_step"] == "execute_channel_action_and_capture_proof"


def test_deploybot_escalates_signature_payment_compliance_and_missing_access_only():
    for action_type in ["signature", "financial_authorization", "compliance_risk", "missing_external_access"]:
        action = DeployBotAction(
            lead_id="lead-risk-001",
            channel="Gmail",
            action_type=action_type,
            has_channel_authorization=True,
            has_prepared_content=True,
        )

        decision = classify_deploybot_action(action)

        assert decision["deploybot_decision"] == "ESCALATE_REAL_EXCEPTION"
        assert decision["requires_lanick_validation"] is True
        assert decision["product_blocker"] is False


def test_deploybot_marks_unconnected_channel_as_activation_not_blocker():
    action = DeployBotAction(
        lead_id="lead-whatsapp-001",
        channel="WhatsApp",
        action_type="send_followup",
        has_channel_authorization=False,
        has_prepared_content=True,
    )

    decision = classify_deploybot_action(action)

    assert decision["deploybot_decision"] == "ACTIVATION_REQUIRED_CONTINUE_OTHER_WORK"
    assert decision["classification"] == "activation_channel"
    assert decision["product_blocker"] is False
    assert decision["requires_lanick_validation"] is False


def test_deploybot_cycle_never_advances_crm_without_evidence():
    actions = [
        DeployBotAction(
            lead_id="lead-esmath-001",
            channel="Gmail",
            action_type="send_followup",
            has_channel_authorization=True,
            has_prepared_content=True,
            evidence_ref="gmail://message/1a0b88865ae47486",
        ),
        DeployBotAction(
            lead_id="lead-wa-001",
            channel="WhatsApp",
            action_type="send_followup",
            has_channel_authorization=False,
            has_prepared_content=True,
        ),
    ]

    report = run_deploybot_autonomy_cycle("deploybot-run-001", actions)

    assert report["run_id"] == "deploybot-run-001"
    assert report["autonomous_actions"] == 1
    assert report["activation_actions"] == 1
    assert report["false_crm_advancement"] == 0
    assert report["lanick_escalations"] == 0
    assert report["rule"] == "DeployBot executes everything except real signature, finance, compliance, missing access, or institutional risk"
