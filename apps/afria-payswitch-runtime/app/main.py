from __future__ import annotations

import os
import csv
import io
import secrets
from html import escape
from collections import Counter
from datetime import date, datetime, timezone
from statistics import mean, pstdev
from typing import Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from .db import (
    EvaluationRow,
    EvidenceRow,
    MerchantRow,
    PartnerDecisionRow,
    TransactionRow,
    init_db,
    session_scope,
)

console_security = HTTPBasic(auto_error=True)

app = FastAPI(
    title="AfrIA PaySwitch™ Merchant-to-Credit Runtime",
    version="0.2.0",
    description=(
        "Non-custodial, non-lending merchant financial intelligence runtime. "
        "AfrIAgenesis computes explainable credit-readiness; regulated partners own credit decisions."
    ),
)

init_db()


class MerchantCreate(BaseModel):
    legal_name: str = Field(min_length=2, max_length=160)
    country: str = Field(min_length=2, max_length=2, pattern=r"^[A-Z]{2}$")
    currency: str = Field(min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")
    kyb_status: Literal["PENDING", "VERIFIED", "REJECTED"] = "PENDING"


class Merchant(MerchantCreate):
    id: str
    created_at: datetime


class TransactionIn(BaseModel):
    external_id: str = Field(min_length=1, max_length=120)
    occurred_on: date
    amount: float = Field(gt=0)
    direction: Literal["INFLOW", "OUTFLOW"]
    channel: Literal["BANK", "MOBILE_MONEY", "POS", "QR", "CASH", "OTHER"]
    counterparty_hash: str = Field(min_length=1, max_length=120)


class TransactionImport(BaseModel):
    transactions: list[TransactionIn] = Field(min_length=1, max_length=5000)


class PartnerDecisionIn(BaseModel):
    merchant_id: str
    partner_name: str = Field(min_length=2, max_length=160)
    partner_reference: str = Field(min_length=1, max_length=120)
    decision: Literal["APPROVE", "REVIEW", "DECLINE"]
    reason_code: str = Field(min_length=1, max_length=120)


class PartnerDecision(PartnerDecisionIn):
    id: str
    decision_source: Literal["EXTERNAL_REGULATED_PARTNER"] = "EXTERNAL_REGULATED_PARTNER"
    recorded_at: datetime


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def require_api_key(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> None:
    expected = os.getenv("PAYSWITCH_API_KEY")
    if not expected or x_api_key != expected:
        raise HTTPException(status_code=401, detail="unauthorized")


def get_merchant_or_404(merchant_id: str) -> MerchantRow:
    with session_scope() as session:
        row = session.get(MerchantRow, merchant_id)
        if row is None:
            raise HTTPException(status_code=404, detail="merchant_not_found")
        session.expunge(row)
        return row


def record_evidence(merchant_id: str, event_type: str, payload: dict) -> None:
    with session_scope() as session:
        session.add(
            EvidenceRow(
                id=str(uuid4()),
                merchant_id=merchant_id,
                event_type=event_type,
                occurred_at=utcnow(),
                payload=payload,
            )
        )


def calculate_credit_readiness(merchant: MerchantRow, txs: list[TransactionRow]) -> dict:
    inflows = [t.amount for t in txs if t.direction == "INFLOW"]
    outflows = [t.amount for t in txs if t.direction == "OUTFLOW"]
    total_in = sum(inflows)
    total_out = sum(outflows)
    net = total_in - total_out
    tx_count = len(txs)
    dates = [t.occurred_on for t in txs]
    history_days = (max(dates) - min(dates)).days + 1 if dates else 0
    active_days = len(set(dates))
    avg_in = mean(inflows) if inflows else 0.0
    volatility = (pstdev(inflows) / avg_in) if len(inflows) > 1 and avg_in else 1.0
    inflow_cp = Counter(t.counterparty_hash for t in txs if t.direction == "INFLOW")
    top_cp_share = (max(inflow_cp.values()) / len(inflows)) if inflows else 1.0

    score = 0.0
    score += 20 if merchant.kyb_status == "VERIFIED" else (5 if merchant.kyb_status == "PENDING" else 0)
    score += min(20, tx_count * 0.8)
    score += min(15, active_days * 1.25)
    score += 20 if net > 0 else (8 if net == 0 else 0)
    score += max(0, 15 * (1 - min(volatility, 1)))
    score += max(0, 10 * (1 - min(top_cp_share, 1)))
    score = round(min(100, max(0, score)), 1)
    band = "READY" if score >= 70 else ("REVIEW" if score >= 40 else "HIGH_RISK")

    return {
        "merchant_id": merchant.id,
        "score": score,
        "band": band,
        "metrics": {
            "transaction_count": tx_count,
            "history_days": history_days,
            "active_days": active_days,
            "total_inflow": round(total_in, 2),
            "total_outflow": round(total_out, 2),
            "monthly_net_cashflow": round(net * (30 / history_days), 2) if history_days else 0.0,
            "inflow_volatility_ratio": round(volatility, 4),
            "top_counterparty_share": round(top_cp_share, 4),
        },
        "policy_version": "M2C-READINESS-0.1.0",
        "is_credit_decision": False,
        "decision_owner": "REGULATED_PARTNER",
        "regulatory_boundary": "NON_LENDER_NON_CUSTODIAL",
    }


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "afria-payswitch-merchant-to-credit-runtime",
        "version": "0.2.0",
        "regulatory_boundary": "NON_LENDER_NON_CUSTODIAL",
    }


@app.post("/v1/merchants", response_model=Merchant, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_api_key)])
def create_merchant(payload: MerchantCreate) -> Merchant:
    row = MerchantRow(id=str(uuid4()), created_at=utcnow(), **payload.model_dump())
    with session_scope() as session:
        session.add(row)
    record_evidence(row.id, "MERCHANT_CREATED", {"kyb_status": row.kyb_status})
    return Merchant.model_validate(row, from_attributes=True)


