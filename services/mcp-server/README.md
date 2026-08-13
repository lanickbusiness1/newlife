# AFRIAGENESIS® Intelligence MCP Server — v0.3.0

Passerelle MCP gouvernée, deny-by-default du Universal Executive Intelligence OS™ et de GENESIS V4 Skill Factory™.

## Endpoints

- `GET /health`
- `POST /mcp`

## Outils de base

- `entity.search`
- `entity.get`
- `evidence.search`
- `evidence.get_lineage`
- `signal.ingest`
- `opportunity.score`
- `opportunity.explain_score`
- `executive.generate_brief`
- `genome.revenue_engine.compile`

## GENESIS V4 Continental Skill Factory

- `genome.skill_factory.compile` — compile le Skill DNA avec STRATEX-99, STRATEX-9 et gates M6/S7+/M8.
- `genome.skill_factory.match` — recherche Registry-first ; à partir de 80 % de compatibilité, réutilisation/composition prioritaire.
- `genome.skill_factory.install` — compile puis installe avec Double Review/M8 selon statut.
- `genome.skill_factory.promote` — contrôle la promotion L5/L4/L3 vers L2/L1/L0.
- `genome.skill_registry.list` — liste les versions avec contrôle d’intégrité.
- `genome.skill_registry.read` — lit une version et vérifie SHA-256.
- `genome.country_compiler.compile` — compose Core + Domain + Regional + Country + Institution + Transaction avec Context Pack STRATEX-99 et invariants GENOME.

### Scopes minimaux

- `genome:skill:compile`
- `genome:skill:read`
- `genome:skill:install`
- `genome:skill:promote`
- `genome:country:compile`

## Vérification reproductible

```bash
npm ci --ignore-scripts
npm audit --audit-level=high
npm run typecheck
npm test
npm run build
npm run smoke:mcp
```

Le smoke prouve le chemin déterministe `compile → registry install → SHA read → Registry-first match → Country Compiler` sur un registre temporaire.

## Déploiement

Le fichier `/render.yaml` déploie ce service depuis `services/mcp-server`.

`SKILL_REGISTRY_DIR` doit pointer vers un stockage durable avant toute exploitation persistante du registre.

## Frontière de preuve — obligatoire

**Code/CI vérifié ne signifie pas production-ready.** Un claim production pour la Skill Factory reste interdit tant que les preuves suivantes ne sont pas disponibles :

- image Docker réellement construite et exécutée ;
- runtime déployé et healthcheck observé ;
- volume persistant `SKILL_REGISTRY_DIR` ;
- sauvegarde + restauration du registre testées ;
- monitoring/alerting opérationnels ;
- rollback réellement exécuté ;
- isolation et politique de données validées pour les usages institutionnels ;
- double revue M6/S7+/M8 des périmètres sensibles.

## Statut de sécurité

Les outils Skill Factory sont déterministes et gouvernés, mais les adaptateurs métier historiques restent partiellement simulés. Aucune donnée sensible ne doit être connectée sans authentification forte, isolation multi-tenant appropriée, secrets manager, tests adversariaux et validation S7+.
