from dataclasses import dataclass
from typing import Literal


DeployBotChannel = Literal["Gmail", "Email", "WhatsApp", "LinkedIn", "Payment", "Manual"]
DeployBotActionType = Literal[
    "send_followup",
    "send_initial_message",
    "capture_reply",
    "prepare_proposal",
    "request_payment",
    "capture_payment_proof",
    "signature",
    "financial_authorization",
    "compliance_risk",
    "missing_external_access",
    "institutional_risk",
]

REAL_ESCALATION_TYPES = {
    "signature",
    "financial_authorization",
    "compliance_risk",
    "missing_external_access",
    "institutional_risk",
}

SENSITIVE_PAYMENT_TYPES = {"capture_payment_proof"}


@dataclass(frozen=True)
class DeployBotAction:
    lead_id: str
    channel: DeployBotChannel
    action_type: DeployBotActionType
    has_channel_authorization: bool
    has_prepared_content: bool
    evidence_ref: str | None = None
    note: str | None = None


def classify_deploybot_action(action: DeployBotAction) -> dict:
    if action.action_type in REAL_ESCALATION_TYPES:
        return {
            "deploybot_layer": "DeployBot Autonomous Execution Layer™",
            "deploybot_decision": "ESCALATE_REAL_EXCEPTION",
            "classification": "real_exception",
            "lead_id": action.lead_id,
            "channel": action.channel,
            "action_type": action.action_type,
            "requires_lanick_validation": True,
            "product_blocker": False,
            "next_step": "escalate_only_this_exception_and_continue_other_work",
        }

    if not action.has_prepared_content:
        return {
            "deploybot_layer": "DeployBot Autonomous Execution Layer™",
            "deploybot_decision": "PREPARE_CONTENT_AUTONOMOUSLY",
            "classification": "missing_prepared_content",
            "lead_id": action.lead_id,
            "channel": action.channel,
            "action_type": action.action_type,
            "requires_lanick_validation": False,
            "product_blocker": False,
            "next_step": "generate_message_offer_or_followup_before_channel_action",
        }

    if not action.has_channel_authorization:
        return {
            "deploybot_layer": "DeployBot Autonomous Execution Layer™",
            "deploybot_decision": "ACTIVATION_REQUIRED_CONTINUE_OTHER_WORK",
            "classification": "activation_channel",
            "lead_id": action.lead_id,
            "channel": action.channel,
            "action_type": action.action_type,
            "requires_lanick_validation": False,
            "product_blocker": False,
            "next_step": "prepare_controlled_proof_capture_and_continue_available_channels",
            "rule": "canal externe non connecté = activation canal, pas blocage produit",
        }

    return {
        "deploybot_layer": "DeployBot Autonomous Execution Layer™",
        "deploybot_decision": "EXECUTE_AUTONOMOUSLY",
        "classification": "autonomous_execution",
        "lead_id": action.lead_id,
        "channel": action.channel,
        "action_type": action.action_type,
        "requires_lanick_validation": False,
        "product_blocker": False,
        "next_step": "execute_channel_action_and_capture_proof",
        "evidence_required_before_crm_status": True,
        "evidence_ref": action.evidence_ref,
    }


def run_deploybot_autonomy_cycle(run_id: str, actions: list[DeployBotAction]) -> dict:
    decisions = [classify_deploybot_action(action) for action in actions]
    autonomous_actions = sum(1 for decision in decisions if decision["deploybot_decision"] == "EXECUTE_AUTONOMOUSLY")
    activation_actions = sum(1 for decision in decisions if decision["classification"] == "activation_channel")
    lanick_escalations = sum(1 for decision in decisions if decision["requires_lanick_validation"] is True)
    evidence_backed_actions = sum(
        1 for decision in decisions if decision.get("evidence_ref") and decision["deploybot_decision"] == "EXECUTE_AUTONOMOUSLY"
    )

    return {
        "deploybot_layer": "DeployBot Autonomous Execution Layer™",
        "run_id": run_id,
        "actions_total": len(actions),
        "autonomous_actions": autonomous_actions,
        "activation_actions": activation_actions,
        "lanick_escalations": lanick_escalations,
        "evidence_backed_actions": evidence_backed_actions,
        "false_crm_advancement": 0,
        "product_blocker": False,
        "decisions": decisions,
        "rule": "DeployBot executes everything except real signature, finance, compliance, missing access, or institutional risk",
    }
