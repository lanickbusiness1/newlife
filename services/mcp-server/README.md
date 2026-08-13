# AFRIAGENESIS® Intelligence MCP Server — v0.4.0

Passerelle MCP gouvernée, deny-by-default du Universal Executive Intelligence OS™ et de GENESIS V4 Continental Skill Factory™.

## Endpoints

- `GET /health`
- `POST /mcp` — Bearer OIDC obligatoire en HTTP.

## Identité et autorisation — GENESIS V4

Le transport HTTP n'accepte plus `tenantId`, `actorId`, `agentId`, `permissionScope`, pays autorisés, organisations autorisées ni missions autorisées comme autorités fournies par le payload MCP.

L'identité d'exécution est dérivée côté serveur d'un JWT OIDC signé et vérifié via JWKS :

- ancre identité : `GEN-V4-OIDC-AUTH-001` ;
- ancre autorisation : `GEN-V4-ASIR-AUTHZ-001` ;
- validation signature + allowlist RS/PS/ES ;
- validation `kid`, issuer, audience, `exp`, `nbf`, `iat`, subject ;
- dérivation serveur du tenant, acteur, agent, scopes, rôles et `amr` ;
- dérivation serveur des attributs ABAC `countries`, `organizations`, `missions` ;
- RBAC + ABAC selon la matrice ASIR ;
- `genome:skill:m8` exige un rôle M8 autorisé **et** une preuve MFA ;
- `genome:skill:review` exige un rôle de review autorisé **et** une preuve MFA ;
- les données `restricted` exigent le scope `data:restricted` issu du token et une référence d'approbation ;
- le contexte métier client est strictement limité à `correlationId`, `purpose`, `dataClassification` et éventuellement `approvalContext`.

### ABAC territorial

Les skills L2–L5 sont limités aux attributs vérifiés de l'identité :

- compilation : tous les pays/institutions ciblés doivent être autorisés ;
- Registry-first match : la cible doit être autorisée **et les candidats non autorisés sont filtrés avant scoring/ranking** ;
- installation : la cible doit être autorisée ;
- Registry `list` : les skills hors périmètre sont masqués ;
- Registry `read` : accès hors périmètre refusé ;
- Country Compiler : pays cible et institutions référencées doivent être autorisés.

Un wildcard `*` n'est honoré que s'il provient explicitement d'un claim vérifié ; il n'est jamais inféré.

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
- `genome.skill_factory.match` — Registry-first ; à partir de 80 % de compatibilité, réutilisation/composition prioritaire, après filtre ABAC.
- `genome.skill_approval.review_attest` — crée une attestation immuable de Double Review.
- `genome.skill_approval.m8_attest` — crée une attestation immuable M8.
- `genome.skill_factory.install` — installe uniquement après résolution des attestations requises.
- `genome.skill_factory.promote` — contrôle la promotion L5/L4/L3 vers L2/L1/L0.
- `genome.skill_registry.list` — liste les versions visibles après contrôle d'intégrité.
- `genome.skill_registry.read` — lit une version autorisée et vérifie SHA-256.
- `genome.country_compiler.compile` — compose Core + Domain + Regional + Country + Institution + Transaction avec Context Pack STRATEX-99 et invariants GENOME.

## Governance Approval Ledger

Ancre : `GENESIS_GOVERNANCE_APPROVAL_LEDGER_0.1.0`.

Les anciens booléens d'approbation ne constituent plus une preuve sur la surface MCP. `genome.skill_factory.install` accepte uniquement des références UUID d'attestations préalables.

Chaque attestation contient notamment :

- type `double_review` ou `m8` ;
- `skillId` + version + fingerprint SHA-256 du **Skill DNA exact** ;
- tenant ;
- acteur, agent et issuer vérifiés ;
- rôles et `amr` ;
- correlation/purpose ;
- émission, expiration ;
- intégrité SHA-256 du record.

Le ledger est append-only pour les attestations : création atomique, fichier immuable, vérification d'intégrité et TTL. Une attestation ne peut pas être rejouée pour un Skill DNA modifié ni pour un autre tenant.

### Separation of Duties

Pour un skill sensible nécessitant M8 et Double Review :

**Reviewer ≠ M8 Approver ≠ Installer**.

