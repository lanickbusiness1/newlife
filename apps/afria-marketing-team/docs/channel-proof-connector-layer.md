# Channel Proof Connector Layer™ v0.1

## Purpose

Channel Proof Connector Layer™ connects external channel events to the backend Evidence Ledger API without pretending that a draft is a sent message.

It operationalizes the rule:

```text
message prepared ≠ message sent
message sent = proof required
channel not connected = activation channel, not product blocker
```

## Endpoints

### POST `/channel/proof/draft`

Prepares a channel-specific draft and returns the proof that will be required before any CRM transition.

Supported channels:

- WhatsApp
- Email
- LinkedIn
- Payment

Supported actions:

- `send_message` → `message_sent` → `send_proof` → `Message envoyé`
- `capture_reply` → `reply_received` → `reply_proof` → `Réponse reçue`
- `reserve_diagnostic` → `diagnostic_reserved` → `diagnostic_proof` → `Diagnostic réservé`
- `send_proposal` → `proposal_sent` → `proposal_proof` → `Proposition envoyée`
- `request_payment` → `payment_requested` → `payment_request_proof` → `Paiement demandé`
- `confirm_payment` → `payment_received` → `payment_proof` → `Payé`

The endpoint returns `sent=false`; it never claims external execution.

### POST `/channel/proof/normalize`

Normalizes a real channel event into a standard outbound evidence record and stores it through the Evidence Ledger.

Example event:

```json
{
  "lead_id": "lead-email-001",
  "lead_name": "Cabinet conseil",
  "channel": "Email",
  "event_type": "message_sent",
  "proof_ref": "email://sent/message-001",
  "source": "gmail_connector"
}
```

Output includes:

- `evidence_id` prefixed by `OEG-EVID-`
- `evidence_type`
- `crm_transition_enabled`
- `transition_validation_target`
- `connector_layer = Channel Proof Connector Layer™`

## CRM rule

The CRM can only move after `/crm/transition/validate` confirms that the right evidence exists for the requested target status.

## Cash objective

Turn WhatsApp, Email, LinkedIn and Payment evidence into a traceable chain:

```text
channel event
→ normalized proof
→ OEG evidence_id
→ CRM transition validation
→ cash report
→ R.E.M.E learning
```
