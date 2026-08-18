# AFRIAGENESIS® Intelligence MCP Server

Package MCP canonique : `0.2.0`  
Révision du control plane GENESIS V4 : `0.4.0`

Passerelle MCP stateless, tenant-aware et deny-by-default du Universal Executive Intelligence OS™. Le service contient désormais le Revenue Engine, le CEO Validation → DeployBot Relay et le World Model Runtime Proof déterministe.

## Endpoints

- `GET /health`
- `POST /mcp`

Le healthcheck distingue la version du package de la révision du control plane et expose les marqueurs GENESIS V4 actifs.

## Outils existants

- `entity.search`
- `entity.get`
- `evidence.search`
- `evidence.get_lineage`
- `signal.ingest`
- `opportunity.score`
- `opportunity.explain_score`
- `executive.generate_brief`
- `genome.revenue_engine.compile`
- `deploybot.validation_relay.compile`

## World Model Runtime Proof

Outils gouvernés :

- `world.reconstruct_state` — scope `world:read`
- `world.simulate` — scope `world:simulate`
- `world.decide` — scope `world:decide`
- `world.evaluate_outcome` — scope `world:evaluate`

Le P0 matérialise la chaîne :

`Observation → State Reconstruction → Counterfactual Simulation → Decision → Reversible Sandbox Action Contract → Outcome → Prediction Error → Learning Candidate`.

### Frontière de preuve

Le World Model Runtime est actuellement une **preuve déterministe sandbox**. Il conserve le lineage des preuves, interdit l’imputation silencieuse de métriques manquantes et ne sélectionne automatiquement que des scénarios réversibles.

Les actions P0 sont des contrats sandbox (`crm.lead.upsert_sandbox`, `crm.task.create_sandbox`, `crm.opportunity.move_sandbox`, `noop`). Aucune capacité d’envoi réel d’email/WhatsApp, de transfert de fonds, d’engagement juridique, de communication institutionnelle externe ou de mutation irréversible n’est introduite par ce proof.

Les schémas SQL canoniques GENESIS V4 restent l’autorité de persistance : `065`, `070`, `071`, `072`, `074`, `076`. Leur présence dans Google Drive/Notion ne constitue pas une preuve de migration staging. Le statut `STAGING_PROVEN` exige une exécution ordonnée et vérifiée de la chaîne SQL complète sur une base autorisée.

## Validation Relay

Après validation CEO d’une roadmap suffisamment définie, `deploybot.validation_relay.compile` autorise la poursuite automatique A1–A3 jusqu’au livrable vérifié ou jusqu’à un veto A4 explicite. Un statut `DELIVERED_*` exige commit, CI/tests, gates requis, artefact/URL réel, healthcheck et preuve de rollback.

## Déploiement

Le fichier `/render.yaml` configure ce service depuis `services/mcp-server` avec `autoDeploy: true` et healthcheck `/health`.

Cette configuration **n’est pas à elle seule une preuve de production**. Un statut `PRODUCTION_PROVEN` exige l’observation de l’endpoint provider réel, de la révision attendue, du healthcheck et de la réversibilité/rollback.

## Vérification

```bash
npm ci --ignore-scripts
npm audit --audit-level=high
npm run typecheck
npm test
npm run build
```

## Sécurité

Le control plane reste deny-by-default et exige les scopes explicites du `RequestContext`. Les adaptateurs externes non prouvés restent désactivés ou simulés. Aucune donnée sensible ne doit être connectée hors politiques RLS, secrets manager, S7+ et gates de gouvernance applicables.
