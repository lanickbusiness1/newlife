from __future__ import annotations

import os
from collections import Counter
from datetime import date, datetime, timezone
from statistics import mean, pstdev
from typing import Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel, Field
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

app = FastAPI(
    title="AfrIA PaySwitch™ Merchant-to-Credit Runtime",
    version="0.1.0",
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
        "version": "0.1.0",
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
