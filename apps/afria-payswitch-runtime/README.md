# AfrIA PaySwitch™ — Merchant-to-Credit Runtime P0

Canonical P0 wedge for AfrIA PaySwitch™. This service is deliberately **non-lending** and **non-custodial**: AfrIAgenesis computes explainable merchant financial readiness; a regulated partner owns any APPROVE / REVIEW / DECLINE credit decision.

## Runtime flow

Merchant → KYB → transaction import → deterministic readiness → Financial Passport → regulated partner decision → evidence ledger.

## Pilot operator console

`/console` is a protected operational dashboard for pilot teams. It supports merchant onboarding, CSV transaction import, readiness evaluation and merchant status review. The console uses HTTP Basic credentials from `PAYSWITCH_CONSOLE_USER` and `PAYSWITCH_CONSOLE_PASSWORD`; it fails closed when either variable is missing.

Required CSV columns:

`external_id,occurred_on,amount,direction,channel,counterparty_hash`

## Security boundary

`/health` is public. Every `/v1/*` endpoint requires `X-API-Key`. Production must set `PAYSWITCH_API_KEY`; if missing, the API fails closed. Console endpoints are separately protected with HTTP Basic and must only be served over HTTPS.

## Run

```bash
export PAYSWITCH_API_KEY=change-me
export PAYSWITCH_CONSOLE_USER=operator
export PAYSWITCH_CONSOLE_PASSWORD=change-this-too
export DATABASE_URL=sqlite:///./afria_payswitch.db
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

For production, use PostgreSQL via `DATABASE_URL`.

## Tests

```bash
python -m pytest -q
```

Current gates covered: API-key deny-by-default, console deny-by-default, transaction idempotency, CSV import validation, deterministic readiness bounded 0–100, explicit non-credit-decision flag, external-partner decision ownership, evidence events.
