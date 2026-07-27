# AFRIAGENESIS® Intelligence MCP Server — v0.1.1

Passerelle MCP stateless, tenant-aware et deny-by-default du Universal Executive Intelligence OS™.

## Endpoints

- `GET /health`
- `POST /mcp`

## Outils v0.1

- `entity.search`
- `entity.get`
- `evidence.search`
- `evidence.get_lineage`
- `signal.ingest`
- `opportunity.score`
- `opportunity.explain_score`
- `executive.generate_brief`

## Déploiement

Le fichier `/render.yaml` déploie ce service depuis `services/mcp-server`.

## Statut de sécurité

Les adaptateurs métier sont encore simulés. Aucune donnée sensible ne doit être connectée avant authentification forte, RLS multi-tenant, secrets manager, tests adversariaux G8 et validation S7+.
