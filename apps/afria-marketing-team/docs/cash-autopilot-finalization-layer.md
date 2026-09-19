# Cash Autopilot Finalization Layer™

## Objet

Cette couche ferme la boucle opérationnelle AfrIA Marketing Team™ :

```text
événement canal réel
→ preuve OEG
→ validation transition CRM
→ application statut CRM
→ rapport cash
→ R.E.M.E
```

Elle ne fabrique jamais de preuve et ne fait jamais avancer un statut sans `evidence_id` valide.

## Endpoints

### `POST /crm/status/apply`

Applique un statut CRM uniquement si `/crm/transition/validate` autorise la transition.

- Sans preuve adaptée : `applied=false`.
- Avec preuve adaptée : statut appliqué et historisé.
- Aucun faux passage à `Message envoyé`, `Réponse reçue`, `Proposition envoyée`, `Paiement demandé` ou `Payé`.

### `POST /cash/autopilot/run`

Traite un lot d’événements canal réels :

```text
channel event
→ /channel/proof/normalize
→ OEG evidence_id
→ /crm/status/apply
→ run report
```

Le run peut traiter WhatsApp, Email, LinkedIn et Payment si une preuve réelle est fournie.

### `GET /cash/autopilot/report`

Retourne l’état vérifié :

- nombre de preuves ;
- nombre de statuts CRM appliqués ;
- paiements vérifiés ;
- statut cash ;
- gaps non bloquants ;
- prochaine action.

### `GET /cash/finalization/check`

Sépare deux notions :

```text
Product core finalized = boucle preuve → statut → rapport cash complète.
Commercial live finalized = au moins une preuve canal réelle + paiement vérifié.
```

## Règle canonique

```text
Canal externe non connecté = activation canal, pas blocage produit.
Statut CRM = uniquement avec preuve.
Cash vérifié = uniquement avec preuve paiement.
```

## Statut

- AfrIA Marketing Team™ : READY_TO_SELL.
- Outbound Evidence Gate™ : intégré.
- Evidence Ledger API : intégré.
- Channel Proof Connector Layer™ : intégré.
- Cash Autopilot Finalization Layer™ : ajouté.
- Blocage produit vérifié : aucun.
