from __future__ import annotations

import json
import os
import uuid
from html import escape

from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, PlainTextResponse
from pydantic import BaseModel, Field

from domain import ASSET_ID, InboundMessage, PILOT_NUMBER
from orchestrator import RevenueOrchestrator
from store import InMemoryRevenueStore, SupabaseRevenueStore
from webhook import normalize_meta_events, verify_challenge, verify_signature
from whatsapp import FakeWhatsAppAdapter, MetaCloudWhatsAppAdapter


class DemoInboundRequest(BaseModel):
    from_number: str = Field(min_length=4)
    text: str = Field(min_length=1, max_length=4096)


class KillSwitchRequest(BaseModel):
    active: bool


def _as_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _build_store():
    mode = os.getenv("STORE_MODE", "memory").strip().lower()
    if mode == "supabase":
        return SupabaseRevenueStore()
    if mode != "memory":
        raise RuntimeError(f"Unsupported STORE_MODE={mode}")
    return InMemoryRevenueStore()


def _build_whatsapp():
    mode = os.getenv("WHATSAPP_MODE", "fake").strip().lower()
    if mode == "meta":
        return MetaCloudWhatsAppAdapter()
    if mode != "fake":
        raise RuntimeError(f"Unsupported WHATSAPP_MODE={mode}")
    return FakeWhatsAppAdapter()


def _live_whatsapp_configured() -> bool:
    return os.getenv("WHATSAPP_MODE", "fake").strip().lower() == "meta" and whatsapp.is_configured()


def _require_operator(x_operator_token: str | None) -> None:
    expected = os.getenv("OPERATOR_TOKEN", "")
    if not expected:
        raise HTTPException(status_code=503, detail="operator_token_not_configured")
    if x_operator_token != expected:
        raise HTTPException(status_code=401, detail="operator_unauthorized")


ORGANIZATION_ID = os.getenv("ORGANIZATION_ID", "afriagenesis-demo")
store = _build_store()
whatsapp = _build_whatsapp()
orchestrator = RevenueOrchestrator(store, whatsapp)

demo_store = InMemoryRevenueStore()
demo_whatsapp = FakeWhatsAppAdapter()
demo_orchestrator = RevenueOrchestrator(demo_store, demo_whatsapp)

runtime_control = {"kill_switch_active": _as_bool("OUTBOUND_KILL_SWITCH", default=False)}

app = FastAPI(title="AfrIAgenesis WhatsApp Revenue OS", version="0.1.0")


@app.get("/health")
def health():
    return {
        "service": "whatsapp-revenue-os",
        "asset_id": ASSET_ID,
        "pilot_number": PILOT_NUMBER,
        "release_stage": "CODE_REVIEW",
        "demo_ready": False,
        "client_live": False,
        "store_mode": os.getenv("STORE_MODE", "memory"),
        "whatsapp_mode": os.getenv("WHATSAPP_MODE", "fake"),
        "live_whatsapp_configured": _live_whatsapp_configured(),
        "kill_switch_active": runtime_control["kill_switch_active"],
    }


@app.get("/webhook/whatsapp", response_class=PlainTextResponse)
def whatsapp_webhook_challenge(
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(default=None, alias="hub.challenge"),
):
    expected = os.getenv("META_VERIFY_TOKEN", "")
    try:
        return verify_challenge(hub_mode, hub_verify_token, hub_challenge, expected)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@app.post("/webhook/whatsapp")
async def whatsapp_webhook(request: Request):
    raw = await request.body()
    app_secret = os.getenv("META_APP_SECRET", "")
    if not app_secret:
        raise HTTPException(status_code=503, detail="meta_app_secret_not_configured")
    signature = request.headers.get("X-Hub-Signature-256")
    if not verify_signature(raw, signature, app_secret):
        raise HTTPException(status_code=401, detail="invalid_webhook_signature")
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="invalid_json") from exc

    events = normalize_meta_events(payload, ORGANIZATION_ID)
    results = [
        orchestrator.process(event, kill_switch=runtime_control["kill_switch_active"]).model_dump()
        for event in events
    ]
    return {
        "accepted": True,
        "events_processed": len(results),
        "results": results,
    }


@app.post("/demo/inbound")
def demo_inbound(payload: DemoInboundRequest):
    message = InboundMessage(
        organization_id=ORGANIZATION_ID,
        message_id=f"demo-{uuid.uuid4().hex}",
        from_number=payload.from_number,
        text=payload.text,
    )
    return demo_orchestrator.process(
        message,
        kill_switch=runtime_control["kill_switch_active"],
    ).model_dump()


@app.get("/dashboard/summary")
def dashboard_summary(x_operator_token: str | None = Header(default=None, alias="X-Operator-Token")):
    _require_operator(x_operator_token)
    summary = store.summary(ORGANIZATION_ID)
    return {
        **summary,
        "asset_id": ASSET_ID,
        "kill_switch_active": runtime_control["kill_switch_active"],
        "live_whatsapp_configured": _live_whatsapp_configured(),
        "demo_ready": False,
        "client_live": False,
    }


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard(x_operator_token: str | None = Header(default=None, alias="X-Operator-Token")):
    _require_operator(x_operator_token)
    summary = store.summary(ORGANIZATION_ID)
    rows = "".join(
        f"<tr><th>{escape(str(key).replace('_', ' ').title())}</th><td>{escape(str(value))}</td></tr>"
        for key, value in summary.items()
    )
    return HTMLResponse(
        "<!doctype html><html><head><meta charset='utf-8'><title>WhatsApp Revenue OS</title>"
        "<style>body{font-family:system-ui;max-width:900px;margin:40px auto;padding:0 20px}"
        "table{border-collapse:collapse;width:100%}th,td{padding:12px;border:1px solid #ddd;text-align:left}"
        ".gate{padding:12px;background:#fff3cd;border:1px solid #ffe69c;margin:16px 0}</style></head><body>"
        f"<h1>WhatsApp Revenue OS — Operator Dashboard</h1>"
        f"<p>Asset: {escape(ASSET_ID)} · Pilot: {escape(PILOT_NUMBER)}</p>"
        "<div class='gate'><strong>Boundary:</strong> CODE_REVIEW / DEMO_READY=false / CLIENT_LIVE=false</div>"
        f"<p>Kill switch: <strong>{escape(str(runtime_control['kill_switch_active']))}</strong></p>"
        f"<table>{rows}</table>"
        "</body></html>"
    )


@app.post("/control/kill-switch")
def set_kill_switch(
    payload: KillSwitchRequest,
    x_operator_token: str | None = Header(default=None, alias="X-Operator-Token"),
):
    _require_operator(x_operator_token)
    runtime_control["kill_switch_active"] = payload.active
    store.append_audit(ORGANIZATION_ID, "kill_switch_changed", None, {"active": payload.active})
    return {"kill_switch_active": runtime_control["kill_switch_active"]}
