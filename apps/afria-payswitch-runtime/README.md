# AfrIA PaySwitch™ — Merchant-to-Credit Runtime P0

Canonical P0 wedge for AfrIA PaySwitch™. This service is deliberately **non-lending** and **non-custodial**: AfrIAgenesis computes explainable merchant financial readiness; a regulated partner owns any APPROVE / REVIEW / DECLINE credit decision.

## Runtime flow

Merchant → KYB → transaction import → deterministic readiness → Financial Passport → regulated partner decision → evidence ledger.

## Security boundary

`/health` is public. Every `/v1/*` endpoint requires `X-API-Key`. Production must set `PAYSWITCH_API_KEY`; if missing, the API fails closed.

## Run

```bash
export PAYSWITCH_API_KEY=change-me
export DATABASE_URL=sqlite:///./afria_payswitch.db
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

For production, use PostgreSQL via `DATABASE_URL`.

## Tests

```bash
python -m pytest -q
```

Current gates covered: API-key deny-by-default, transaction idempotency, deterministic readiness bounded 0–100, explicit non-credit-decision flag, external-partner decision ownership, evidence events.
