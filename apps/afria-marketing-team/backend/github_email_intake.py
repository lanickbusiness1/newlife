from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict

PRODUCT = "AfrIA Marketing Team™"
ASSET = "PRD-MKT-TEAM-001"


@dataclass(frozen=True)
class GitHubEmailEvent:
    event_type: str
    severity: str
    product: str = PRODUCT
    asset: str = ASSET

    def as_dict(self) -> Dict[str, Any]:
        return {
            "event_type": self.event_type,
            "severity": self.severity,
            "product": self.product,
            "asset": self.asset,
        }


def _text(email: Dict[str, Any]) -> str:
    return " ".join(
        str(email.get(key, "")) for key in ("from", "subject", "snippet")
    ).lower()


def _is_github_email(email: Dict[str, Any]) -> bool:
    sender = str(email.get("from", "")).lower()
    return "notifications@github.com" in sender or "github" in sender or "dependabot" in sender


def classify_github_email(email: Dict[str, Any]) -> Dict[str, Any]:
    """Classify GitHub notification emails as execution evidence for AfrIA Marketing Team™."""

    if not _is_github_email(email):
        return GitHubEmailEvent("not_github", "ignore").as_dict()

    text = _text(email)

    if any(token in text for token in ("dependabot alert", "vulnerability", "security alert", "critical vulnerability")):
        return GitHubEmailEvent("security_alert", "exception").as_dict()

    if any(token in text for token in ("run failed", "failed:", "failure", "tests failed", "workflow failed")):
        return GitHubEmailEvent("ci_failure", "exception").as_dict()

    if any(token in text for token in ("run succeeded", "completed successfully", "ci passed", "workflow succeeded", "success")):
        return GitHubEmailEvent("ci_success", "info").as_dict()

    if any(token in text for token in ("pull request", "merged", "merged #", "into main")) and "merged" in text:
        return GitHubEmailEvent("pr_merged", "info").as_dict()

    if any(token in text for token in ("review requested", "commented on", "approved", "requested changes")):
        return GitHubEmailEvent("pr_review", "attention").as_dict()

    if any(token in text for token in ("issue", "opened", "closed")):
        return GitHubEmailEvent("issue", "attention").as_dict()

    return GitHubEmailEvent("github_notification", "info").as_dict()


def plan_deploybot_action(event: Dict[str, Any]) -> Dict[str, Any]:
    event_type = event.get("event_type")

    if event_type == "not_github":
        return {
            "decision": "IGNORE",
            "escalate_to_lanick": False,
            "product_blocker": False,
        }

    if event_type == "security_alert":
        return {
            "decision": "ESCALATE_EXCEPTION",
            "escalate_to_lanick": True,
            "exception_type": "security_or_compliance",
            "reason": "real_execution_exception",
            "product_blocker": False,
        }

    if event_type == "ci_failure":
        return {
            "decision": "ESCALATE_EXCEPTION",
            "escalate_to_lanick": True,
            "exception_type": "ci_failure",
            "reason": "real_execution_exception",
            "product_blocker": False,
        }

    if event_type == "pr_merged":
        return {
            "decision": "EXECUTE_AUTONOMOUSLY",
            "escalate_to_lanick": False,
            "crm_status": "release_evidence_logged",
            "product_blocker": False,
        }

    if event_type in {"ci_success", "pr_review", "issue", "github_notification"}:
        return {
            "decision": "EXECUTE_AUTONOMOUSLY",
            "escalate_to_lanick": False,
            "crm_status": "evidence_logged",
            "product_blocker": False,
        }

    return {
        "decision": "EXECUTE_AUTONOMOUSLY",
        "escalate_to_lanick": False,
        "crm_status": "evidence_logged",
        "product_blocker": False,
    }


def normalize_github_email_proof(email: Dict[str, Any], event: Dict[str, Any]) -> Dict[str, Any]:
    message_id = str(email.get("message_id") or email.get("id") or "unknown")
    thread_id = str(email.get("thread_id") or "unknown-thread")
    event_type = str(event.get("event_type", "github_notification"))

    return {
        "proof_type": "github_email_proof",
        "evidence_ref": f"github-email://{message_id}",
        "source": "gmail/github-notification",
        "message_id": message_id,
        "thread_id": thread_id,
        "event_type": event_type,
        "product": PRODUCT,
        "asset": ASSET,
        "requires_manual_validation": False,
    }


def process_github_email(email: Dict[str, Any]) -> Dict[str, Any]:
    event = classify_github_email(email)
    action = plan_deploybot_action(event)
    proof = normalize_github_email_proof(email, event) if action["decision"] != "IGNORE" else None

    return {
        "product": PRODUCT,
        "asset": ASSET,
        "event": event,
        "deploybot_action": action,
        "proof": proof,
    }