@app.post("/v1/merchants/{merchant_id}/transactions:import", status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(require_api_key)])
def import_transactions(merchant_id: str, payload: TransactionImport) -> dict:
    get_merchant_or_404(merchant_id)
    accepted = 0
    duplicates = 0
    with session_scope() as session:
        existing_ids = set(
            session.scalars(select(TransactionRow.external_id).where(TransactionRow.merchant_id == merchant_id)).all()
        )
        for item in payload.transactions:
            if item.external_id in existing_ids:
                duplicates += 1
                continue
            session.add(TransactionRow(id=str(uuid4()), merchant_id=merchant_id, **item.model_dump()))
            existing_ids.add(item.external_id)
            accepted += 1
        try:
            session.flush()
        except IntegrityError:
            raise HTTPException(status_code=409, detail="transaction_import_conflict")
    record_evidence(merchant_id, "TRANSACTION_IMPORT_COMPLETED", {"accepted": accepted, "duplicates": duplicates, "submitted": len(payload.transactions)})
    return {"merchant_id": merchant_id, "accepted": accepted, "duplicates": duplicates}


@app.post("/v1/merchants/{merchant_id}/credit-readiness:evaluate", dependencies=[Depends(require_api_key)])
def evaluate_credit_readiness(merchant_id: str) -> dict:
    merchant = get_merchant_or_404(merchant_id)
    with session_scope() as session:
        txs = list(session.scalars(select(TransactionRow).where(TransactionRow.merchant_id == merchant_id)).all())
        result = calculate_credit_readiness(merchant, txs)
        existing = session.get(EvaluationRow, merchant_id)
        if existing:
            existing.result = result
            existing.evaluated_at = utcnow()
        else:
            session.add(EvaluationRow(merchant_id=merchant_id, result=result, evaluated_at=utcnow()))
    record_evidence(merchant_id, "CREDIT_READINESS_EVALUATED", {"score": result["score"], "band": result["band"]})
    return result


@app.get("/v1/merchants/{merchant_id}/financial-passport", dependencies=[Depends(require_api_key)])
def financial_passport(merchant_id: str) -> dict:
    merchant = get_merchant_or_404(merchant_id)
    with session_scope() as session:
        evaluation = session.get(EvaluationRow, merchant_id)
        if evaluation is None:
            txs = list(session.scalars(select(TransactionRow).where(TransactionRow.merchant_id == merchant_id)).all())
            readiness = calculate_credit_readiness(merchant, txs)
            session.add(EvaluationRow(merchant_id=merchant_id, result=readiness, evaluated_at=utcnow()))
        else:
            readiness = evaluation.result
        evidence_count = len(session.scalars(select(EvidenceRow).where(EvidenceRow.merchant_id == merchant_id)).all())
    return {
        "merchant_id": merchant.id,
        "legal_name": merchant.legal_name,
        "country": merchant.country,
        "currency": merchant.currency,
        "kyb_status": merchant.kyb_status,
        "credit_readiness": readiness,
        "evidence_count": evidence_count,
    }


@app.post("/v1/partner-decisions", response_model=PartnerDecision, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_api_key)])
def record_partner_decision(payload: PartnerDecisionIn) -> PartnerDecision:
    get_merchant_or_404(payload.merchant_id)
    row = PartnerDecisionRow(
        id=str(uuid4()),
        recorded_at=utcnow(),
        decision_source="EXTERNAL_REGULATED_PARTNER",
        **payload.model_dump(),
    )
    with session_scope() as session:
        session.add(row)
    record_evidence(payload.merchant_id, "PARTNER_DECISION_RECORDED", {
        "partner_name": payload.partner_name,
        "partner_reference": payload.partner_reference,
        "decision": payload.decision,
        "reason_code": payload.reason_code,
        "decision_source": "EXTERNAL_REGULATED_PARTNER",
    })
    return PartnerDecision.model_validate(row, from_attributes=True)


