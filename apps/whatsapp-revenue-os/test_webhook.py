import hashlib
import hmac
import json

from webhook import normalize_meta_events, verify_challenge, verify_signature


def test_challenge_requires_matching_verify_token():
    assert verify_challenge("subscribe", "token-1", "12345", "token-1") == "12345"


def test_signature_verification_uses_app_secret_hmac():
    raw = json.dumps({"hello": "world"}).encode("utf-8")
    secret = "app-secret"
    digest = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
    assert verify_signature(raw, f"sha256={digest}", secret) is True
    assert verify_signature(raw, "sha256=deadbeef", secret) is False


def test_normalize_meta_text_message():
    payload = {
        "entry": [{
            "changes": [{
                "value": {
                    "messages": [{
                        "from": "224600000001",
                        "id": "wamid.001",
                        "timestamp": "1789596000",
                        "type": "text",
                        "text": {"body": "Bonjour"},
                    }]
                }
            }]
        }]
    }
    events = normalize_meta_events(payload, "org-demo")
    assert len(events) == 1
    assert events[0].from_number == "+224600000001"
    assert events[0].message_id == "wamid.001"
    assert events[0].text == "Bonjour"


def test_non_text_messages_are_ignored():
    payload = {"entry": [{"changes": [{"value": {"messages": [{"type": "image", "id": "x", "from": "2241"}]}}]}]}
    assert normalize_meta_events(payload, "org-demo") == []
