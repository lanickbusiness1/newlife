# AFRIAGENESIS® Intelligence MCP Server — v0.4.0

Passerelle MCP gouvernée, deny-by-default du Universal Executive Intelligence OS™ et de GENESIS V4 Continental Skill Factory™.

## Endpoints

- `GET /health`
- `POST /mcp` — Bearer OIDC obligatoire en HTTP.

## Identité et autorisation — GENESIS V4

Le transport HTTP n'accepte plus `tenantId`, `actorId`, `agentId` ni `permissionScope` comme autorité fournie par le payload MCP.

L'identité d'exécution est dérivée côté serveur d'un JWT OIDC signé et vérifié via JWKS :

- ancre identité : `GEN-V4-OIDC-AUTH-001` ;
- ancre autorisation : `GEN-V4-ASIR-AUTHZ-001` ;
- validation signature + allowlist RS/PS/ES ;
- validation `kid`, issuer, audience, `exp`, `nbf`, `iat`, subject ;
- dérivation serveur du tenant, acteur, agent, scopes, rôles et `amr` ;
- RBAC + ABAC selon la matrice ASIR ;
- `genome:skill:m8` exige un rôle M8 autorisé **et** une preuve MFA ;
- `genome:skill:review` exige un rôle de review autorisé **et** une preuve MFA ;
- les données `restricted` exigent le scope `data:restricted` issu du token et une référence d'approbation ;
- le contexte métier client est strictement limité à `correlationId`, `purpose`, `dataClassification` et éventuellement `approvalContext`.

### Configuration HTTP obligatoire

Le service HTTP est fail-closed au démarrage si les variables suivantes sont absentes :

- `OIDC_ISSUER`
- `OIDC_AUDIENCE`
- `OIDC_JWKS_URI`

Variables optionnelles :

- `OIDC_CLOCK_TOLERANCE_SECONDS` — défaut `30` ;
- `OIDC_JWKS_CACHE_SECONDS` — défaut `300`.

`OIDC_ALLOW_INSECURE_JWKS=true` existe uniquement pour les tests locaux et est refusé lorsque `NODE_ENV=production`.

### STDIO

STDIO est deny-by-default. Son utilisation locale exige `MCP_TRUSTED_STDIO=true` et une identité injectée par l'environnement serveur. Ce mode est **interdit en production**.

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
- `genome.skill_factory.match` — Registry-first ; à partir de 80 % de compatibilité, réutilisation/composition prioritaire.
- `genome.skill_factory.install` — compile puis installe avec Double Review/M8 selon statut.
- `genome.skill_factory.promote` — contrôle la promotion L5/L4/L3 vers L2/L1/L0.
- `genome.skill_registry.list` — liste les versions après contrôle d'intégrité.
- `genome.skill_registry.read` — lit une version et vérifie SHA-256.
- `genome.country_compiler.compile` — compose Core + Domain + Regional + Country + Institution + Transaction avec Context Pack STRATEX-99 et invariants GENOME.

### Scopes minimaux

- `genome:skill:compile`
- `genome:skill:read`
- `genome:skill:install`
- `genome:skill:promote`
- `genome:country:compile`

### Scopes d'autorité — non substituables

- `genome:skill:review`
- `genome:skill:m8`

Un booléen d'approbation sans autorité issue du token vérifié est refusé. L'approbation M8 ne fait pas partie du Skill DNA : un skill ne peut pas s'auto-approuver.

## Vérification reproductible

```bash
npm ci --ignore-scripts
npm audit --audit-level=high
npm run typecheck
npm test
npm run build
npm run smoke:mcp
npm run smoke:http-auth
docker build --tag afriagenesis-mcp:ci .
docker run --rm afriagenesis-mcp:ci npm run smoke:mcp
docker run --rm afriagenesis-mcp:ci npm run smoke:http-auth
```

`smoke:mcp` vérifie `compile → registry install → SHA read → Registry-first match → Country Compiler`.

`smoke:http-auth` génère une clé RSA éphémère, sert un JWKS local, signe de vrais JWT, démarre le MCP HTTP puis prouve :

1. `/mcp` sans bearer → refus ;
2. JWT valide + scope valide → outil autorisé ;
3. JWT valide + scope insuffisant → refus ;
4. tentative de forger tenant/acteur/scopes dans le contexte MCP → refus.

GitHub Actions exécute les deux smokes sur le runner **et dans l'image Docker**. La CI démarre aussi un conteneur configuré OIDC et vérifie `/health` puis le refus HTTP 401 sans bearer.

## Déploiement Render

`/render.yaml` déploie le service depuis `services/mcp-server`. Les valeurs OIDC ne sont pas codées en dur ; elles doivent être injectées dans l'environnement Render.

`SKILL_REGISTRY_DIR` doit pointer vers un stockage durable avant toute exploitation persistante du registre.

## Frontière de preuve — obligatoire

**Code/CI/Docker/OIDC simulé vérifiés ne signifient pas production-ready.** Le claim production reste interdit tant que les preuves externes suivantes ne sont pas disponibles :

- fournisseur OIDC institutionnel réel configuré avec MFA, rotation/révocation et journalisation ;
- déploiement externe persistant et healthcheck depuis l'environnement cible ;
- volume persistant `SKILL_REGISTRY_DIR` ;
- sauvegarde + restauration du Registry testées ;
- concurrence multi-instance/shared-volume validée pour toutes les mutations lifecycle ;
- monitoring/alerting opérationnels ;
- rollback réellement exécuté ;
- isolation multi-tenant et politique de données institutionnelles validées ;
- ABAC pays/organisation/mission appliqué aux actions territoriales ;
- provenance/version territoriale forte des Context Packs ;
- revue indépendante sécurité/juridique lorsque le contexte l'exige.

## Statut de sécurité

La faille architecturale où `permissionScope` venait du payload client est **fermée au niveau du code et des tests**. La frontière d'autorisation HTTP est désormais un JWT OIDC vérifié côté serveur + contrôles ASIR RBAC/ABAC.

La prochaine frontière à durcir est l'ABAC territorial : un token autorisé ne doit pouvoir compiler ou composer que les pays, organisations et missions explicitement présents dans ses attributs vérifiés.
