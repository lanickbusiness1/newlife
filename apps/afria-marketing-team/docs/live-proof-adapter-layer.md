# Live Proof Adapter Layer™

## Purpose

Live Proof Adapter Layer™ moves AfrIA Marketing Team™ from core product finalization to controlled live commercial proof.

It standardizes external proof events from Gmail/Email, WhatsApp manual capture, LinkedIn manual capture and payment confirmation into evidence records that can feed the existing Outbound Evidence Gate™, Evidence Ledger API and Cash Autopilot loop.

## Rule

```text
No fabricated proof.
No false CRM status.
No fake payment.
Unconnected channel = activation channel, not product blocker.
```

## Supported adapters v0.1

```text
Gmail
Email
Payment
WhatsAppManual
LinkedInManual
PaymentManual
```

## Event mapping

```text
message_sent        -> send_proof              -> Message envoyé
reply_received      -> reply_proof             -> Réponse reçue
diagnostic_reserved -> diagnostic_proof        -> Diagnostic réservé
proposal_sent       -> proposal_proof          -> Proposition envoyée
payment_requested   -> payment_request_proof   -> Paiement demandé
payment_received    -> payment_proof           -> Payé
```

## Commercial boundary

Product core is finalized. Commercial live proof requires at least one real external reference:

```text
gmail://sent/...
email://sent/...
manual://screenshot/...
payment://transaction/...
```

Only a `payment_proof` record can count as verified cash.

## Cash objective

```text
First verified live proof -> first CRM status applied -> first payment proof -> first cash report -> R.E.M.E learning.
```
