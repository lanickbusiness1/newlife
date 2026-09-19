from github_email_intake import (
    classify_github_email,
    plan_deploybot_action,
    normalize_github_email_proof,
)


def test_classifies_successful_ci_email_as_autonomous_evidence():
    email = {
        "from": "notifications@github.com",
        "subject": "[lanickbusiness1/newlife] Run succeeded: AfrIA Marketing Team Production Product Cash Activation",
        "snippet": "verify-production-product completed successfully on branch main",
        "message_id": "gmail-github-success-001",
        "thread_id": "thread-success-001",
    }

    event = classify_github_email(email)

    assert event["event_type"] == "ci_success"
    assert event["severity"] == "info"
    assert event["product"] == "AfrIA Marketing Team™"
    assert event["asset"] == "PRD-MKT-TEAM-001"

    action = plan_deploybot_action(event)
    assert action["decision"] == "EXECUTE_AUTONOMOUSLY"
    assert action["escalate_to_lanick"] is False
    assert action["crm_status"] == "evidence_logged"


def test_ci_failure_email_escalates_as_real_exception_without_blocking_product():
    email = {
        "from": "notifications@github.com",
        "subject": "[lanickbusiness1/newlife] Run failed: AfrIA Marketing Team Production Product Cash Activation",
        "snippet": "Backend tests failed",
        "message_id": "gmail-github-failure-001",
        "thread_id": "thread-failure-001",
    }

    event = classify_github_email(email)
    action = plan_deploybot_action(event)

    assert event["event_type"] == "ci_failure"
    assert event["severity"] == "exception"
    assert action["decision"] == "ESCALATE_EXCEPTION"
    assert action["escalate_to_lanick"] is True
    assert action["reason"] == "real_execution_exception"
    assert action["product_blocker"] is False


def test_merged_pr_email_updates_release_evidence_without_manual_intervention():
    email = {
        "from": "notifications@github.com",
        "subject": "[lanickbusiness1/newlife] Pull request #107 merged: feat(afria-marketing-team): add DeployBot Autonomous Execution Layer",
        "snippet": "Merged #107 into main",
        "message_id": "gmail-github-merge-107",
        "thread_id": "thread-merge-107",
    }

    event = classify_github_email(email)
    action = plan_deploybot_action(event)
    proof = normalize_github_email_proof(email, event)

    assert event["event_type"] == "pr_merged"
    assert action["decision"] == "EXECUTE_AUTONOMOUSLY"
    assert action["crm_status"] == "release_evidence_logged"
    assert proof["proof_type"] == "github_email_proof"
    assert proof["evidence_ref"].startswith("github-email://")


def test_security_alert_escalates_compliance_risk():
    email = {
        "from": "dependabot[bot] <notifications@github.com>",
        "subject": "[lanickbusiness1/newlife] Dependabot alert: critical vulnerability detected",
        "snippet": "A critical security vulnerability was found",
        "message_id": "gmail-github-security-001",
        "thread_id": "thread-security-001",
    }

    event = classify_github_email(email)
    action = plan_deploybot_action(event)

    assert event["event_type"] == "security_alert"
    assert event["severity"] == "exception"
    assert action["decision"] == "ESCALATE_EXCEPTION"
    assert action["exception_type"] == "security_or_compliance"


def test_non_github_email_is_ignored_by_adapter():
    email = {
        "from": "client@example.com",
        "subject": "Hello",
        "snippet": "Regular commercial email",
        "message_id": "regular-001",
        "thread_id": "thread-regular-001",
    }

    event = classify_github_email(email)
    assert event["event_type"] == "not_github"
    assert plan_deploybot_action(event)["decision"] == "IGNORE"