Même un acteur possédant plusieurs rôles/scopes ne peut pas remplir plusieurs positions dans la même installation sensible. Le contrôle est fait sur les identités vérifiées, pas sur des booléens fournis par le client.

### Scopes minimaux

- `genome:skill:compile`
- `genome:skill:read`
- `genome:skill:install`
- `genome:skill:promote`
- `genome:country:compile`

### Scopes d'autorité — non substituables

- `genome:skill:review`
- `genome:skill:m8`

L'approbation M8 ne fait pas partie du Skill DNA : un skill ne peut pas s'auto-approuver.

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

`smoke:mcp` vérifie le Registry, SHA, Registry-first, Country Compiler et l'intégrité du Governance Approval Ledger.

`smoke:http-auth` génère une clé RSA éphémère, sert un JWKS local, signe de vrais JWT, démarre le MCP HTTP puis prouve :

1. `/mcp` sans bearer → refus ;
2. JWT valide + scope valide → outil autorisé ;
3. JWT valide + scope insuffisant → refus ;
4. tentative de forger tenant/acteur/scopes/territoires dans le contexte MCP → refus ;
5. token limité à `GN` → Guinée autorisée, Côte d'Ivoire refusée ;
6. Reviewer OIDC + MFA crée l'attestation de Double Review ;
7. acteur M8 OIDC + MFA distinct crée l'attestation M8 ;
8. le Reviewer ne peut pas utiliser ses propres attestations pour installer ;
9. un troisième acteur Installer peut installer avec les deux références valides.

GitHub Actions exécute les deux smokes sur le runner **et dans l'image Docker**. La CI démarre aussi un conteneur configuré OIDC et vérifie `/health` puis le refus HTTP 401 sans bearer.

### Preuve fraîche

La preuve de référence est **le dernier run GitHub Actions réussi attaché au HEAD courant de la PR #31**. Ne jamais utiliser un numéro de run historique pour déclarer un HEAD ultérieur comme vérifié.

## Déploiement Render

`/render.yaml` déploie le service depuis `services/mcp-server`. Les valeurs OIDC ne sont pas codées en dur ; elles doivent être injectées dans l'environnement Render.

Les chemins déclarés sont :

- `SKILL_REGISTRY_DIR=/var/lib/afriagenesis/skill-registry`
- `GOVERNANCE_APPROVAL_DIR=/var/lib/afriagenesis/governance-approvals`
- `GOVERNANCE_APPROVAL_TTL_SECONDS=3600`

**Déclarer un chemin ne prouve pas sa persistance.** Le plan/runtime cible doit fournir un stockage durable réellement monté et testé avant tout claim staging persistant ou production.

## Frontière de preuve — obligatoire

**Code/CI/Docker/OIDC de test vérifiés ne signifient pas production-ready.** Le claim production reste interdit tant que les preuves externes suivantes ne sont pas disponibles :

- fournisseur OIDC institutionnel réel configuré avec MFA, rotation/révocation et journalisation ;
- déploiement externe persistant et healthcheck depuis l'environnement cible ;
- volumes persistants pour Skill Registry **et** Governance Approval Ledger ;
- sauvegarde + restauration des deux stores testées ;
- concurrence multi-instance/shared-volume validée pour toutes les mutations lifecycle ;
- monitoring/alerting opérationnels ;
- rollback réellement exécuté ;
- isolation multi-tenant au niveau stockage/base, en plus des filtres MCP ;
- provenance/version territoriale forte des Context Packs ;
- révocation/withdrawal append-only des attestations à ajouter ;
- revue indépendante sécurité/juridique lorsque le contexte l'exige.

## Statut de sécurité

Les failles architecturales suivantes sont fermées au niveau code/tests :

- scopes/tenant/acteur fournis par le payload client ;
- absence d'ABAC territorial ;
- fuite Registry list/read hors territoire ;
- fuite Registry-first avant ranking ;
- auto-approbation M8 dans le Skill DNA ;
- approbations MCP par simples booléens ;
- même acteur utilisé comme Reviewer, M8 et Installer.

La prochaine frontière prioritaire est la **persistance multi-tenant et la révocation append-only** des attestations avant staging institutionnel.
