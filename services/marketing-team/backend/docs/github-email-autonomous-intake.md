# AfrIA Marketing Team™ — GitHub Email Autonomous Intake™

## Status

Internal layer of **AfrIA Marketing Team™**.

This is **not** a standalone product and must not create a new catalog entry. It is attached to:

```text
Product: AfrIA Marketing Team™
Asset: PRD-MKT-TEAM-001
Operator: DeployBot
```

## Purpose

GitHub notification emails are execution signals. AfrIA Marketing Team™ must process them autonomously through DeployBot instead of waiting for Lanick to read, classify, and decide manually.

## Canonical rule

```text
GitHub email → event classification → OEG-compatible proof → DeployBot action → report.
```

## Event classes

| GitHub email signal | Event | DeployBot decision | Escalation |
|---|---|---|---|
| Workflow succeeded / CI passed | `ci_success` | `EXECUTE_AUTONOMOUSLY` | No |
| Workflow failed / tests failed | `ci_failure` | `ESCALATE_EXCEPTION` | Yes |
| Pull request merged | `pr_merged` | `EXECUTE_AUTONOMOUSLY` | No |
| Review/comment/issue | `pr_review` / `issue` | `EXECUTE_AUTONOMOUSLY` | No by default |
| Dependabot/security vulnerability | `security_alert` | `ESCALATE_EXCEPTION` | Yes |
| Non-GitHub email | `not_github` | `IGNORE` | No |

## Evidence model

Every actionable GitHub email becomes:

```text
github-email://<gmail_message_id>
```

with:

```text
proof_type = github_email_proof
source = gmail/github-notification
product = AfrIA Marketing Team™
asset = PRD-MKT-TEAM-001
requires_manual_validation = false
```

## Non-blocking doctrine

A GitHub email does not create a product blocker by itself.

- CI success = evidence logged.
- PR merged = release evidence logged.
- CI failure = real execution exception, not product blocker by default.
- Security alert = real compliance/security exception.
- Missing GitHub/Gmail access = external access exception.

## Escalation to Lanick

DeployBot escalates only when the signal requires one of:

1. Real CI/test failure requiring decision.
2. Security/compliance risk.
3. Missing external access.
4. Financial authorization.
5. Signature or institutional risk.

Everything else stays autonomous.
