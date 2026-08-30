# AfrIA Marketing Team™ — Evidence Ledger API

## Objectif

L’Outbound Evidence Gate™ est désormais complété côté backend par un **Evidence Ledger API**. Le rôle du backend est de recevoir les preuves réelles, produire un `evidence_id`, vérifier les transitions CRM et empêcher tout avancement sans preuve.

## Principe canonique

```text
Message préparé ≠ Message envoyé
Message envoyé = send_proof obligatoire
Réponse reçue = reply_proof obligatoire
Diagnostic réservé = diagnostic_proof obligatoire
Proposition envoyée = proposal_proof obligatoire
Paiement demandé = payment_request_proof obligatoire
Payé = payment_proof obligatoire
Canal externe non connecté = activation canal, pas blocage produit
```

## Endpoints

### `POST /outbound/evidence`

Ingestion d’une preuve.

Champs principaux :

- `lead_id`
- `lead_name`
- `channel` : WhatsApp, Email, LinkedIn, Payment, Manual
- `evidence_type`
- `proof_ref`
- `source`
- `occurred_at`

Retour :

- `evidence_id`
- `digest`
- `accepted`
- `crm_transition_enabled`

### `POST /crm/transition/validate`

Valide ou refuse une transition CRM selon les preuves disponibles.

Exemple : `À contacter → Message envoyé` exige `send_proof`.

### `POST /channel/activation/classify`

Classe un canal externe non connecté comme `activation_channel`, jamais comme blocage produit.

## Règle Directeur Pays

Lanick reste en supervision exceptionnelle. Genesis prépare, trace, vérifie et exécute ce qui est possible. L’absence de connexion directe WhatsApp, LinkedIn, email ou paiement ne bloque pas le produit ; elle devient une tâche d’activation canal avec preuve externe à capturer.

## Statut

- Produit : AfrIA Marketing Team™
- Asset ID : PRD-MKT-TEAM-001
- Backend API : Evidence Ledger v0.1
- Frontend : Outbound Evidence Gate™ / OEG-001
- Doctrine : no imaginary blocker