@app.get("/v1/merchants/{merchant_id}/evidence", dependencies=[Depends(require_api_key)])
def merchant_evidence(merchant_id: str) -> dict:
    get_merchant_or_404(merchant_id)
    with session_scope() as session:
        rows = list(session.scalars(select(EvidenceRow).where(EvidenceRow.merchant_id == merchant_id).order_by(EvidenceRow.occurred_at)).all())
        events = [
            {
                "id": row.id,
                "merchant_id": row.merchant_id,
                "event_type": row.event_type,
                "occurred_at": row.occurred_at,
                "payload": row.payload,
            }
            for row in rows
        ]
    return {"merchant_id": merchant_id, "events": events}


def require_console(credentials: HTTPBasicCredentials = Depends(console_security)) -> str:
    expected_user = os.getenv("PAYSWITCH_CONSOLE_USER")
    expected_password = os.getenv("PAYSWITCH_CONSOLE_PASSWORD")
    if not expected_user or not expected_password:
        raise HTTPException(status_code=401, detail="console_not_configured", headers={"WWW-Authenticate": "Basic"})
    user_ok = secrets.compare_digest(credentials.username.encode(), expected_user.encode())
    password_ok = secrets.compare_digest(credentials.password.encode(), expected_password.encode())
    if not (user_ok and password_ok):
        raise HTTPException(status_code=401, detail="unauthorized", headers={"WWW-Authenticate": "Basic"})
    return credentials.username


