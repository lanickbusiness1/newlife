# Outbound Evidence Gate™ — OEG-001

## Doctrine

AfrIA Marketing Team™ must never mark a commercial action as executed without evidence. A prepared WhatsApp, email, or LinkedIn message is useful, but it is not a sent message. A CRM status only advances when the required evidence reference exists.

## Canonical rules

- Message préparé ≠ Message envoyé.
- Message envoyé = `send_proof` obligatoire.
- Réponse reçue = `reply_proof` obligatoire.
- Diagnostic réservé = `diagnostic_proof` obligatoire.
- Proposition envoyée = `proposal_proof` obligatoire.
- Paiement demandé = `payment_request_proof` obligatoire.
- Paiement reçu = `payment_proof` obligatoire.
- Canal externe non connecté = activation canal, pas blocage produit.

## Status chain

```text
prepared
→ sent
→ replied
→ diagnostic_reserved
→ proposal_sent
→ payment_requested
→ paid
```

## Channel activation

When WhatsApp, LinkedIn, email, or payment rails are not directly connected in the execution environment, the system must continue preparing drafts, links, CRM rules, and follow-up logic. It must not claim that messages were sent, and it must not classify the missing external channel as a product blocker.

## Evidence references

Acceptable evidence references include outbound message IDs, sent email IDs, screenshots stored in an evidence repository, payment references, calendar booking references, CRM immutable audit IDs, or other durable proof references.

## R.E.M.E loop

Every silence, reply, objection, payment proof, or failed channel action feeds the R.E.M.E loop: better message, better segment, better proof, better channel, better conversion.
