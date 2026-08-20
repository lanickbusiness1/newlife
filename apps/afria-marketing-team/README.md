# AfrIA Marketing Team™ — Production Product v1.0

**Product ID:** `PRD-MKT-TEAM-001`  
**GENOME:** `GENESIS_V4`  
**Revenue Engine:** `GEN-V4-REV-ENGINE-001`  
**Baseline canonique:** `v1.1 + Auto-GTM P0 v0.3.0`  
**Product standard:** `Production Product`  
**Commercial status:** `READY_TO_SELL`  
**Cash status:** `À ENCAISSER`  
**Blocage vérifié:** `AUCUN`

AfrIA Marketing Team™ est le premier moteur commercial propriétaire AfrIAgenesis® : il sert à vendre ses propres offres rapidement, puis à devenir l’opérateur commercial transversal pour AfrIA PaySwitch™, AfrIA Recruit™, AfrIA CyberAudit™, AfrIA PIA™ et les autres produits.

## Règle CEO : zéro blocage imaginaire

Les éléments suivants sont des tâches d’activation commerciale, pas des blocages : WhatsApp Business/API, paiement réel, CRM persistant, domaine/TLS et première preuve d’encaissement. Le mot blocage est réservé aux échecs vérifiés : CI rouge, fail sécurité S7+/CyberAudit, permission réellement absente, risque légal explicite ou impossibilité technique démontrée.

## Ce que livre cette version production

- PWA premium avec interface sombre africaine.
- Command Center produit/offre/pays/acheteur.
- 5 agents opérationnels : Stratège, Créateur, Designer, Analyste, CMO IA.
- LeadEngine™ : ICP, script, séquence J+0/J+1/J+3/J+5/J+7/J+14.
- CRM pipeline : Signal → Lead qualifié → Diagnostic → Proposition → Paiement → Livraison → Cas client → Upsell / Referral.
- Revenue Cockpit : loi des moyennes, ventes attendues, revenu attendu, cash activation.
- Cash Activation : message WhatsApp, objectif jour 1, séquence de 100 prospects, 4 ventes et 199 600 FCFA.
- R.E.M.E : objections, messages gagnants, preuves, lessons réutilisables.
- Export Center : Markdown plan, JSON evidence, HTML report.
- S7+ policy gate : SEND, PAY, DELETE, EXPORT nécessitent validation humaine.
- FastAPI backend boundary : health, product intake, policy simulation, evidence validation.
- CI production : frontend tests/build, backend tests, static anchors.

## Offres commerciales

| Offre | Prix | Client cible | Livrable |
|---|---:|---|---|
| Starter | 49 900 FCFA | entrepreneur solo / petite PME | 1 offre, scripts, CRM pipeline, séquence 14 jours |
| Business | 89 900 FCFA | PME active | 3 offres, 3 ICP, calendrier contenu, CRM complet |
| Agence | 199 000 FCFA | agence, cabinet, consultant senior | 5 campagnes, objections, cash collection, upsell/referral |

## Chaîne Release-to-Revenue

```text
Produit
→ Offre
→ ICP
→ Preuve
→ Canal
→ Script
→ CRM
→ Séquence
→ Diagnostic
→ Proposition
→ Paiement
→ Encaissement
→ Cas client
→ Upsell
→ Scale / Correct / Kill
```

## Activation live

Aucune attente théorique. Les tâches d’activation sont concrètes :

- utiliser le numéro WhatsApp commercial AfrIAgenesis® ;
- envoyer 100 messages ciblés ;
- réserver 10 diagnostics ;
- envoyer 4 propositions Starter ;
- encaisser le premier paiement ;
- attacher la preuve de paiement ;
- produire le premier cas client ;
- injecter l’apprentissage dans R.E.M.E.

## Gates

- **M6** : tests, build, evidence pack, product contract et chain Release-to-Revenue cohérents.
- **S7+** : SEND/PAY/DELETE/EXPORT séparés, human gate, kill switch, pas de secrets.
- **CyberAudit** : abus, cross-tenant, injection, secret leakage, export, consent et rollback à vérifier avant scale.
- **M8** : gouvernance stratégique après preuve de revenu.
- **Big4** : requis avant scale institutionnel ou promesse économique sensible.

## Premier objectif cash

- 100 prospects ciblés.
- 30 réponses.
- 10 diagnostics.
- 4 ventes.
- Revenu attendu Starter : `4 × 49 900 = 199 600 FCFA`.
- Objectif stretch à 10 000 présentations : `400 ventes × 49 900 = 19 960 000 FCFA`.

## Exécution locale

Frontend :

```bash
cd apps/afria-marketing-team/frontend
npm install
npm run typecheck
npm test
npm run build
```

Backend :

```bash
cd apps/afria-marketing-team/backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
pytest -q
uvicorn main:app --reload
```