def _console_html() -> str:
    with session_scope() as session:
        merchants = list(session.scalars(select(MerchantRow).order_by(MerchantRow.created_at.desc())).all())
        evaluations = {e.merchant_id: e.result for e in session.scalars(select(EvaluationRow)).all()}
        tx_counts = {}
        for merchant in merchants:
            tx_counts[merchant.id] = len(session.scalars(select(TransactionRow).where(TransactionRow.merchant_id == merchant.id)).all())

    cards = []
    for merchant in merchants:
        evaluation = evaluations.get(merchant.id)
        score = evaluation.get("score") if evaluation else "—"
        band = evaluation.get("band") if evaluation else "NOT_EVALUATED"
        cards.append(f'''<article class="merchant" data-merchant-name="{escape(merchant.legal_name)}" data-merchant-id="{merchant.id}">
          <div><strong>{escape(merchant.legal_name)}</strong><br><small>{merchant.country} · {merchant.currency} · KYB {merchant.kyb_status}</small></div>
          <div><span class="metric">Transactions {tx_counts[merchant.id]}</span><span class="metric">Readiness {score}</span><span class="metric">{band}</span></div>
          <form action="/console/merchants/{merchant.id}/transactions:import-csv" method="post" enctype="multipart/form-data">
            <input type="file" name="file" accept=".csv,text/csv" required><button type="submit">Import CSV</button>
          </form>
          <form action="/console/merchants/{merchant.id}/evaluate" method="post"><button type="submit">Evaluate readiness</button></form>
        </article>''')
    merchant_cards = "\n".join(cards) if cards else '<p class="empty">No merchant yet. Create the first pilot merchant.</p>'
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AfrIA PaySwitch™ — Merchant-to-Credit Pilot Console</title>
<style>
:root {{font-family: Inter, system-ui, sans-serif; color:#0b1f1c; background:#f5f7f6}}
body {{margin:0}} header {{background:#071a17;color:white;padding:28px clamp(20px,5vw,72px)}}
main {{max-width:1100px;margin:auto;padding:28px 20px}} .grid {{display:grid;grid-template-columns:minmax(280px,360px) 1fr;gap:24px}}
.panel,.merchant {{background:white;border:1px solid #dce5e2;border-radius:16px;padding:20px;box-shadow:0 5px 18px #09251d0a}}
.merchant {{display:grid;gap:14px;margin-bottom:14px}} label {{display:block;font-size:.82rem;margin-top:12px;color:#456}}
input,select,button {{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid #cbd8d4;margin-top:5px}}
button {{background:#0b6b54;color:white;border:0;font-weight:700;cursor:pointer}} .metric {{display:inline-block;background:#eef5f2;padding:6px 9px;border-radius:999px;margin:2px 5px 2px 0;font-size:.8rem}}
.badge {{display:inline-block;background:#dbf3e9;color:#075943;padding:6px 10px;border-radius:999px;font-size:.78rem;font-weight:700}} small {{color:#60736d}}
@media(max-width:800px) {{.grid{{grid-template-columns:1fr}}}}
</style></head>
<body><header><span class="badge">PRD-AFRIAPAY-001 · P0 PILOT</span><h1>AfrIA PaySwitch™</h1><p>Merchant-to-Credit Pilot Console</p><small>NON_LENDER_NON_CUSTODIAL · credit decisions belong to regulated partners</small></header>
<main><div class="grid"><section class="panel"><h2>Create merchant</h2>
<form action="/console/merchants" method="post">
<label>Legal name<input name="legal_name" minlength="2" required></label>
<label>Country ISO-2<input name="country" minlength="2" maxlength="2" value="ML" required></label>
<label>Currency ISO-3<input name="currency" minlength="3" maxlength="3" value="XOF" required></label>
<label>KYB status<select name="kyb_status"><option>PENDING</option><option>VERIFIED</option><option>REJECTED</option></select></label>
<button type="submit">Create merchant</button></form></section>
<section><h2>Pilot merchants</h2>{merchant_cards}</section></div></main></body></html>'''


@app.get("/console", response_class=HTMLResponse)
def console_dashboard(_: str = Depends(require_console)) -> HTMLResponse:
    return HTMLResponse(_console_html())


@app.post("/console/merchants", response_class=RedirectResponse, status_code=303)
def console_create_merchant(
    legal_name: str = Form(...),
    country: str = Form(...),
    currency: str = Form(...),
    kyb_status: str = Form("PENDING"),
    _: str = Depends(require_console),
) -> RedirectResponse:
    try:
        payload = MerchantCreate(
            legal_name=legal_name,
            country=country.upper(),
            currency=currency.upper(),
            kyb_status=kyb_status.upper(),
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors())
    row = MerchantRow(id=str(uuid4()), created_at=utcnow(), **payload.model_dump())
    with session_scope() as session:
        session.add(row)
    record_evidence(row.id, "MERCHANT_CREATED", {"kyb_status": row.kyb_status, "source": "PILOT_CONSOLE"})
    return RedirectResponse(url="/console", status_code=303)


@app.post("/console/merchants/{merchant_id}/transactions:import-csv", response_class=RedirectResponse, status_code=303)
async def console_import_csv(
    merchant_id: str,
    file: UploadFile = File(...),
    _: str = Depends(require_console),
) -> RedirectResponse:
    get_merchant_or_404(merchant_id)
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="csv_must_be_utf8")
    reader = csv.DictReader(io.StringIO(text))
    required = {"external_id", "occurred_on", "amount", "direction", "channel", "counterparty_hash"}
    if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
        raise HTTPException(status_code=400, detail="csv_schema_invalid")

    parsed: list[TransactionIn] = []
    try:
        for row in reader:
            parsed.append(TransactionIn(**row))
    except (ValidationError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"invalid_csv_row: {exc}")
    if not parsed:
        raise HTTPException(status_code=400, detail="csv_empty")

    accepted = 0
    duplicates = 0
    with session_scope() as session:
        existing_ids = set(session.scalars(select(TransactionRow.external_id).where(TransactionRow.merchant_id == merchant_id)).all())
        for item in parsed:
            if item.external_id in existing_ids:
                duplicates += 1
                continue
            session.add(TransactionRow(id=str(uuid4()), merchant_id=merchant_id, **item.model_dump()))
            existing_ids.add(item.external_id)
            accepted += 1
    record_evidence(merchant_id, "CSV_TRANSACTION_IMPORT_COMPLETED", {"accepted": accepted, "duplicates": duplicates, "submitted": len(parsed)})
    return RedirectResponse(url="/console", status_code=303)


@app.post("/console/merchants/{merchant_id}/evaluate", response_class=RedirectResponse, status_code=303)
def console_evaluate(merchant_id: str, _: str = Depends(require_console)) -> RedirectResponse:
    merchant = get_merchant_or_404(merchant_id)
    with session_scope() as session:
        txs = list(session.scalars(select(TransactionRow).where(TransactionRow.merchant_id == merchant_id)).all())
        result = calculate_credit_readiness(merchant, txs)
        existing = session.get(EvaluationRow, merchant_id)
        if existing:
            existing.result = result
            existing.evaluated_at = utcnow()
        else:
            session.add(EvaluationRow(merchant_id=merchant_id, result=result, evaluated_at=utcnow()))
    record_evidence(merchant_id, "CREDIT_READINESS_EVALUATED", {"score": result["score"], "band": result["band"], "source": "PILOT_CONSOLE"})
    return RedirectResponse(url="/console", status_code=303)
