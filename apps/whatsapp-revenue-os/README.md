# AfrIAgenesis® WhatsApp Revenue OS™ — Live Demo Vertical Slice

Canonical asset: `PRD-WA-AGENT-FACTORY-001`

Pilot number: `+224 611 406 262`

## Status boundary

This repository slice can become **CI_PROVEN** when GitHub Actions is green. It is **not DEMO_READY and not CLIENT_LIVE** until the live evidence gate below is completed.

The product exists to turn inbound WhatsApp demand into a governed commercial flow:

`WhatsApp inbound → STOP/policy gate → qualification → CRM evidence → lead score → appointment proposal → human handoff → dashboard/audit`

It does not autonomously close property transactions, give legal advice, guarantee prices or property availability, or make payments.

## Local / CI mode

```bash
cd apps/whatsapp-revenue-os
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
pytest -q
uvicorn main:app --reload
```

Defaults are safe for simulation:

- `STORE_MODE=memory`
- `WHATSAPP_MODE=fake`
- `/demo/inbound` never sends to Meta; it uses an isolated fake adapter.

Example simulated flow:

```bash
curl -s http://127.0.0.1:8000/demo/inbound \
  -H 'content-type: application/json' \
  -d '{"from_number":"+224600000001","text":"Bonjour, je cherche une parcelle vers Calavi, budget 12 millions"}'
```

## Staging environment

For live staging, set:

```text
ORGANIZATION_ID=afriagenesis-demo
STORE_MODE=supabase
WHATSAPP_MODE=meta
OUTBOUND_KILL_SWITCH=true
OPERATOR_TOKEN=<secret>
SUPABASE_URL=<secret/config>
SUPABASE_SERVICE_ROLE_KEY=<secret>
META_VERIFY_TOKEN=<secret>
META_APP_SECRET=<secret>
META_ACCESS_TOKEN=<secret>
META_PHONE_NUMBER_ID=<secret/config>
META_GRAPH_VERSION=v23.0
```

Never commit real values. The Render blueprint declares secrets with `sync: false`.

## Supabase activation

Apply migration:

`supabase/migrations/202609170001_whatsapp_revenue_os.sql`

It creates the minimum CRM/evidence tables:

- `wa_contacts`
- `wa_conversations`
- `wa_messages_meta`
- `wa_qualification_snapshots`
- `wa_appointments`
- `wa_handoffs`
- `wa_opt_outs`
- `wa_audit_events`

`wa_messages_meta` stores hashes/metadata, not full message bodies. Audit/evidence foreign keys use `ON DELETE RESTRICT`, not CASCADE.

## Meta WhatsApp Cloud API activation

1. Attach the pilot number to an approved WhatsApp Business Platform / Cloud API configuration.
2. Set the Meta phone-number ID and access token in the deployment secret store.
3. Set a private verify token and Meta app secret.
4. Deploy the HTTPS service.
5. Register callback URL: `https://<staging-host>/webhook/whatsapp`.
6. Subscribe the Meta app to WhatsApp message events.
7. Keep `OUTBOUND_KILL_SWITCH=true` until webhook verification and database writes are confirmed.
8. Turn the kill switch off only for the controlled live test.

The webhook requires `X-Hub-Signature-256` HMAC verification. Missing Meta app secret returns a fail-closed error.

## Operator controls

Aggregate operator endpoints require header:

`X-Operator-Token: <OPERATOR_TOKEN>`

Endpoints:

- `GET /dashboard`
- `GET /dashboard/summary`
- `POST /control/kill-switch`

The dashboard deliberately exposes aggregate counts only; it does not render full WhatsApp numbers or message bodies.

## DEMO_READY evidence gate

Do not mark the asset DEMO_READY until all of the following are evidenced:

1. GitHub Actions green on the exact commit.
2. Supabase migration applied successfully.
3. HTTPS healthcheck responds.
4. Meta webhook challenge succeeds.
5. One real inbound message reaches the webhook from the pilot number configuration.
6. CRM/evidence row is created.
7. One governed real outbound reply is sent.
8. A qualified lead creates a handoff and appointment proposal.
9. A real `STOP` test blocks subsequent automated outbound.
10. Kill switch blocks outbound while dashboard/evidence remains readable.
11. No secret is committed and logs remain redacted.

Only after this gate may commercial messaging describe a **live controlled demo**. A production client deployment is a separate gate.

## Demo scenario

Input:

> Bonjour, je cherche une parcelle vers Calavi, budget 12 millions.

Expected behavior:

- detects buying intent, land, Calavi and 12,000,000 XOF budget;
- creates CRM qualification evidence;
- scores the lead using deterministic rules;
- proposes a visit window when the lead is hot;
- creates a human handoff;
- sends only through the governed adapter when outbound is allowed;
- records metadata hashes instead of full message bodies.

## Governance controls

- STOP/opt-out takes precedence over all downstream automation.
- Pilot automated follow-ups are capped at three by policy.
- Legal/contractual/guarantee topics are escalated to a human.
- LLM is not required for this slice; deterministic rules establish the first evidence baseline.
- Meta and Supabase credentials are environment-only.
- `OUTBOUND_KILL_SWITCH` can halt outbound without deleting evidence.
