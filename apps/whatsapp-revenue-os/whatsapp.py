from __future__ import annotations

import os
from typing import Protocol

import httpx


class WhatsAppAdapter(Protocol):
    def send_text(self, to: str, text: str) -> dict: ...
    def is_configured(self) -> bool: ...


class FakeWhatsAppAdapter:
    def __init__(self) -> None:
        self.sent: list[dict] = []

    def is_configured(self) -> bool:
        return True

    def send_text(self, to: str, text: str) -> dict:
        payload = {
            "message_id": f"fake-{len(self.sent) + 1}",
            "to": to,
            "text": text,
            "status": "sent",
        }
        self.sent.append(payload)
        return payload


class MetaCloudWhatsAppAdapter:
    def __init__(
        self,
        access_token: str | None = None,
        phone_number_id: str | None = None,
        graph_version: str | None = None,
        client: httpx.Client | None = None,
    ) -> None:
        self.access_token = access_token or os.getenv("META_ACCESS_TOKEN", "")
        self.phone_number_id = phone_number_id or os.getenv("META_PHONE_NUMBER_ID", "")
        self.graph_version = graph_version or os.getenv("META_GRAPH_VERSION", "v23.0")
        self.client = client or httpx.Client(timeout=12.0)

    def is_configured(self) -> bool:
        return bool(self.access_token and self.phone_number_id)

    def send_text(self, to: str, text: str) -> dict:
        if not self.is_configured():
            raise RuntimeError("Meta Cloud API is not configured")
        response = self.client.post(
            f"https://graph.facebook.com/{self.graph_version}/{self.phone_number_id}/messages",
            headers={
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json",
            },
            json={
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": to,
                "type": "text",
                "text": {"preview_url": False, "body": text},
            },
        )
        response.raise_for_status()
        body = response.json()
        message_id = ((body.get("messages") or [{}])[0]).get("id", "unknown")
        return {"message_id": message_id, "to": to, "status": "sent"}
