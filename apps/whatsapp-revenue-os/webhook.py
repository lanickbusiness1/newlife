from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timezone

from domain import InboundMessage


def verify_challenge(mode: str | None, token: str | None, challenge: str | None, expected_token: str) -> str:
    if mode != "subscribe" or not challenge or not expected_token or token != expected_token:
        raise ValueError("invalid_webhook_challenge")
    return challenge


def verify_signature(raw_body: bytes, signature_header: str | None, app_secret: str) -> bool:
    if not signature_header or not app_secret or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    supplied = signature_header.split("=", 1)[1]
    return hmac.compare_digest(expected, supplied)


def _timestamp_to_iso(value: str | int | None) -> str:
    if value is None:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc).isoformat().replace("+00:00", "Z")
    except (TypeError, ValueError, OSError):
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def normalize_meta_events(payload: dict, organization_id: str) -> list[InboundMessage]:
    events: list[InboundMessage] = []
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value") or {}
            for message in value.get("messages", []) or []:
                if message.get("type") != "text":
                    continue
                text = ((message.get("text") or {}).get("body") or "").strip()
                from_number = str(message.get("from") or "").strip()
                message_id = str(message.get("id") or "").strip()
                if not text or not from_number or not message_id:
                    continue
                if not from_number.startswith("+"):
                    from_number = f"+{from_number}"
                events.append(InboundMessage(
                    organization_id=organization_id,
                    message_id=message_id,
                    from_number=from_number,
                    text=text,
                    received_at=_timestamp_to_iso(message.get("timestamp")),
                ))
    return events
