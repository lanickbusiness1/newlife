from __future__ import annotations

import re
import unicodedata

from domain import PolicyDecision


STOP_WORDS = {
    "stop",
    "arrete",
    "arret",
    "desabonne",
    "desabonnement",
    "unsubscribe",
    "cancel",
    "annule",
}

SENSITIVE_PATTERNS = (
    "juridique",
    "avocat",
    "notaire",
    "contrat",
    "garantie",
    "garanti",
    "prix final",
    "prix garanti",
    "disponibilite garantie",
    "disponible garanti",
    "taux de rendement",
    "rendement garanti",
)


def _normalize(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.lower())
    ascii_text = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", ascii_text).strip()


def is_opt_out(text: str) -> bool:
    value = _normalize(text)
    first = re.split(r"[\s,.;:!?]+", value, maxsplit=1)[0]
    return value in STOP_WORDS or first in STOP_WORDS


def is_sensitive(text: str) -> bool:
    value = _normalize(text)
    return any(pattern in value for pattern in SENSITIVE_PATTERNS)


def evaluate_inbound_policy(
    text: str,
    automated_followups_sent: int = 0,
    kill_switch: bool = False,
) -> PolicyDecision:
    if is_opt_out(text):
        return PolicyDecision(
            opt_out=True,
            allow_automated_reply=False,
            escalate_human=False,
            blocked_reason="opt_out",
        )
    if kill_switch:
        return PolicyDecision(
            allow_automated_reply=False,
            blocked_reason="kill_switch_active",
        )
    if automated_followups_sent >= 3:
        return PolicyDecision(
            allow_automated_reply=False,
            blocked_reason="followup_cap_reached",
        )
    if is_sensitive(text):
        return PolicyDecision(
            allow_automated_reply=False,
            escalate_human=True,
            blocked_reason="sensitive_topic_requires_human",
        )
    return PolicyDecision()


def evaluate_followup_policy(automated_followups_sent: int, kill_switch: bool = False) -> PolicyDecision:
    if kill_switch:
        return PolicyDecision(allow_automated_reply=False, blocked_reason="kill_switch_active")
    if automated_followups_sent >= 3:
        return PolicyDecision(allow_automated_reply=False, blocked_reason="followup_cap_reached")
    return PolicyDecision()
