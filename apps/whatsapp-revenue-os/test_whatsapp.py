import pytest

from whatsapp import FakeWhatsAppAdapter, MetaCloudWhatsAppAdapter


def test_fake_adapter_records_send():
    adapter = FakeWhatsAppAdapter()
    result = adapter.send_text("+224600000001", "Bonjour")
    assert result["status"] == "sent"
    assert result["message_id"] == "fake-1"
    assert adapter.sent[0]["to"] == "+224600000001"


def test_meta_adapter_fails_closed_without_credentials(monkeypatch):
    monkeypatch.delenv("META_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("META_PHONE_NUMBER_ID", raising=False)
    adapter = MetaCloudWhatsAppAdapter(access_token="", phone_number_id="")
    assert adapter.is_configured() is False
    with pytest.raises(RuntimeError, match="not configured"):
        adapter.send_text("+224600000001", "Bonjour")
